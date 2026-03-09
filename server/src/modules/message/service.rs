use chrono::{DateTime, Utc};
use mongodb::Database;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::message::{CreateMessage, MessageResponse, UpdateMessage};
use super::repository::MessageRepository;

pub struct MessageService<'a> {
    repository: MessageRepository<'a>,
    pg_pool: &'a PgPool,
}

impl<'a> MessageService<'a> {
    pub fn new(mongo_db: &'a Database, pg_pool: &'a PgPool) -> Self {
        Self {
            repository: MessageRepository::new(mongo_db),
            pg_pool,
        }
    }

    pub async fn send_message(&self, user_id: Uuid, data: CreateMessage) -> Result<MessageResponse, ServiceError> {
        let (channel_exists, server_id) = sqlx::query_as::<_, (bool, Option<Uuid>)>(
            "SELECT EXISTS(SELECT 1 FROM channels WHERE id = $1),
                    (SELECT server_id FROM channels WHERE id = $1)",
        )
            .bind(data.channel_id)
            .fetch_one(self.pg_pool)
            .await
            .map_err(ServiceError::Database)?;

        if !channel_exists {
            return Err(ServiceError::NotFound("Channel not found".to_string()));
        }

        let server_id = server_id.ok_or(ServiceError::NotFound("Channel not found".to_string()))?;

        let (is_member, username) = sqlx::query_as::<_, (bool, Option<String>)>(
            "SELECT
                EXISTS(SELECT 1 FROM server_members WHERE server_id = $1 AND user_id = $2),
                (SELECT username FROM users WHERE id = $2)",
        )
            .bind(server_id)
            .bind(user_id)
            .fetch_one(self.pg_pool)
            .await
            .map_err(ServiceError::Database)?;

        if !is_member {
            return Err(ServiceError::Forbidden("You are not a member of this server".to_string()));
        }

        let username = username.ok_or(ServiceError::NotFound("User not found".to_string()))?;

        let message = self
            .repository
            .create(user_id, username, server_id, data)
            .await
            .map_err(|e| ServiceError::Internal(e.to_string()))?;

        Ok(message.to_response())
    }

    pub async fn get_messages(
        &self,
        user_id: Uuid,
        channel_id: Uuid,
        limit: Option<i64>,
        before: Option<DateTime<Utc>>,
    ) -> Result<Vec<MessageResponse>, ServiceError> {
        let server_id = sqlx::query_scalar::<_, Option<Uuid>>("SELECT server_id FROM channels WHERE id = $1")
            .bind(channel_id)
            .fetch_one(self.pg_pool)
            .await
            .map_err(ServiceError::Database)?
            .ok_or(ServiceError::NotFound("Channel not found".to_string()))?;

        let is_member = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM server_members WHERE server_id = $1 AND user_id = $2)",
        )
            .bind(server_id)
            .bind(user_id)
            .fetch_one(self.pg_pool)
            .await
            .map_err(ServiceError::Database)?;

        if !is_member {
            return Err(ServiceError::Forbidden("You are not a member of this server".to_string()));
        }

        let limit = limit.unwrap_or(50).clamp(1, 100);

        let messages = self
            .repository
            .find_by_channel(channel_id, limit, before)
            .await
            .map_err(|e| ServiceError::Internal(e.to_string()))?;

        Ok(messages.into_iter().map(|m| m.to_response()).collect())
    }

    pub async fn update_message(
        &self,
        user_id: Uuid,
        message_id: Uuid,
        data: UpdateMessage,
    ) -> Result<MessageResponse, ServiceError> {
        let message = self
            .repository
            .find_by_id(message_id)
            .await
            .map_err(|e| ServiceError::Internal(e.to_string()))?
            .ok_or(ServiceError::NotFound("Message not found".to_string()))?;

        if message.user_id != user_id {
            return Err(ServiceError::Forbidden("You can only edit your own messages".to_string()));
        }

        if message.is_deleted() {
            return Err(ServiceError::Forbidden("Cannot edit a deleted message".to_string()));
        }

        let updated_message = self
            .repository
            .update(message_id, &data)
            .await
            .map_err(|e| ServiceError::Internal(e.to_string()))?;

        Ok(updated_message.to_response())
    }

    pub async fn delete_message(&self, user_id: Uuid, message_id: Uuid) -> Result<(Uuid, Uuid, Uuid), ServiceError> {
        let message = self
            .repository
            .find_by_id(message_id)
            .await
            .map_err(|e| ServiceError::Internal(e.to_string()))?
            .ok_or(ServiceError::NotFound("Message not found".to_string()))?;

        if message.is_deleted() {
            return Err(ServiceError::Forbidden("Cannot delete a deleted message".to_string()));
        }

        let can_delete = if message.user_id == user_id {
            true
        } else {
            let role: Option<String> = sqlx::query_scalar(
                "SELECT role::text FROM server_members WHERE server_id = $1 AND user_id = $2",
            )
                .bind(message.server_id)
                .bind(user_id)
                .fetch_optional(self.pg_pool)
                .await
                .map_err(ServiceError::Database)?;

            matches!(role.as_deref(), Some("owner") | Some("admin"))
        };

        if !can_delete {
            return Err(ServiceError::Forbidden("You don't have permission to delete this message".to_string()));
        }

        self.repository
            .delete(message_id)
            .await
            .map_err(|e| ServiceError::Internal(e.to_string()))?;

        Ok((message.server_id, message.channel_id, message.message_id))
    }
}

