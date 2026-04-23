use chrono::{DateTime, Utc};
use mongodb::Database;
use sqlx::PgPool;
use uuid::Uuid;

use super::repository::DirectMessageRepository;
use crate::models::direct_message::{Conversation, ConversationResponse, DirectMessageResponse};

#[derive(Debug)]
pub enum ServiceError {
    NotFound(String),
    Forbidden(String),
    Database(sqlx::Error),
    Internal(String),
}

impl std::fmt::Display for ServiceError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NotFound(msg) => write!(f, "Not found: {msg}"),
            Self::Forbidden(msg) => write!(f, "Forbidden: {msg}"),
            Self::Database(e) => write!(f, "Database error: {e}"),
            Self::Internal(msg) => write!(f, "Internal error: {msg}"),
        }
    }
}

pub struct DirectMessageService<'a> {
    mongo: &'a Database,
    pg: &'a PgPool,
}

impl<'a> DirectMessageService<'a> {
    pub fn new(mongo: &'a Database, pg: &'a PgPool) -> Self {
        Self { mongo, pg }
    }
    /// get/create a conversation between user_id and recipient_id
    pub async fn get_or_create_conversation(
        &self,
        user_id: Uuid,
        recipient_id: Uuid,
    ) -> Result<ConversationResponse, ServiceError> {
        if user_id == recipient_id {
            return Err(ServiceError::Forbidden(
                "You cannot start a conversation with yourself".to_string(),
            ));
        }
        let recipient_row =
            sqlx::query_as::<_, (Uuid, String)>("SELECT id, username FROM users WHERE id = $1")
                .bind(recipient_id)
                .fetch_optional(self.pg)
                .await
                .map_err(ServiceError::Database)?;

        let (_, recipient_username) = recipient_row
            .ok_or_else(|| ServiceError::NotFound("Recipient user not found".to_string()))?;
        let (u1, u2) = if user_id < recipient_id {
            (user_id, recipient_id)
        } else {
            (recipient_id, user_id)
        };
        let conv = sqlx::query_as::<_, Conversation>(
            r#"
            INSERT INTO conversations (id, user1_id, user2_id, created_at)
            VALUES (gen_random_uuid(), $1, $2, NOW())
            ON CONFLICT (user1_id, user2_id) DO UPDATE SET user1_id = EXCLUDED.user1_id
            RETURNING id, user1_id, user2_id, created_at
            "#,
        )
        .bind(u1)
        .bind(u2)
        .fetch_one(self.pg)
        .await
        .map_err(ServiceError::Database)?;

        Ok(ConversationResponse {
            id: conv.id,
            other_user_id: recipient_id,
            other_username: recipient_username,
            created_at: conv.created_at,
        })
    }

    pub async fn list_conversations(
        &self,
        user_id: Uuid,
    ) -> Result<Vec<ConversationResponse>, ServiceError> {
        let rows = sqlx::query_as::<_, (Uuid, Uuid, Uuid, DateTime<Utc>, String)>(
            r#"
            SELECT
                c.id,
                c.user1_id,
                c.user2_id,
                c.created_at,
                u.username AS other_username
            FROM conversations c
            JOIN users u ON u.id = CASE
                WHEN c.user1_id = $1 THEN c.user2_id
                ELSE c.user1_id
            END
            WHERE c.user1_id = $1 OR c.user2_id = $1
            ORDER BY c.created_at DESC
            "#,
        )
        .bind(user_id)
        .fetch_all(self.pg)
        .await
        .map_err(ServiceError::Database)?;
        Ok(rows
            .into_iter()
            .map(|(id, user1_id, user2_id, created_at, other_username)| {
                let other_user_id = if user1_id == user_id {
                    user2_id
                } else {
                    user1_id
                };
                ConversationResponse {
                    id,
                    other_user_id,
                    other_username,
                    created_at,
                }
            })
            .collect())
    }

    async fn check_participant(
        &self,
        conversation_id: Uuid,
        user_id: Uuid,
    ) -> Result<Conversation, ServiceError> {
        let conv = sqlx::query_as::<_, Conversation>(
            "SELECT id, user1_id, user2_id, created_at FROM conversations WHERE id = $1",
        )
        .bind(conversation_id)
        .fetch_optional(self.pg)
        .await
        .map_err(ServiceError::Database)?
        .ok_or_else(|| ServiceError::NotFound("Conversation not found".to_string()))?;
        if conv.user1_id != user_id && conv.user2_id != user_id {
            return Err(ServiceError::Forbidden(
                "You are not a participant of this conversation".to_string(),
            ));
        }
        Ok(conv)
    }

    pub async fn send_message(
        &self,
        conversation_id: Uuid,
        sender_id: Uuid,
        sender_username: String,
        content: String,
    ) -> Result<(DirectMessageResponse, Uuid), ServiceError> {
        let conv = self.check_participant(conversation_id, sender_id).await?;
        let recipient_id = if conv.user1_id == sender_id {
            conv.user2_id
        } else {
            conv.user1_id
        };
        let repo = DirectMessageRepository::new(self.mongo);
        let dm = repo
            .create(
                conversation_id,
                sender_id,
                sender_username,
                recipient_id,
                content,
            )
            .await
            .map_err(|e| ServiceError::Internal(e.to_string()))?;
        Ok((dm.into(), recipient_id))
    }