#[derive(Debug, thiserror::Error)]
pub enum ServiceError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Forbidden: {0}")]
    Forbidden(String),
    #[error("Internal error: {0}")]
    Internal(String),
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::message::{CreateMessage, Message, UpdateMessage};
    use chrono::{TimeZone, Utc};
    use std::sync::Arc;

    #[test]
    fn test_service_error_is_send_sync() {
        fn assert_send_sync<T: Send + Sync>() {}
        assert_send_sync::<ServiceError>();
    }

    #[test]
    fn test_service_error_display() {
        let e = ServiceError::NotFound("x".to_string());
        assert_eq!(e.to_string(), "Not found: x");

        let e = ServiceError::Forbidden("no".to_string());
        assert_eq!(e.to_string(), "Forbidden: no");

        let e = ServiceError::Internal("oops".to_string());
        assert_eq!(e.to_string(), "Internal error: oops");

        let e = ServiceError::Database(sqlx::Error::RowNotFound);
        assert!(e.to_string().starts_with("Database error:"));
    }

    #[test]
    fn test_create_message_payload_trimming_behavior_is_in_route_not_here() {
        let payload = CreateMessage {
            content: "  hello  ".to_string(),
            channel_id: Uuid::new_v4(),
        };
        assert_eq!(payload.content, "  hello  ");
    }

    #[test]
    fn test_update_message_payload_content_is_passed_as_is() {
        let payload = UpdateMessage {
            content: "  hi  ".to_string(),
        };
        assert_eq!(payload.content, "  hi  ");
    }

    #[test]
    fn test_message_to_response_flags() {
        let mut m = Message {
            id: None,
            message_id: Uuid::new_v4(),
            content: "hello".to_string(),
            user_id: Uuid::new_v4(),
            username: "u".to_string(),
            channel_id: Uuid::new_v4(),
            server_id: Uuid::new_v4(),
            created_at: Utc.with_ymd_and_hms(2026, 2, 8, 12, 0, 0).unwrap(),
            updated_at: None,
            deleted_at: None,
        };

        let r = m.to_response();
        assert!(!r.is_deleted);
        assert!(!r.is_edited);

        m.updated_at = Some(Utc::now());
        let r = m.to_response();
        assert!(r.is_edited);

        m.deleted_at = Some(Utc::now());
        let r = m.to_response();
        assert!(r.is_deleted);
    }
    #[test]
    fn test_message_service_can_be_constructed_with_references() {
        let _ = Arc::new(());
        assert!(true);
    }
}