    pub async fn get_messages(
        &self,
        conversation_id: Uuid,
        user_id: Uuid,
        limit: i64,
        before: Option<DateTime<Utc>>,
    ) -> Result<Vec<DirectMessageResponse>, ServiceError> {
        self.check_participant(conversation_id, user_id).await?;

        let repo = DirectMessageRepository::new(self.mongo);
        let messages = repo
            .find_by_conversation(conversation_id, limit, before)
            .await
            .map_err(|e| ServiceError::Internal(e.to_string()))?;
        Ok(messages
            .into_iter()
            .map(DirectMessageResponse::from)
            .collect())
    }

    pub async fn update_message(
        &self,
        message_id: Uuid,
        user_id: Uuid,
        content: String,
    ) -> Result<(DirectMessageResponse, Uuid), ServiceError> {
        let repo = DirectMessageRepository::new(self.mongo);
        let dm = repo
            .find_by_id(message_id)
            .await
            .map_err(|e| ServiceError::Internal(e.to_string()))?
            .ok_or_else(|| ServiceError::NotFound("Direct message not found".to_string()))?;

        if dm.sender_id != user_id {
            return Err(ServiceError::Forbidden(
                "You can only edit your own messages".to_string(),
            ));
        }
        if dm.is_deleted() {
            return Err(ServiceError::Forbidden(
                "Cannot edit a deleted message".to_string(),
            ));
        }

        const EDIT_TIME_LIMIT_MINUTES: i64 = 5;
        let elapsed = Utc::now()
            .signed_duration_since(dm.created_at)
            .num_seconds();
        if elapsed >= EDIT_TIME_LIMIT_MINUTES * 60 {
            return Err(ServiceError::Forbidden(format!(
                "Messages can only be edited within {} minutes",
                EDIT_TIME_LIMIT_MINUTES
            )));
        }
        let recipient_id = dm.recipient_id;
        let updated = repo
            .update(message_id, content)
            .await
            .map_err(|e| ServiceError::Internal(e.to_string()))?;
        Ok((updated.into(), recipient_id))
    }

    pub async fn delete_message(
        &self,
        message_id: Uuid,
        user_id: Uuid,
    ) -> Result<(Uuid, Uuid), ServiceError> {
        let repo = DirectMessageRepository::new(self.mongo);
        let dm = repo
            .find_by_id(message_id)
            .await
            .map_err(|e| ServiceError::Internal(e.to_string()))?
            .ok_or_else(|| ServiceError::NotFound("Direct message not found".to_string()))?;

        if dm.sender_id != user_id {
            return Err(ServiceError::Forbidden(
                "You can only delete your own messages".to_string(),
            ));
        }
        if dm.is_deleted() {
            return Err(ServiceError::NotFound("Message not found".to_string()));
        }

        let conversation_id = dm.conversation_id;
        let recipient_id = dm.recipient_id;
        repo.delete(message_id)
            .await
            .map_err(|e| ServiceError::Internal(e.to_string()))?;
        Ok((conversation_id, recipient_id))
    }

    pub async fn add_reaction(
        &self,
        message_id: Uuid,
        user_id: Uuid,
        emoji: String,
    ) -> Result<(Uuid, Uuid), ServiceError> {
        let repo = DirectMessageRepository::new(self.mongo);
        let dm = repo
            .find_by_id(message_id)
            .await
            .map_err(|e| ServiceError::Internal(e.to_string()))?
            .ok_or_else(|| ServiceError::NotFound("Direct message not found".to_string()))?;

        if dm.is_deleted() {
            return Err(ServiceError::Forbidden(
                "Cannot react to a deleted message".to_string(),
            ));
        }

        self.check_participant(dm.conversation_id, user_id).await?;

        let other_user_id = if dm.sender_id == user_id {
            dm.recipient_id
        } else {
            dm.sender_id
        };

        repo.add_reaction(message_id, user_id, &emoji)
            .await
            .map_err(|e| ServiceError::Internal(e.to_string()))?;

        Ok((dm.conversation_id, other_user_id))
    }

    pub async fn remove_reaction(
        &self,
        message_id: Uuid,
        user_id: Uuid,
        emoji: String,
    ) -> Result<(Uuid, Uuid), ServiceError> {
        let repo = DirectMessageRepository::new(self.mongo);
        let dm = repo
            .find_by_id(message_id)
            .await
            .map_err(|e| ServiceError::Internal(e.to_string()))?
            .ok_or_else(|| ServiceError::NotFound("Direct message not found".to_string()))?;

        self.check_participant(dm.conversation_id, user_id).await?;

        let other_user_id = if dm.sender_id == user_id {
            dm.recipient_id
        } else {
            dm.sender_id
        };

        repo.remove_reaction(message_id, user_id, &emoji)
            .await
            .map_err(|e| ServiceError::Internal(e.to_string()))?;

        Ok((dm.conversation_id, other_user_id))
    }
}
