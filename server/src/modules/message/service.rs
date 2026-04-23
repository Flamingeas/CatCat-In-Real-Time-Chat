use std::sync::Arc;
use mongodb::bson::doc;
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use mongodb::Database;
use sqlx::PgPool;
use uuid::Uuid;
<<<<<<< HEAD
use actix_web::web;
use actix::Addr;
use crate::websocket::server::ServerEvent;
use crate::models::message::{CreateMessage, Message, MessageResponse, UpdateMessage};
use super::repository::MessageRepository;
use crate::WsServer;
=======

use super::repository::MessageRepository;
use crate::models::message::{CreateMessage, Message, MessageResponse, UpdateMessage};
>>>>>>> main

#[async_trait]
pub trait MessageRepositoryTrait: Send + Sync {
    async fn create(
        &self,
        user_id: Uuid,
        username: String,
        server_id: Uuid,
        data: CreateMessage,
    ) -> Result<Message, String>;

    async fn find_by_id(&self, message_id: Uuid) -> Result<Option<Message>, String>;

    async fn find_by_channel(
        &self,
        channel_id: Uuid,
        limit: i64,
        before: Option<DateTime<Utc>>,
    ) -> Result<Vec<Message>, String>;

    async fn update(&self, message_id: Uuid, data: &UpdateMessage) -> Result<Message, String>;

    async fn delete(&self, message_id: Uuid) -> Result<(), String>;

<<<<<<< HEAD
    async fn add_reaction(&self, message_id: Uuid, user_id: Uuid, emoji: String) -> Result<(), mongodb::error::Error>;
    async fn remove_reaction(&self, message_id: Uuid, user_id: Uuid, emoji: String) -> Result<(), mongodb::error::Error>;
=======
    async fn add_reaction(
        &self,
        message_id: Uuid,
        user_id: Uuid,
        emoji: &str,
    ) -> Result<(), String>;

    async fn remove_reaction(
        &self,
        message_id: Uuid,
        user_id: Uuid,
        emoji: &str,
    ) -> Result<(), String>;
>>>>>>> main
}

#[async_trait]
pub trait MessageAccessTrait: Send + Sync {
    async fn get_channel_server(&self, channel_id: Uuid) -> Result<Option<Uuid>, sqlx::Error>;

    async fn get_membership_and_username(
        &self,
        server_id: Uuid,
        user_id: Uuid,
    ) -> Result<(bool, Option<String>), sqlx::Error>;

    async fn is_server_member(&self, server_id: Uuid, user_id: Uuid) -> Result<bool, sqlx::Error>;

    async fn get_server_role(
        &self,
        server_id: Uuid,
        user_id: Uuid,
    ) -> Result<Option<String>, sqlx::Error>;
}

struct MongoMessageRepository {
    db: Database,
}

impl MongoMessageRepository {
    fn new(db: Database) -> Self {
        Self { db }
    }
}

#[async_trait]
impl MessageRepositoryTrait for MongoMessageRepository {
    async fn create(
        &self,
        user_id: Uuid,
        username: String,
        server_id: Uuid,
        data: CreateMessage,
    ) -> Result<Message, String> {
        MessageRepository::new(&self.db)
            .create(user_id, username, server_id, data)
            .await
            .map_err(|e| e.to_string())
    }

    async fn find_by_id(&self, message_id: Uuid) -> Result<Option<Message>, String> {
        MessageRepository::new(&self.db)
            .find_by_id(message_id)
            .await
            .map_err(|e| e.to_string())
    }

    async fn find_by_channel(
        &self,
        channel_id: Uuid,
        limit: i64,
        before: Option<DateTime<Utc>>,
    ) -> Result<Vec<Message>, String> {
        MessageRepository::new(&self.db)
            .find_by_channel(channel_id, limit, before)
            .await
            .map_err(|e| e.to_string())
    }

    async fn update(&self, message_id: Uuid, data: &UpdateMessage) -> Result<Message, String> {
        MessageRepository::new(&self.db)
            .update(message_id, data)
            .await
            .map_err(|e| e.to_string())
    }

    async fn delete(&self, message_id: Uuid) -> Result<(), String> {
        MessageRepository::new(&self.db)
            .delete(message_id)
            .await
            .map_err(|e| e.to_string())
    }

    async fn add_reaction(
        &self,
<<<<<<< HEAD
        message_id: uuid::Uuid,
        user_id: uuid::Uuid,
        emoji: String,
    ) -> Result<(), mongodb::error::Error> {
        // On délègue au vrai repository qu'on a réparé tout à l'heure !
        MessageRepository::new(&self.db)
            .add_reaction(message_id, user_id, emoji)
            .await
=======
        message_id: Uuid,
        user_id: Uuid,
        emoji: &str,
    ) -> Result<(), String> {
        MessageRepository::new(&self.db)
            .add_reaction(message_id, user_id, emoji)
            .await
            .map_err(|e| e.to_string())
>>>>>>> main
    }

    async fn remove_reaction(
        &self,
<<<<<<< HEAD
        message_id: uuid::Uuid,
        user_id: uuid::Uuid,
        emoji: String,
    ) -> Result<(), mongodb::error::Error> {
        // On délègue au vrai repository !
        MessageRepository::new(&self.db)
            .remove_reaction(message_id, user_id, emoji)
            .await
=======
        message_id: Uuid,
        user_id: Uuid,
        emoji: &str,
    ) -> Result<(), String> {
        MessageRepository::new(&self.db)
            .remove_reaction(message_id, user_id, emoji)
            .await
            .map_err(|e| e.to_string())
>>>>>>> main
    }
}

struct PgMessageAccess {
    pg_pool: PgPool,
}

impl PgMessageAccess {
    fn new(pg_pool: PgPool) -> Self {
        Self { pg_pool }
    }
}

#[async_trait]
impl MessageAccessTrait for PgMessageAccess {
    async fn get_channel_server(&self, channel_id: Uuid) -> Result<Option<Uuid>, sqlx::Error> {
        sqlx::query_scalar::<_, Option<Uuid>>("SELECT server_id FROM channels WHERE id = $1")
            .bind(channel_id)
            .fetch_one(&self.pg_pool)
            .await
    }

    async fn get_membership_and_username(
        &self,
        server_id: Uuid,
        user_id: Uuid,
    ) -> Result<(bool, Option<String>), sqlx::Error> {
        sqlx::query_as::<_, (bool, Option<String>)>(
            "SELECT
                EXISTS(SELECT 1 FROM server_members WHERE server_id = $1 AND user_id = $2),
                (SELECT username FROM users WHERE id = $2)",
        )
        .bind(server_id)
        .bind(user_id)
        .fetch_one(&self.pg_pool)
        .await
    }

    async fn is_server_member(&self, server_id: Uuid, user_id: Uuid) -> Result<bool, sqlx::Error> {
        sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM server_members WHERE server_id = $1 AND user_id = $2)",
        )
        .bind(server_id)
        .bind(user_id)
        .fetch_one(&self.pg_pool)
        .await
    }

    async fn get_server_role(
        &self,
        server_id: Uuid,
        user_id: Uuid,
    ) -> Result<Option<String>, sqlx::Error> {
        sqlx::query_scalar(
            "SELECT role::text FROM server_members WHERE server_id = $1 AND user_id = $2",
        )
        .bind(server_id)
        .bind(user_id)
        .fetch_optional(&self.pg_pool)
        .await
    }
}

pub struct MessageService {
    repository: Arc<dyn MessageRepositoryTrait>,
    access: Arc<dyn MessageAccessTrait>,
}

impl MessageService {
    pub fn new(mongo_db: &Database, pg_pool: &PgPool) -> Self {
        Self {
            repository: Arc::new(MongoMessageRepository::new(mongo_db.clone())),
            access: Arc::new(PgMessageAccess::new(pg_pool.clone())),
        }
    }

    pub fn with_dependencies(
        repository: Arc<dyn MessageRepositoryTrait>,
        access: Arc<dyn MessageAccessTrait>,
    ) -> Self {
        Self { repository, access }
    }

    pub async fn send_message(
        &self,
        user_id: Uuid,
        data: CreateMessage,
    ) -> Result<MessageResponse, ServiceError> {
        let server_id = self
            .access
            .get_channel_server(data.channel_id)
            .await
            .map_err(ServiceError::Database)?
            .ok_or(ServiceError::NotFound("Channel not found".to_string()))?;

        let (is_member, username) = self
            .access
            .get_membership_and_username(server_id, user_id)
            .await
            .map_err(ServiceError::Database)?;

        if !is_member {
            return Err(ServiceError::Forbidden(
                "You are not a member of this server".to_string(),
            ));
        }

        let username = username.ok_or(ServiceError::NotFound("User not found".to_string()))?;

        let message = self
            .repository
            .create(user_id, username, server_id, data)
            .await
            .map_err(ServiceError::Internal)?;

        Ok(message.to_response())
    }

    pub async fn get_messages(
        &self,
        user_id: Uuid,
        channel_id: Uuid,
        limit: Option<i64>,
        before: Option<DateTime<Utc>>,
    ) -> Result<Vec<MessageResponse>, ServiceError> {
        let server_id = self
            .access
            .get_channel_server(channel_id)
            .await
            .map_err(ServiceError::Database)?
            .ok_or(ServiceError::NotFound("Channel not found".to_string()))?;

        let is_member = self
            .access
            .is_server_member(server_id, user_id)
            .await
            .map_err(ServiceError::Database)?;

        if !is_member {
            return Err(ServiceError::Forbidden(
                "You are not a member of this server".to_string(),
            ));
        }

        let limit = limit.unwrap_or(50).clamp(1, 100);

        let messages = self
            .repository
            .find_by_channel(channel_id, limit, before)
            .await
            .map_err(ServiceError::Internal)?;

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
            .map_err(ServiceError::Internal)?
            .ok_or(ServiceError::NotFound("Message not found".to_string()))?;

        if message.user_id != user_id {
            return Err(ServiceError::Forbidden(
                "You can only edit your own messages".to_string(),
            ));
        }

        const EDIT_TIME_LIMIT_MINUTES: i64 = 5;

        let elapsed = Utc::now()
            .signed_duration_since(message.created_at)
            .num_minutes();

        if elapsed > EDIT_TIME_LIMIT_MINUTES {
            return Err(ServiceError::Forbidden(format!(
                "Messages can only be edited within {} minutes",
                EDIT_TIME_LIMIT_MINUTES
            )));
        }

        if message.is_deleted() {
            return Err(ServiceError::Forbidden(
                "Cannot edit a deleted message".to_string(),
            ));
        }

        let updated_message = self
            .repository
            .update(message_id, &data)
            .await
            .map_err(ServiceError::Internal)?;

        Ok(updated_message.to_response())
    }

    pub async fn delete_message(
        &self,
        user_id: Uuid,
        message_id: Uuid,
    ) -> Result<(Uuid, Uuid, Uuid), ServiceError> {
        let message = self
            .repository
            .find_by_id(message_id)
            .await
            .map_err(ServiceError::Internal)?
            .ok_or(ServiceError::NotFound("Message not found".to_string()))?;

        if message.is_deleted() {
            return Err(ServiceError::Forbidden(
                "Cannot delete a deleted message".to_string(),
            ));
        }

        let can_delete = if message.user_id == user_id {
            true
        } else {
            let role = self
                .access
                .get_server_role(message.server_id, user_id)
                .await
                .map_err(ServiceError::Database)?;

            matches!(role.as_deref(), Some("owner") | Some("admin"))
        };

        if !can_delete {
            return Err(ServiceError::Forbidden(
                "You don't have permission to delete this message".to_string(),
            ));
        }

        self.repository
            .delete(message_id)
            .await
            .map_err(ServiceError::Internal)?;

        Ok((message.server_id, message.channel_id, message.message_id))
    }
<<<<<<< HEAD
    pub async fn add_reaction(
        &self,
        message_id: Uuid,
        channel_id: Uuid,
        user_id: Uuid,
        emoji: String,
        ws: web::Data<Addr<WsServer>>, // Pour le temps réel
    ) -> Result<(), String> {
        // 1. On enregistre en base de données
        self.repository
            .add_reaction(message_id, user_id, emoji.clone())
            .await
            .map_err(|e| e.to_string())?;

        // 2. On prévient tout le monde via WebSocket
        // Note : On envoie l'événement au serveur/salon concerné
        ws.do_send(ServerEvent::MessageReactionAdded {
            message_id,
            channel_id,
            user_id,
            emoji,
        });

        Ok(())
=======

    pub async fn add_reaction(
        &self,
        user_id: Uuid,
        message_id: Uuid,
        emoji: String,
    ) -> Result<(Uuid, Uuid, Uuid), ServiceError> {
        let message = self
            .repository
            .find_by_id(message_id)
            .await
            .map_err(ServiceError::Internal)?
            .ok_or(ServiceError::NotFound("Message not found".to_string()))?;

        if message.is_deleted() {
            return Err(ServiceError::Forbidden(
                "Cannot react to a deleted message".to_string(),
            ));
        }

        let is_member = self
            .access
            .is_server_member(message.server_id, user_id)
            .await
            .map_err(ServiceError::Database)?;

        if !is_member {
            return Err(ServiceError::Forbidden(
                "You are not a member of this server".to_string(),
            ));
        }

        self.repository
            .add_reaction(message_id, user_id, &emoji)
            .await
            .map_err(ServiceError::Internal)?;

        Ok((message.server_id, message.channel_id, message.message_id))
>>>>>>> main
    }

    pub async fn remove_reaction(
        &self,
<<<<<<< HEAD
        message_id: Uuid,
        channel_id: Uuid,
        user_id: Uuid,
        emoji: String,
        ws: web::Data<Addr<WsServer>>,
    ) -> Result<(), String> {
        // 1. On retire de la base de données
        self.repository
            .remove_reaction(message_id, user_id, emoji.clone())
            .await
            .map_err(|e| e.to_string())?;

        // 2. On prévient via WebSocket
        ws.do_send(ServerEvent::MessageReactionRemoved {
            message_id,
            channel_id,
            user_id,
            emoji,
        });

        Ok(())
=======
        user_id: Uuid,
        message_id: Uuid,
        emoji: String,
    ) -> Result<(Uuid, Uuid, Uuid), ServiceError> {
        let message = self
            .repository
            .find_by_id(message_id)
            .await
            .map_err(ServiceError::Internal)?
            .ok_or(ServiceError::NotFound("Message not found".to_string()))?;

        let is_member = self
            .access
            .is_server_member(message.server_id, user_id)
            .await
            .map_err(ServiceError::Database)?;

        if !is_member {
            return Err(ServiceError::Forbidden(
                "You are not a member of this server".to_string(),
            ));
        }

        self.repository
            .remove_reaction(message_id, user_id, &emoji)
            .await
            .map_err(ServiceError::Internal)?;

        Ok((message.server_id, message.channel_id, message.message_id))
>>>>>>> main
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
    use chrono::TimeZone;
    use std::sync::{
        atomic::{AtomicUsize, Ordering},
        Arc, Mutex,
    };

    fn sample_message(user_id: Uuid, channel_id: Uuid, server_id: Uuid) -> Message {
        Message {
            id: None,
            message_id: Uuid::new_v4(),
            content: "hello".to_string(),
            user_id,
            username: "tester".to_string(),
            channel_id,
            server_id,
            created_at: Utc.with_ymd_and_hms(2026, 2, 8, 12, 0, 0).unwrap(),
            updated_at: None,
            deleted_at: None,
        }
    }

    fn deleted_sample_message(user_id: Uuid, channel_id: Uuid, server_id: Uuid) -> Message {
        let mut m = sample_message(user_id, channel_id, server_id);
        m.deleted_at = Some(Utc.with_ymd_and_hms(2026, 2, 8, 13, 0, 0).unwrap());
        m
    }

    fn edited_sample_message(user_id: Uuid, channel_id: Uuid, server_id: Uuid) -> Message {
        let mut m = sample_message(user_id, channel_id, server_id);
        m.updated_at = Some(Utc.with_ymd_and_hms(2026, 2, 8, 13, 0, 0).unwrap());
        m
    }

    struct FakeMessageRepository {
        create_result: Option<Result<Message, String>>,
        find_by_id_result: Option<Result<Option<Message>, String>>,
        find_by_channel_result: Option<Result<Vec<Message>, String>>,
        update_result: Option<Result<Message, String>>,
        delete_result: Option<Result<(), String>>,
    }

    #[async_trait]
    impl MessageRepositoryTrait for FakeMessageRepository {
        async fn create(
            &self,
            _user_id: Uuid,
            _username: String,
            _server_id: Uuid,
            _data: CreateMessage,
        ) -> Result<Message, String> {
            self.create_result.clone().unwrap()
        }

        async fn find_by_id(&self, _message_id: Uuid) -> Result<Option<Message>, String> {
            self.find_by_id_result.clone().unwrap()
        }

        async fn find_by_channel(
            &self,
            _channel_id: Uuid,
            _limit: i64,
            _before: Option<DateTime<Utc>>,
        ) -> Result<Vec<Message>, String> {
            self.find_by_channel_result.clone().unwrap()
        }

        async fn update(
            &self,
            _message_id: Uuid,
            _data: &UpdateMessage,
        ) -> Result<Message, String> {
            self.update_result.clone().unwrap()
        }

        async fn delete(&self, _message_id: Uuid) -> Result<(), String> {
            self.delete_result.clone().unwrap()
        }
    }

    struct FakeMessageAccess {
        channel_server_result: Option<Result<Option<Uuid>, ()>>,
        membership_and_username_result: Option<Result<(bool, Option<String>), ()>>,
        is_server_member_result: Option<Result<bool, ()>>,
        server_role_result: Option<Result<Option<String>, ()>>,
    }

    #[async_trait]
    impl MessageAccessTrait for FakeMessageAccess {
        async fn get_channel_server(&self, _channel_id: Uuid) -> Result<Option<Uuid>, sqlx::Error> {
            match self.channel_server_result.clone().unwrap() {
                Ok(v) => Ok(v),
                Err(()) => Err(sqlx::Error::RowNotFound),
            }
        }

        async fn get_membership_and_username(
            &self,
            _server_id: Uuid,
            _user_id: Uuid,
        ) -> Result<(bool, Option<String>), sqlx::Error> {
            match self.membership_and_username_result.clone().unwrap() {
                Ok(v) => Ok(v),
                Err(()) => Err(sqlx::Error::RowNotFound),
            }
        }

        async fn is_server_member(
            &self,
            _server_id: Uuid,
            _user_id: Uuid,
        ) -> Result<bool, sqlx::Error> {
            match self.is_server_member_result.clone().unwrap() {
                Ok(v) => Ok(v),
                Err(()) => Err(sqlx::Error::RowNotFound),
            }
        }

        async fn get_server_role(
            &self,
            _server_id: Uuid,
            _user_id: Uuid,
        ) -> Result<Option<String>, sqlx::Error> {
            match self.server_role_result.clone().unwrap() {
                Ok(v) => Ok(v),
                Err(()) => Err(sqlx::Error::RowNotFound),
            }
        }
    }

    #[derive(Default)]
    struct RecordedCreateCall {
        user_id: Option<Uuid>,
        username: Option<String>,
        server_id: Option<Uuid>,
        data: Option<CreateMessage>,
    }

    #[derive(Default, Clone)]
    struct RecordedFindByChannelCall {
        channel_id: Option<Uuid>,
        limit: Option<i64>,
        before: Option<Option<DateTime<Utc>>>,
    }

    #[derive(Default, Clone)]
    struct RecordedUpdateCall {
        message_id: Option<Uuid>,
        content: Option<String>,
    }

    #[derive(Default, Clone)]
    struct RecordedDeleteCall {
        message_id: Option<Uuid>,
    }

    struct RecordingMessageRepository {
        create_result: Result<Message, String>,
        find_by_channel_result: Result<Vec<Message>, String>,
        create_call: Arc<Mutex<RecordedCreateCall>>,
        find_by_channel_call: Arc<Mutex<RecordedFindByChannelCall>>,
    }

    #[async_trait]
    impl MessageRepositoryTrait for RecordingMessageRepository {
        async fn create(
            &self,
            user_id: Uuid,
            username: String,
            server_id: Uuid,
            data: CreateMessage,
        ) -> Result<Message, String> {
            let mut call = self.create_call.lock().unwrap();
            call.user_id = Some(user_id);
            call.username = Some(username);
            call.server_id = Some(server_id);
            call.data = Some(data);

            self.create_result.clone()
        }

        async fn find_by_id(&self, _message_id: Uuid) -> Result<Option<Message>, String> {
            panic!("find_by_id should not be called in this test");
        }

        async fn find_by_channel(
            &self,
            channel_id: Uuid,
            limit: i64,
            before: Option<DateTime<Utc>>,
        ) -> Result<Vec<Message>, String> {
            let mut call = self.find_by_channel_call.lock().unwrap();
            call.channel_id = Some(channel_id);
            call.limit = Some(limit);
            call.before = Some(before);

            self.find_by_channel_result.clone()
        }

        async fn update(
            &self,
            _message_id: Uuid,
            _data: &UpdateMessage,
        ) -> Result<Message, String> {
            panic!("update should not be called in this test");
        }

        async fn delete(&self, _message_id: Uuid) -> Result<(), String> {
            panic!("delete should not be called in this test");
        }
    }

    struct CountingMessageRepository {
        create_calls: Arc<AtomicUsize>,
        find_by_id_calls: Arc<AtomicUsize>,
        find_by_channel_calls: Arc<AtomicUsize>,
        update_calls: Arc<AtomicUsize>,
        delete_calls: Arc<AtomicUsize>,

        create_result: Option<Result<Message, String>>,
        find_by_id_result: Option<Result<Option<Message>, String>>,
        find_by_channel_result: Option<Result<Vec<Message>, String>>,
        update_result: Option<Result<Message, String>>,
        delete_result: Option<Result<(), String>>,
    }

    #[async_trait]
    impl MessageRepositoryTrait for CountingMessageRepository {
        async fn create(
            &self,
            _user_id: Uuid,
            _username: String,
            _server_id: Uuid,
            _data: CreateMessage,
        ) -> Result<Message, String> {
            self.create_calls.fetch_add(1, Ordering::SeqCst);
            self.create_result.clone().unwrap()
        }

        async fn find_by_id(&self, _message_id: Uuid) -> Result<Option<Message>, String> {
            self.find_by_id_calls.fetch_add(1, Ordering::SeqCst);
            self.find_by_id_result.clone().unwrap()
        }

        async fn find_by_channel(
            &self,
            _channel_id: Uuid,
            _limit: i64,
            _before: Option<DateTime<Utc>>,
        ) -> Result<Vec<Message>, String> {
            self.find_by_channel_calls.fetch_add(1, Ordering::SeqCst);
            self.find_by_channel_result.clone().unwrap()
        }

        async fn update(
            &self,
            _message_id: Uuid,
            _data: &UpdateMessage,
        ) -> Result<Message, String> {
            self.update_calls.fetch_add(1, Ordering::SeqCst);
            self.update_result.clone().unwrap()
        }

        async fn delete(&self, _message_id: Uuid) -> Result<(), String> {
            self.delete_calls.fetch_add(1, Ordering::SeqCst);
            self.delete_result.clone().unwrap()
        }
    }

    struct RecordingUpdateDeleteRepository {
        find_by_id_result: Result<Option<Message>, String>,
        update_result: Option<Result<Message, String>>,
        delete_result: Option<Result<(), String>>,
        update_call: Arc<Mutex<RecordedUpdateCall>>,
        delete_call: Arc<Mutex<RecordedDeleteCall>>,
    }

    #[async_trait]
    impl MessageRepositoryTrait for RecordingUpdateDeleteRepository {
        async fn create(
            &self,
            _user_id: Uuid,
            _username: String,
            _server_id: Uuid,
            _data: CreateMessage,
        ) -> Result<Message, String> {
            panic!("create should not be called in this test");
        }

        async fn find_by_id(&self, _message_id: Uuid) -> Result<Option<Message>, String> {
            self.find_by_id_result.clone()
        }

        async fn find_by_channel(
            &self,
            _channel_id: Uuid,
            _limit: i64,
            _before: Option<DateTime<Utc>>,
        ) -> Result<Vec<Message>, String> {
            panic!("find_by_channel should not be called in this test");
        }

        async fn update(&self, message_id: Uuid, data: &UpdateMessage) -> Result<Message, String> {
            let mut call = self.update_call.lock().unwrap();
            call.message_id = Some(message_id);
            call.content = Some(data.content.clone());
            self.update_result.clone().unwrap()
        }

        async fn delete(&self, message_id: Uuid) -> Result<(), String> {
            let mut call = self.delete_call.lock().unwrap();
            call.message_id = Some(message_id);
            self.delete_result.clone().unwrap()
        }
    }

    struct CountingAccess {
        get_channel_server_calls: Arc<AtomicUsize>,
        get_membership_and_username_calls: Arc<AtomicUsize>,
        is_server_member_calls: Arc<AtomicUsize>,
        get_server_role_calls: Arc<AtomicUsize>,

        channel_server_result: Option<Result<Option<Uuid>, ()>>,
        membership_and_username_result: Option<Result<(bool, Option<String>), ()>>,
        is_server_member_result: Option<Result<bool, ()>>,
        server_role_result: Option<Result<Option<String>, ()>>,
    }

    #[async_trait]
    impl MessageAccessTrait for CountingAccess {
        async fn get_channel_server(&self, _channel_id: Uuid) -> Result<Option<Uuid>, sqlx::Error> {
            self.get_channel_server_calls.fetch_add(1, Ordering::SeqCst);
            match self.channel_server_result.clone().unwrap() {
                Ok(v) => Ok(v),
                Err(()) => Err(sqlx::Error::RowNotFound),
            }
        }

        async fn get_membership_and_username(
            &self,
            _server_id: Uuid,
            _user_id: Uuid,
        ) -> Result<(bool, Option<String>), sqlx::Error> {
            self.get_membership_and_username_calls
                .fetch_add(1, Ordering::SeqCst);
            match self.membership_and_username_result.clone().unwrap() {
                Ok(v) => Ok(v),
                Err(()) => Err(sqlx::Error::RowNotFound),
            }
        }

        async fn is_server_member(
            &self,
            _server_id: Uuid,
            _user_id: Uuid,
        ) -> Result<bool, sqlx::Error> {
            self.is_server_member_calls.fetch_add(1, Ordering::SeqCst);
            match self.is_server_member_result.clone().unwrap() {
                Ok(v) => Ok(v),
                Err(()) => Err(sqlx::Error::RowNotFound),
            }
        }

        async fn get_server_role(
            &self,
            _server_id: Uuid,
            _user_id: Uuid,
        ) -> Result<Option<String>, sqlx::Error> {
            self.get_server_role_calls.fetch_add(1, Ordering::SeqCst);
            match self.server_role_result.clone().unwrap() {
                Ok(v) => Ok(v),
                Err(()) => Err(sqlx::Error::RowNotFound),
            }
        }
    }

    fn make_service(
        repository: Arc<dyn MessageRepositoryTrait>,
        access: Arc<dyn MessageAccessTrait>,
    ) -> MessageService {
        MessageService::with_dependencies(repository, access)
    }

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

    #[actix_web::test]
    async fn test_send_message_success() {
        let user_id = Uuid::new_v4();
        let channel_id = Uuid::new_v4();
        let server_id = Uuid::new_v4();

        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(FakeMessageRepository {
            create_result: Some(Ok(sample_message(user_id, channel_id, server_id))),
            find_by_id_result: None,
            find_by_channel_result: None,
            update_result: None,
            delete_result: None,
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: Some(Ok(Some(server_id))),
            membership_and_username_result: Some(Ok((true, Some("tester".to_string())))),
            is_server_member_result: None,
            server_role_result: None,
        });

        let service = make_service(repo, access);

        let result = service
            .send_message(
                user_id,
                CreateMessage {
                    content: "hello".to_string(),
                    channel_id,
                },
            )
            .await
            .unwrap();

        assert_eq!(result.content, "hello");
        assert_eq!(result.user_id, user_id);
        assert_eq!(result.channel_id, channel_id);
        assert_eq!(result.server_id, server_id);
        assert_eq!(result.username, "tester");
        assert!(!result.is_deleted);
        assert!(!result.is_edited);
    }

    #[actix_web::test]
    async fn test_send_message_passes_expected_arguments_to_repository() {
        let user_id = Uuid::new_v4();
        let channel_id = Uuid::new_v4();
        let server_id = Uuid::new_v4();

        let create_call = Arc::new(Mutex::new(RecordedCreateCall::default()));
        let find_by_channel_call = Arc::new(Mutex::new(RecordedFindByChannelCall::default()));

        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(RecordingMessageRepository {
            create_result: Ok(sample_message(user_id, channel_id, server_id)),
            find_by_channel_result: Ok(vec![]),
            create_call: create_call.clone(),
            find_by_channel_call,
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: Some(Ok(Some(server_id))),
            membership_and_username_result: Some(Ok((true, Some("tester".to_string())))),
            is_server_member_result: None,
            server_role_result: None,
        });

        let service = make_service(repo, access);

        let payload = CreateMessage {
            content: "hello world".to_string(),
            channel_id,
        };

        let _ = service.send_message(user_id, payload).await.unwrap();

        let call = create_call.lock().unwrap();
        assert_eq!(call.user_id, Some(user_id));
        assert_eq!(call.username.as_deref(), Some("tester"));
        assert_eq!(call.server_id, Some(server_id));

        let data = call
            .data
            .as_ref()
            .expect("expected CreateMessage to be recorded");
        assert_eq!(data.channel_id, channel_id);
        assert_eq!(data.content, "hello world");
    }

    #[actix_web::test]
    async fn test_send_message_channel_not_found() {
        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(FakeMessageRepository {
            create_result: None,
            find_by_id_result: None,
            find_by_channel_result: None,
            update_result: None,
            delete_result: None,
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: Some(Ok(None)),
            membership_and_username_result: None,
            is_server_member_result: None,
            server_role_result: None,
        });

        let service = make_service(repo, access);

        let err = service
            .send_message(
                Uuid::new_v4(),
                CreateMessage {
                    content: "hello".to_string(),
                    channel_id: Uuid::new_v4(),
                },
            )
            .await
            .unwrap_err();

        assert!(matches!(err, ServiceError::NotFound(msg) if msg == "Channel not found"));
    }

    #[actix_web::test]
    async fn test_send_message_stops_before_repository_when_channel_not_found() {
        let create_calls = Arc::new(AtomicUsize::new(0));
        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(CountingMessageRepository {
            create_calls: create_calls.clone(),
            find_by_id_calls: Arc::new(AtomicUsize::new(0)),
            find_by_channel_calls: Arc::new(AtomicUsize::new(0)),
            update_calls: Arc::new(AtomicUsize::new(0)),
            delete_calls: Arc::new(AtomicUsize::new(0)),
            create_result: Some(Err("should not happen".to_string())),
            find_by_id_result: None,
            find_by_channel_result: None,
            update_result: None,
            delete_result: None,
        });

        let membership_calls = Arc::new(AtomicUsize::new(0));
        let access: Arc<dyn MessageAccessTrait> = Arc::new(CountingAccess {
            get_channel_server_calls: Arc::new(AtomicUsize::new(0)),
            get_membership_and_username_calls: membership_calls.clone(),
            is_server_member_calls: Arc::new(AtomicUsize::new(0)),
            get_server_role_calls: Arc::new(AtomicUsize::new(0)),
            channel_server_result: Some(Ok(None)),
            membership_and_username_result: Some(Ok((true, Some("tester".to_string())))),
            is_server_member_result: Some(Ok(true)),
            server_role_result: Some(Ok(None)),
        });

        let service = make_service(repo, access);

        let _ = service
            .send_message(
                Uuid::new_v4(),
                CreateMessage {
                    content: "hello".to_string(),
                    channel_id: Uuid::new_v4(),
                },
            )
            .await
            .unwrap_err();

        assert_eq!(create_calls.load(Ordering::SeqCst), 0);
        assert_eq!(membership_calls.load(Ordering::SeqCst), 0);
    }

    #[actix_web::test]
    async fn test_send_message_forbidden_when_not_member() {
        let server_id = Uuid::new_v4();

        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(FakeMessageRepository {
            create_result: None,
            find_by_id_result: None,
            find_by_channel_result: None,
            update_result: None,
            delete_result: None,
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: Some(Ok(Some(server_id))),
            membership_and_username_result: Some(Ok((false, Some("tester".to_string())))),
            is_server_member_result: None,
            server_role_result: None,
        });

        let service = make_service(repo, access);

        let err = service
            .send_message(
                Uuid::new_v4(),
                CreateMessage {
                    content: "hello".to_string(),
                    channel_id: Uuid::new_v4(),
                },
            )
            .await
            .unwrap_err();

        assert!(
            matches!(err, ServiceError::Forbidden(msg) if msg == "You are not a member of this server")
        );
    }

    #[actix_web::test]
    async fn test_send_message_does_not_create_when_not_member() {
        let create_calls = Arc::new(AtomicUsize::new(0));
        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(CountingMessageRepository {
            create_calls: create_calls.clone(),
            find_by_id_calls: Arc::new(AtomicUsize::new(0)),
            find_by_channel_calls: Arc::new(AtomicUsize::new(0)),
            update_calls: Arc::new(AtomicUsize::new(0)),
            delete_calls: Arc::new(AtomicUsize::new(0)),
            create_result: Some(Err("should not happen".to_string())),
            find_by_id_result: None,
            find_by_channel_result: None,
            update_result: None,
            delete_result: None,
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: Some(Ok(Some(Uuid::new_v4()))),
            membership_and_username_result: Some(Ok((false, Some("tester".to_string())))),
            is_server_member_result: None,
            server_role_result: None,
        });

        let service = make_service(repo, access);

        let _ = service
            .send_message(
                Uuid::new_v4(),
                CreateMessage {
                    content: "hello".to_string(),
                    channel_id: Uuid::new_v4(),
                },
            )
            .await
            .unwrap_err();

        assert_eq!(create_calls.load(Ordering::SeqCst), 0);
    }

    #[actix_web::test]
    async fn test_send_message_user_not_found() {
        let server_id = Uuid::new_v4();

        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(FakeMessageRepository {
            create_result: None,
            find_by_id_result: None,
            find_by_channel_result: None,
            update_result: None,
            delete_result: None,
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: Some(Ok(Some(server_id))),
            membership_and_username_result: Some(Ok((true, None))),
            is_server_member_result: None,
            server_role_result: None,
        });

        let service = make_service(repo, access);

        let err = service
            .send_message(
                Uuid::new_v4(),
                CreateMessage {
                    content: "hello".to_string(),
                    channel_id: Uuid::new_v4(),
                },
            )
            .await
            .unwrap_err();

        assert!(matches!(err, ServiceError::NotFound(msg) if msg == "User not found"));
    }

    #[actix_web::test]
    async fn test_send_message_does_not_create_when_user_not_found() {
        let create_calls = Arc::new(AtomicUsize::new(0));
        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(CountingMessageRepository {
            create_calls: create_calls.clone(),
            find_by_id_calls: Arc::new(AtomicUsize::new(0)),
            find_by_channel_calls: Arc::new(AtomicUsize::new(0)),
            update_calls: Arc::new(AtomicUsize::new(0)),
            delete_calls: Arc::new(AtomicUsize::new(0)),
            create_result: Some(Err("should not happen".to_string())),
            find_by_id_result: None,
            find_by_channel_result: None,
            update_result: None,
            delete_result: None,
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: Some(Ok(Some(Uuid::new_v4()))),
            membership_and_username_result: Some(Ok((true, None))),
            is_server_member_result: None,
            server_role_result: None,
        });

        let service = make_service(repo, access);

        let _ = service
            .send_message(
                Uuid::new_v4(),
                CreateMessage {
                    content: "hello".to_string(),
                    channel_id: Uuid::new_v4(),
                },
            )
            .await
            .unwrap_err();

        assert_eq!(create_calls.load(Ordering::SeqCst), 0);
    }

    #[actix_web::test]
    async fn test_send_message_repository_error_maps_to_internal() {
        let user_id = Uuid::new_v4();
        let channel_id = Uuid::new_v4();
        let server_id = Uuid::new_v4();

        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(FakeMessageRepository {
            create_result: Some(Err("mongo error".to_string())),
            find_by_id_result: None,
            find_by_channel_result: None,
            update_result: None,
            delete_result: None,
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: Some(Ok(Some(server_id))),
            membership_and_username_result: Some(Ok((true, Some("tester".to_string())))),
            is_server_member_result: None,
            server_role_result: None,
        });

        let service = make_service(repo, access);

        let err = service
            .send_message(
                user_id,
                CreateMessage {
                    content: "hello".to_string(),
                    channel_id,
                },
            )
            .await
            .unwrap_err();

        assert!(matches!(err, ServiceError::Internal(msg) if msg == "mongo error"));
    }

    #[actix_web::test]
    async fn test_send_message_db_error_on_channel_lookup() {
        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(FakeMessageRepository {
            create_result: None,
            find_by_id_result: None,
            find_by_channel_result: None,
            update_result: None,
            delete_result: None,
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: Some(Err(())),
            membership_and_username_result: None,
            is_server_member_result: None,
            server_role_result: None,
        });

        let service = make_service(repo, access);

        let err = service
            .send_message(
                Uuid::new_v4(),
                CreateMessage {
                    content: "hello".to_string(),
                    channel_id: Uuid::new_v4(),
                },
            )
            .await
            .unwrap_err();

        assert!(matches!(err, ServiceError::Database(_)));
    }

    #[actix_web::test]
    async fn test_send_message_db_error_on_membership_lookup() {
        let server_id = Uuid::new_v4();

        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(FakeMessageRepository {
            create_result: None,
            find_by_id_result: None,
            find_by_channel_result: None,
            update_result: None,
            delete_result: None,
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: Some(Ok(Some(server_id))),
            membership_and_username_result: Some(Err(())),
            is_server_member_result: None,
            server_role_result: None,
        });

        let service = make_service(repo, access);

        let err = service
            .send_message(
                Uuid::new_v4(),
                CreateMessage {
                    content: "hello".to_string(),
                    channel_id: Uuid::new_v4(),
                },
            )
            .await
            .unwrap_err();

        assert!(matches!(err, ServiceError::Database(_)));
    }

    #[actix_web::test]
    async fn test_get_messages_success_and_limit_clamped() {
        let user_id = Uuid::new_v4();
        let channel_id = Uuid::new_v4();
        let server_id = Uuid::new_v4();

        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(FakeMessageRepository {
            create_result: None,
            find_by_id_result: None,
            find_by_channel_result: Some(Ok(vec![
                sample_message(user_id, channel_id, server_id),
                sample_message(user_id, channel_id, server_id),
            ])),
            update_result: None,
            delete_result: None,
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: Some(Ok(Some(server_id))),
            membership_and_username_result: None,
            is_server_member_result: Some(Ok(true)),
            server_role_result: None,
        });

        let service = make_service(repo, access);

        let result = service
            .get_messages(user_id, channel_id, Some(500), None)
            .await
            .unwrap();

        assert_eq!(result.len(), 2);
    }

    #[actix_web::test]
    async fn test_get_messages_maps_response_flags() {
        let user_id = Uuid::new_v4();
        let channel_id = Uuid::new_v4();
        let server_id = Uuid::new_v4();

        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(FakeMessageRepository {
            create_result: None,
            find_by_id_result: None,
            find_by_channel_result: Some(Ok(vec![
                edited_sample_message(user_id, channel_id, server_id),
                deleted_sample_message(user_id, channel_id, server_id),
            ])),
            update_result: None,
            delete_result: None,
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: Some(Ok(Some(server_id))),
            membership_and_username_result: None,
            is_server_member_result: Some(Ok(true)),
            server_role_result: None,
        });

        let service = make_service(repo, access);

        let result = service
            .get_messages(user_id, channel_id, Some(10), None)
            .await
            .unwrap();

        assert_eq!(result.len(), 2);
        assert!(result[0].is_edited);
        assert!(!result[0].is_deleted);
        assert!(!result[1].is_edited);
        assert!(result[1].is_deleted);
    }

    #[actix_web::test]
    async fn test_get_messages_uses_default_limit_when_none() {
        let user_id = Uuid::new_v4();
        let channel_id = Uuid::new_v4();
        let server_id = Uuid::new_v4();

        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(FakeMessageRepository {
            create_result: None,
            find_by_id_result: None,
            find_by_channel_result: Some(Ok(vec![sample_message(user_id, channel_id, server_id)])),
            update_result: None,
            delete_result: None,
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: Some(Ok(Some(server_id))),
            membership_and_username_result: None,
            is_server_member_result: Some(Ok(true)),
            server_role_result: None,
        });

        let service = make_service(repo, access);

        let result = service
            .get_messages(user_id, channel_id, None, None)
            .await
            .unwrap();

        assert_eq!(result.len(), 1);
    }

    #[actix_web::test]
    async fn test_get_messages_clamps_limit_to_min_1() {
        let user_id = Uuid::new_v4();
        let channel_id = Uuid::new_v4();
        let server_id = Uuid::new_v4();

        let create_call = Arc::new(Mutex::new(RecordedCreateCall::default()));
        let find_by_channel_call = Arc::new(Mutex::new(RecordedFindByChannelCall::default()));

        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(RecordingMessageRepository {
            create_result: Err("unused".to_string()),
            find_by_channel_result: Ok(vec![]),
            create_call,
            find_by_channel_call: find_by_channel_call.clone(),
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: Some(Ok(Some(server_id))),
            membership_and_username_result: None,
            is_server_member_result: Some(Ok(true)),
            server_role_result: None,
        });

        let service = make_service(repo, access);

        let _ = service
            .get_messages(user_id, channel_id, Some(0), None)
            .await
            .unwrap();

        let call = find_by_channel_call.lock().unwrap().clone();
        assert_eq!(call.channel_id, Some(channel_id));
        assert_eq!(call.limit, Some(1));
    }

    #[actix_web::test]
    async fn test_get_messages_accepts_exact_limit_1() {
        let user_id = Uuid::new_v4();
        let channel_id = Uuid::new_v4();
        let server_id = Uuid::new_v4();

        let create_call = Arc::new(Mutex::new(RecordedCreateCall::default()));
        let find_by_channel_call = Arc::new(Mutex::new(RecordedFindByChannelCall::default()));

        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(RecordingMessageRepository {
            create_result: Err("unused".to_string()),
            find_by_channel_result: Ok(vec![]),
            create_call,
            find_by_channel_call: find_by_channel_call.clone(),
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: Some(Ok(Some(server_id))),
            membership_and_username_result: None,
            is_server_member_result: Some(Ok(true)),
            server_role_result: None,
        });

        let service = make_service(repo, access);

        let _ = service
            .get_messages(user_id, channel_id, Some(1), None)
            .await
            .unwrap();

        let call = find_by_channel_call.lock().unwrap().clone();
        assert_eq!(call.limit, Some(1));
    }

    #[actix_web::test]
    async fn test_get_messages_accepts_exact_limit_100() {
        let user_id = Uuid::new_v4();
        let channel_id = Uuid::new_v4();
        let server_id = Uuid::new_v4();

        let create_call = Arc::new(Mutex::new(RecordedCreateCall::default()));
        let find_by_channel_call = Arc::new(Mutex::new(RecordedFindByChannelCall::default()));

        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(RecordingMessageRepository {
            create_result: Err("unused".to_string()),
            find_by_channel_result: Ok(vec![]),
            create_call,
            find_by_channel_call: find_by_channel_call.clone(),
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: Some(Ok(Some(server_id))),
            membership_and_username_result: None,
            is_server_member_result: Some(Ok(true)),
            server_role_result: None,
        });

        let service = make_service(repo, access);

        let _ = service
            .get_messages(user_id, channel_id, Some(100), None)
            .await
            .unwrap();

        let call = find_by_channel_call.lock().unwrap().clone();
        assert_eq!(call.limit, Some(100));
    }

    #[actix_web::test]
    async fn test_get_messages_passes_default_limit_50_to_repository() {
        let user_id = Uuid::new_v4();
        let channel_id = Uuid::new_v4();
        let server_id = Uuid::new_v4();

        let create_call = Arc::new(Mutex::new(RecordedCreateCall::default()));
        let find_by_channel_call = Arc::new(Mutex::new(RecordedFindByChannelCall::default()));

        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(RecordingMessageRepository {
            create_result: Err("unused".to_string()),
            find_by_channel_result: Ok(vec![]),
            create_call,
            find_by_channel_call: find_by_channel_call.clone(),
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: Some(Ok(Some(server_id))),
            membership_and_username_result: None,
            is_server_member_result: Some(Ok(true)),
            server_role_result: None,
        });

        let service = make_service(repo, access);

        let _ = service
            .get_messages(user_id, channel_id, None, None)
            .await
            .unwrap();

        let call = find_by_channel_call.lock().unwrap().clone();
        assert_eq!(call.limit, Some(50));
    }

    #[actix_web::test]
    async fn test_get_messages_passes_before_to_repository() {
        let user_id = Uuid::new_v4();
        let channel_id = Uuid::new_v4();
        let server_id = Uuid::new_v4();
        let before = Utc.with_ymd_and_hms(2026, 3, 1, 10, 30, 0).unwrap();

        let create_call = Arc::new(Mutex::new(RecordedCreateCall::default()));
        let find_by_channel_call = Arc::new(Mutex::new(RecordedFindByChannelCall::default()));

        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(RecordingMessageRepository {
            create_result: Err("unused".to_string()),
            find_by_channel_result: Ok(vec![]),
            create_call,
            find_by_channel_call: find_by_channel_call.clone(),
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: Some(Ok(Some(server_id))),
            membership_and_username_result: None,
            is_server_member_result: Some(Ok(true)),
            server_role_result: None,
        });

        let service = make_service(repo, access);

        let _ = service
            .get_messages(user_id, channel_id, Some(25), Some(before))
            .await
            .unwrap();

        let call = find_by_channel_call.lock().unwrap().clone();
        assert_eq!(call.channel_id, Some(channel_id));
        assert_eq!(call.limit, Some(25));
        assert_eq!(call.before, Some(Some(before)));
    }

    #[actix_web::test]
    async fn test_get_messages_channel_not_found() {
        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(FakeMessageRepository {
            create_result: None,
            find_by_id_result: None,
            find_by_channel_result: None,
            update_result: None,
            delete_result: None,
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: Some(Ok(None)),
            membership_and_username_result: None,
            is_server_member_result: None,
            server_role_result: None,
        });

        let service = make_service(repo, access);

        let err = service
            .get_messages(Uuid::new_v4(), Uuid::new_v4(), Some(10), None)
            .await
            .unwrap_err();

        assert!(matches!(err, ServiceError::NotFound(msg) if msg == "Channel not found"));
    }

    #[actix_web::test]
    async fn test_get_messages_does_not_query_messages_when_channel_not_found() {
        let find_by_channel_calls = Arc::new(AtomicUsize::new(0));
        let membership_calls = Arc::new(AtomicUsize::new(0));

        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(CountingMessageRepository {
            create_calls: Arc::new(AtomicUsize::new(0)),
            find_by_id_calls: Arc::new(AtomicUsize::new(0)),
            find_by_channel_calls: find_by_channel_calls.clone(),
            update_calls: Arc::new(AtomicUsize::new(0)),
            delete_calls: Arc::new(AtomicUsize::new(0)),
            create_result: None,
            find_by_id_result: None,
            find_by_channel_result: Some(Ok(vec![])),
            update_result: None,
            delete_result: None,
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(CountingAccess {
            get_channel_server_calls: Arc::new(AtomicUsize::new(0)),
            get_membership_and_username_calls: Arc::new(AtomicUsize::new(0)),
            is_server_member_calls: membership_calls.clone(),
            get_server_role_calls: Arc::new(AtomicUsize::new(0)),
            channel_server_result: Some(Ok(None)),
            membership_and_username_result: Some(Ok((true, Some("tester".to_string())))),
            is_server_member_result: Some(Ok(true)),
            server_role_result: Some(Ok(None)),
        });

        let service = make_service(repo, access);

        let _ = service
            .get_messages(Uuid::new_v4(), Uuid::new_v4(), Some(10), None)
            .await
            .unwrap_err();

        assert_eq!(find_by_channel_calls.load(Ordering::SeqCst), 0);
        assert_eq!(membership_calls.load(Ordering::SeqCst), 0);
    }

    #[actix_web::test]
    async fn test_get_messages_forbidden_when_not_member() {
        let server_id = Uuid::new_v4();

        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(FakeMessageRepository {
            create_result: None,
            find_by_id_result: None,
            find_by_channel_result: None,
            update_result: None,
            delete_result: None,
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: Some(Ok(Some(server_id))),
            membership_and_username_result: None,
            is_server_member_result: Some(Ok(false)),
            server_role_result: None,
        });

        let service = make_service(repo, access);

        let err = service
            .get_messages(Uuid::new_v4(), Uuid::new_v4(), Some(10), None)
            .await
            .unwrap_err();

        assert!(
            matches!(err, ServiceError::Forbidden(msg) if msg == "You are not a member of this server")
        );
    }

    #[actix_web::test]
    async fn test_get_messages_does_not_query_messages_when_not_member() {
        let find_by_channel_calls = Arc::new(AtomicUsize::new(0));

        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(CountingMessageRepository {
            create_calls: Arc::new(AtomicUsize::new(0)),
            find_by_id_calls: Arc::new(AtomicUsize::new(0)),
            find_by_channel_calls: find_by_channel_calls.clone(),
            update_calls: Arc::new(AtomicUsize::new(0)),
            delete_calls: Arc::new(AtomicUsize::new(0)),
            create_result: None,
            find_by_id_result: None,
            find_by_channel_result: Some(Ok(vec![])),
            update_result: None,
            delete_result: None,
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: Some(Ok(Some(Uuid::new_v4()))),
            membership_and_username_result: None,
            is_server_member_result: Some(Ok(false)),
            server_role_result: None,
        });

        let service = make_service(repo, access);

        let _ = service
            .get_messages(Uuid::new_v4(), Uuid::new_v4(), Some(10), None)
            .await
            .unwrap_err();

        assert_eq!(find_by_channel_calls.load(Ordering::SeqCst), 0);
    }

    #[actix_web::test]
    async fn test_get_messages_db_error_on_channel_lookup() {
        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(FakeMessageRepository {
            create_result: None,
            find_by_id_result: None,
            find_by_channel_result: None,
            update_result: None,
            delete_result: None,
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: Some(Err(())),
            membership_and_username_result: None,
            is_server_member_result: None,
            server_role_result: None,
        });

        let service = make_service(repo, access);

        let err = service
            .get_messages(Uuid::new_v4(), Uuid::new_v4(), Some(10), None)
            .await
            .unwrap_err();

        assert!(matches!(err, ServiceError::Database(_)));
    }

    #[actix_web::test]
    async fn test_get_messages_db_error_on_membership_check() {
        let server_id = Uuid::new_v4();

        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(FakeMessageRepository {
            create_result: None,
            find_by_id_result: None,
            find_by_channel_result: None,
            update_result: None,
            delete_result: None,
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: Some(Ok(Some(server_id))),
            membership_and_username_result: None,
            is_server_member_result: Some(Err(())),
            server_role_result: None,
        });

        let service = make_service(repo, access);

        let err = service
            .get_messages(Uuid::new_v4(), Uuid::new_v4(), Some(10), None)
            .await
            .unwrap_err();

        assert!(matches!(err, ServiceError::Database(_)));
    }

    #[actix_web::test]
    async fn test_get_messages_repository_error_maps_to_internal() {
        let server_id = Uuid::new_v4();

        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(FakeMessageRepository {
            create_result: None,
            find_by_id_result: None,
            find_by_channel_result: Some(Err("mongo fail".to_string())),
            update_result: None,
            delete_result: None,
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: Some(Ok(Some(server_id))),
            membership_and_username_result: None,
            is_server_member_result: Some(Ok(true)),
            server_role_result: None,
        });

        let service = make_service(repo, access);

        let err = service
            .get_messages(Uuid::new_v4(), Uuid::new_v4(), Some(10), None)
            .await
            .unwrap_err();

        assert!(matches!(err, ServiceError::Internal(msg) if msg == "mongo fail"));
    }

    #[actix_web::test]
    async fn test_update_message_success() {
        let user_id = Uuid::new_v4();
        let channel_id = Uuid::new_v4();
        let server_id = Uuid::new_v4();

        let original = sample_message(user_id, channel_id, server_id);
        let mut updated = original.clone();
        updated.content = "edited".to_string();
        updated.updated_at = Some(Utc::now());

        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(FakeMessageRepository {
            create_result: None,
            find_by_id_result: Some(Ok(Some(original))),
            find_by_channel_result: None,
            update_result: Some(Ok(updated)),
            delete_result: None,
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: None,
            membership_and_username_result: None,
            is_server_member_result: None,
            server_role_result: None,
        });

        let service = make_service(repo, access);

        let result = service
            .update_message(
                user_id,
                Uuid::new_v4(),
                UpdateMessage {
                    content: "edited".to_string(),
                },
            )
            .await
            .unwrap();

        assert_eq!(result.content, "edited");
        assert!(result.is_edited);
    }

    #[actix_web::test]
    async fn test_update_message_passes_expected_arguments_to_repository() {
        let user_id = Uuid::new_v4();
        let message_id = Uuid::new_v4();
        let original = sample_message(user_id, Uuid::new_v4(), Uuid::new_v4());

        let update_call = Arc::new(Mutex::new(RecordedUpdateCall::default()));
        let delete_call = Arc::new(Mutex::new(RecordedDeleteCall::default()));

        let mut updated = original.clone();
        updated.content = "edited".to_string();
        updated.updated_at = Some(Utc::now());

        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(RecordingUpdateDeleteRepository {
            find_by_id_result: Ok(Some(original)),
            update_result: Some(Ok(updated)),
            delete_result: None,
            update_call: update_call.clone(),
            delete_call,
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: None,
            membership_and_username_result: None,
            is_server_member_result: None,
            server_role_result: None,
        });

        let service = make_service(repo, access);

        let _ = service
            .update_message(
                user_id,
                message_id,
                UpdateMessage {
                    content: "edited".to_string(),
                },
            )
            .await
            .unwrap();

        let call = update_call.lock().unwrap().clone();
        assert_eq!(call.message_id, Some(message_id));
        assert_eq!(call.content.as_deref(), Some("edited"));
    }

    #[actix_web::test]
    async fn test_update_message_not_found() {
        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(FakeMessageRepository {
            create_result: None,
            find_by_id_result: Some(Ok(None)),
            find_by_channel_result: None,
            update_result: None,
            delete_result: None,
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: None,
            membership_and_username_result: None,
            is_server_member_result: None,
            server_role_result: None,
        });

        let service = make_service(repo, access);

        let err = service
            .update_message(
                Uuid::new_v4(),
                Uuid::new_v4(),
                UpdateMessage {
                    content: "edited".to_string(),
                },
            )
            .await
            .unwrap_err();

        assert!(matches!(err, ServiceError::NotFound(msg) if msg == "Message not found"));
    }

    #[actix_web::test]
    async fn test_update_message_does_not_call_update_when_not_found() {
        let update_calls = Arc::new(AtomicUsize::new(0));
        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(CountingMessageRepository {
            create_calls: Arc::new(AtomicUsize::new(0)),
            find_by_id_calls: Arc::new(AtomicUsize::new(0)),
            find_by_channel_calls: Arc::new(AtomicUsize::new(0)),
            update_calls: update_calls.clone(),
            delete_calls: Arc::new(AtomicUsize::new(0)),
            create_result: None,
            find_by_id_result: Some(Ok(None)),
            find_by_channel_result: None,
            update_result: Some(Err("should not happen".to_string())),
            delete_result: None,
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: None,
            membership_and_username_result: None,
            is_server_member_result: None,
            server_role_result: None,
        });

        let service = make_service(repo, access);

        let _ = service
            .update_message(
                Uuid::new_v4(),
                Uuid::new_v4(),
                UpdateMessage {
                    content: "edited".to_string(),
                },
            )
            .await
            .unwrap_err();

        assert_eq!(update_calls.load(Ordering::SeqCst), 0);
    }

    #[actix_web::test]
    async fn test_update_message_forbidden_for_other_user() {
        let owner_id = Uuid::new_v4();
        let editor_id = Uuid::new_v4();
        let message = sample_message(owner_id, Uuid::new_v4(), Uuid::new_v4());

        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(FakeMessageRepository {
            create_result: None,
            find_by_id_result: Some(Ok(Some(message))),
            find_by_channel_result: None,
            update_result: None,
            delete_result: None,
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: None,
            membership_and_username_result: None,
            is_server_member_result: None,
            server_role_result: None,
        });

        let service = make_service(repo, access);

        let err = service
            .update_message(
                editor_id,
                Uuid::new_v4(),
                UpdateMessage {
                    content: "edited".to_string(),
                },
            )
            .await
            .unwrap_err();

        assert!(
            matches!(err, ServiceError::Forbidden(msg) if msg == "You can only edit your own messages")
        );
    }

    #[actix_web::test]
    async fn test_update_message_does_not_call_update_for_other_user() {
        let update_calls = Arc::new(AtomicUsize::new(0));
        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(CountingMessageRepository {
            create_calls: Arc::new(AtomicUsize::new(0)),
            find_by_id_calls: Arc::new(AtomicUsize::new(0)),
            find_by_channel_calls: Arc::new(AtomicUsize::new(0)),
            update_calls: update_calls.clone(),
            delete_calls: Arc::new(AtomicUsize::new(0)),
            create_result: None,
            find_by_id_result: Some(Ok(Some(sample_message(
                Uuid::new_v4(),
                Uuid::new_v4(),
                Uuid::new_v4(),
            )))),
            find_by_channel_result: None,
            update_result: Some(Err("should not happen".to_string())),
            delete_result: None,
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: None,
            membership_and_username_result: None,
            is_server_member_result: None,
            server_role_result: None,
        });

        let service = make_service(repo, access);

        let _ = service
            .update_message(
                Uuid::new_v4(),
                Uuid::new_v4(),
                UpdateMessage {
                    content: "edited".to_string(),
                },
            )
            .await
            .unwrap_err();

        assert_eq!(update_calls.load(Ordering::SeqCst), 0);
    }

    #[actix_web::test]
    async fn test_update_message_forbidden_when_deleted() {
        let user_id = Uuid::new_v4();
        let mut message = sample_message(user_id, Uuid::new_v4(), Uuid::new_v4());
        message.deleted_at = Some(Utc::now());

        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(FakeMessageRepository {
            create_result: None,
            find_by_id_result: Some(Ok(Some(message))),
            find_by_channel_result: None,
            update_result: None,
            delete_result: None,
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: None,
            membership_and_username_result: None,
            is_server_member_result: None,
            server_role_result: None,
        });

        let service = make_service(repo, access);

        let err = service
            .update_message(
                user_id,
                Uuid::new_v4(),
                UpdateMessage {
                    content: "edited".to_string(),
                },
            )
            .await
            .unwrap_err();

        assert!(
            matches!(err, ServiceError::Forbidden(msg) if msg == "Cannot edit a deleted message")
        );
    }

    #[actix_web::test]
    async fn test_update_message_does_not_call_update_when_deleted() {
        let user_id = Uuid::new_v4();
        let mut message = sample_message(user_id, Uuid::new_v4(), Uuid::new_v4());
        message.deleted_at = Some(Utc::now());

        let update_calls = Arc::new(AtomicUsize::new(0));
        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(CountingMessageRepository {
            create_calls: Arc::new(AtomicUsize::new(0)),
            find_by_id_calls: Arc::new(AtomicUsize::new(0)),
            find_by_channel_calls: Arc::new(AtomicUsize::new(0)),
            update_calls: update_calls.clone(),
            delete_calls: Arc::new(AtomicUsize::new(0)),
            create_result: None,
            find_by_id_result: Some(Ok(Some(message))),
            find_by_channel_result: None,
            update_result: Some(Err("should not happen".to_string())),
            delete_result: None,
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: None,
            membership_and_username_result: None,
            is_server_member_result: None,
            server_role_result: None,
        });

        let service = make_service(repo, access);

        let _ = service
            .update_message(
                user_id,
                Uuid::new_v4(),
                UpdateMessage {
                    content: "edited".to_string(),
                },
            )
            .await
            .unwrap_err();

        assert_eq!(update_calls.load(Ordering::SeqCst), 0);
    }

    #[actix_web::test]
    async fn test_update_message_repository_find_error_maps_to_internal() {
        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(FakeMessageRepository {
            create_result: None,
            find_by_id_result: Some(Err("find failed".to_string())),
            find_by_channel_result: None,
            update_result: None,
            delete_result: None,
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: None,
            membership_and_username_result: None,
            is_server_member_result: None,
            server_role_result: None,
        });

        let service = make_service(repo, access);

        let err = service
            .update_message(
                Uuid::new_v4(),
                Uuid::new_v4(),
                UpdateMessage {
                    content: "edited".to_string(),
                },
            )
            .await
            .unwrap_err();

        assert!(matches!(err, ServiceError::Internal(msg) if msg == "find failed"));
    }

    #[actix_web::test]
    async fn test_update_message_repository_update_error_maps_to_internal() {
        let user_id = Uuid::new_v4();
        let message = sample_message(user_id, Uuid::new_v4(), Uuid::new_v4());

        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(FakeMessageRepository {
            create_result: None,
            find_by_id_result: Some(Ok(Some(message))),
            find_by_channel_result: None,
            update_result: Some(Err("update failed".to_string())),
            delete_result: None,
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: None,
            membership_and_username_result: None,
            is_server_member_result: None,
            server_role_result: None,
        });

        let service = make_service(repo, access);

        let err = service
            .update_message(
                user_id,
                Uuid::new_v4(),
                UpdateMessage {
                    content: "edited".to_string(),
                },
            )
            .await
            .unwrap_err();

        assert!(matches!(err, ServiceError::Internal(msg) if msg == "update failed"));
    }

    #[actix_web::test]
    async fn test_delete_message_success_for_owner() {
        let user_id = Uuid::new_v4();
        let channel_id = Uuid::new_v4();
        let server_id = Uuid::new_v4();
        let message = sample_message(user_id, channel_id, server_id);

        let expected_message_id = message.message_id;

        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(FakeMessageRepository {
            create_result: None,
            find_by_id_result: Some(Ok(Some(message))),
            find_by_channel_result: None,
            update_result: None,
            delete_result: Some(Ok(())),
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: None,
            membership_and_username_result: None,
            is_server_member_result: None,
            server_role_result: None,
        });

        let service = make_service(repo, access);

        let result = service
            .delete_message(user_id, Uuid::new_v4())
            .await
            .unwrap();

        assert_eq!(result, (server_id, channel_id, expected_message_id));
    }

    #[actix_web::test]
    async fn test_delete_message_owner_does_not_lookup_role() {
        let role_calls = Arc::new(AtomicUsize::new(0));

        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(FakeMessageRepository {
            create_result: None,
            find_by_id_result: Some(Ok(Some(sample_message(
                Uuid::new_v4(),
                Uuid::new_v4(),
                Uuid::new_v4(),
            )))),
            find_by_channel_result: None,
            update_result: None,
            delete_result: Some(Ok(())),
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(CountingAccess {
            get_channel_server_calls: Arc::new(AtomicUsize::new(0)),
            get_membership_and_username_calls: Arc::new(AtomicUsize::new(0)),
            is_server_member_calls: Arc::new(AtomicUsize::new(0)),
            get_server_role_calls: role_calls.clone(),
            channel_server_result: Some(Ok(None)),
            membership_and_username_result: Some(Ok((true, Some("tester".to_string())))),
            is_server_member_result: Some(Ok(true)),
            server_role_result: Some(Ok(Some("admin".to_string()))),
        });

        let message = sample_message(Uuid::new_v4(), Uuid::new_v4(), Uuid::new_v4());
        let owner_id = message.user_id;

        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(FakeMessageRepository {
            create_result: None,
            find_by_id_result: Some(Ok(Some(message))),
            find_by_channel_result: None,
            update_result: None,
            delete_result: Some(Ok(())),
        });

        let service = make_service(repo, access);

        let _ = service
            .delete_message(owner_id, Uuid::new_v4())
            .await
            .unwrap();

        assert_eq!(role_calls.load(Ordering::SeqCst), 0);
    }

    #[actix_web::test]
    async fn test_delete_message_success_for_admin() {
        let owner_id = Uuid::new_v4();
        let admin_id = Uuid::new_v4();
        let channel_id = Uuid::new_v4();
        let server_id = Uuid::new_v4();
        let message = sample_message(owner_id, channel_id, server_id);

        let expected_message_id = message.message_id;

        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(FakeMessageRepository {
            create_result: None,
            find_by_id_result: Some(Ok(Some(message))),
            find_by_channel_result: None,
            update_result: None,
            delete_result: Some(Ok(())),
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: None,
            membership_and_username_result: None,
            is_server_member_result: None,
            server_role_result: Some(Ok(Some("admin".to_string()))),
        });

        let service = make_service(repo, access);

        let result = service
            .delete_message(admin_id, Uuid::new_v4())
            .await
            .unwrap();

        assert_eq!(result, (server_id, channel_id, expected_message_id));
    }

    #[actix_web::test]
    async fn test_delete_message_admin_looks_up_role_once() {
        let role_calls = Arc::new(AtomicUsize::new(0));
        let owner_id = Uuid::new_v4();
        let other_user_id = Uuid::new_v4();

        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(FakeMessageRepository {
            create_result: None,
            find_by_id_result: Some(Ok(Some(sample_message(
                owner_id,
                Uuid::new_v4(),
                Uuid::new_v4(),
            )))),
            find_by_channel_result: None,
            update_result: None,
            delete_result: Some(Ok(())),
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(CountingAccess {
            get_channel_server_calls: Arc::new(AtomicUsize::new(0)),
            get_membership_and_username_calls: Arc::new(AtomicUsize::new(0)),
            is_server_member_calls: Arc::new(AtomicUsize::new(0)),
            get_server_role_calls: role_calls.clone(),
            channel_server_result: Some(Ok(None)),
            membership_and_username_result: Some(Ok((true, Some("tester".to_string())))),
            is_server_member_result: Some(Ok(true)),
            server_role_result: Some(Ok(Some("admin".to_string()))),
        });

        let service = make_service(repo, access);

        let _ = service
            .delete_message(other_user_id, Uuid::new_v4())
            .await
            .unwrap();

        assert_eq!(role_calls.load(Ordering::SeqCst), 1);
    }

    #[actix_web::test]
    async fn test_delete_message_success_for_owner_role() {
        let owner_id = Uuid::new_v4();
        let moderator_id = Uuid::new_v4();
        let channel_id = Uuid::new_v4();
        let server_id = Uuid::new_v4();
        let message = sample_message(owner_id, channel_id, server_id);
        let expected_message_id = message.message_id;

        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(FakeMessageRepository {
            create_result: None,
            find_by_id_result: Some(Ok(Some(message))),
            find_by_channel_result: None,
            update_result: None,
            delete_result: Some(Ok(())),
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: None,
            membership_and_username_result: None,
            is_server_member_result: None,
            server_role_result: Some(Ok(Some("owner".to_string()))),
        });

        let service = make_service(repo, access);

        let result = service
            .delete_message(moderator_id, Uuid::new_v4())
            .await
            .unwrap();

        assert_eq!(result, (server_id, channel_id, expected_message_id));
    }

    #[actix_web::test]
    async fn test_delete_message_passes_expected_message_id_to_repository() {
        let owner_id = Uuid::new_v4();
        let actor_id = owner_id;
        let message_id = Uuid::new_v4();
        let message = sample_message(owner_id, Uuid::new_v4(), Uuid::new_v4());

        let update_call = Arc::new(Mutex::new(RecordedUpdateCall::default()));
        let delete_call = Arc::new(Mutex::new(RecordedDeleteCall::default()));

        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(RecordingUpdateDeleteRepository {
            find_by_id_result: Ok(Some(message)),
            update_result: None,
            delete_result: Some(Ok(())),
            update_call,
            delete_call: delete_call.clone(),
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: None,
            membership_and_username_result: None,
            is_server_member_result: None,
            server_role_result: None,
        });

        let service = make_service(repo, access);

        let _ = service.delete_message(actor_id, message_id).await.unwrap();

        let call = delete_call.lock().unwrap().clone();
        assert_eq!(call.message_id, Some(message_id));
    }

    #[actix_web::test]
    async fn test_delete_message_not_found() {
        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(FakeMessageRepository {
            create_result: None,
            find_by_id_result: Some(Ok(None)),
            find_by_channel_result: None,
            update_result: None,
            delete_result: None,
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: None,
            membership_and_username_result: None,
            is_server_member_result: None,
            server_role_result: None,
        });

        let service = make_service(repo, access);

        let err = service
            .delete_message(Uuid::new_v4(), Uuid::new_v4())
            .await
            .unwrap_err();

        assert!(matches!(err, ServiceError::NotFound(msg) if msg == "Message not found"));
    }

    #[actix_web::test]
    async fn test_delete_message_does_not_call_delete_when_not_found() {
        let delete_calls = Arc::new(AtomicUsize::new(0));
        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(CountingMessageRepository {
            create_calls: Arc::new(AtomicUsize::new(0)),
            find_by_id_calls: Arc::new(AtomicUsize::new(0)),
            find_by_channel_calls: Arc::new(AtomicUsize::new(0)),
            update_calls: Arc::new(AtomicUsize::new(0)),
            delete_calls: delete_calls.clone(),
            create_result: None,
            find_by_id_result: Some(Ok(None)),
            find_by_channel_result: None,
            update_result: None,
            delete_result: Some(Err("should not happen".to_string())),
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: None,
            membership_and_username_result: None,
            is_server_member_result: None,
            server_role_result: None,
        });

        let service = make_service(repo, access);

        let _ = service
            .delete_message(Uuid::new_v4(), Uuid::new_v4())
            .await
            .unwrap_err();

        assert_eq!(delete_calls.load(Ordering::SeqCst), 0);
    }

    #[actix_web::test]
    async fn test_delete_message_forbidden_when_already_deleted() {
        let user_id = Uuid::new_v4();
        let mut message = sample_message(user_id, Uuid::new_v4(), Uuid::new_v4());
        message.deleted_at = Some(Utc::now());

        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(FakeMessageRepository {
            create_result: None,
            find_by_id_result: Some(Ok(Some(message))),
            find_by_channel_result: None,
            update_result: None,
            delete_result: None,
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: None,
            membership_and_username_result: None,
            is_server_member_result: None,
            server_role_result: None,
        });

        let service = make_service(repo, access);

        let err = service
            .delete_message(user_id, Uuid::new_v4())
            .await
            .unwrap_err();

        assert!(
            matches!(err, ServiceError::Forbidden(msg) if msg == "Cannot delete a deleted message")
        );
    }

    #[actix_web::test]
    async fn test_delete_message_does_not_call_delete_when_already_deleted() {
        let user_id = Uuid::new_v4();
        let mut message = sample_message(user_id, Uuid::new_v4(), Uuid::new_v4());
        message.deleted_at = Some(Utc::now());

        let delete_calls = Arc::new(AtomicUsize::new(0));
        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(CountingMessageRepository {
            create_calls: Arc::new(AtomicUsize::new(0)),
            find_by_id_calls: Arc::new(AtomicUsize::new(0)),
            find_by_channel_calls: Arc::new(AtomicUsize::new(0)),
            update_calls: Arc::new(AtomicUsize::new(0)),
            delete_calls: delete_calls.clone(),
            create_result: None,
            find_by_id_result: Some(Ok(Some(message))),
            find_by_channel_result: None,
            update_result: None,
            delete_result: Some(Err("should not happen".to_string())),
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: None,
            membership_and_username_result: None,
            is_server_member_result: None,
            server_role_result: None,
        });

        let service = make_service(repo, access);

        let _ = service
            .delete_message(user_id, Uuid::new_v4())
            .await
            .unwrap_err();

        assert_eq!(delete_calls.load(Ordering::SeqCst), 0);
    }

    #[actix_web::test]
    async fn test_delete_message_forbidden_without_permission() {
        let owner_id = Uuid::new_v4();
        let other_user_id = Uuid::new_v4();
        let message = sample_message(owner_id, Uuid::new_v4(), Uuid::new_v4());

        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(FakeMessageRepository {
            create_result: None,
            find_by_id_result: Some(Ok(Some(message))),
            find_by_channel_result: None,
            update_result: None,
            delete_result: None,
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: None,
            membership_and_username_result: None,
            is_server_member_result: None,
            server_role_result: Some(Ok(None)),
        });

        let service = make_service(repo, access);

        let err = service
            .delete_message(other_user_id, Uuid::new_v4())
            .await
            .unwrap_err();

        assert!(
            matches!(err, ServiceError::Forbidden(msg) if msg == "You don't have permission to delete this message")
        );
    }

    #[actix_web::test]
    async fn test_delete_message_does_not_call_delete_without_permission() {
        let owner_id = Uuid::new_v4();
        let other_user_id = Uuid::new_v4();

        let delete_calls = Arc::new(AtomicUsize::new(0));
        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(CountingMessageRepository {
            create_calls: Arc::new(AtomicUsize::new(0)),
            find_by_id_calls: Arc::new(AtomicUsize::new(0)),
            find_by_channel_calls: Arc::new(AtomicUsize::new(0)),
            update_calls: Arc::new(AtomicUsize::new(0)),
            delete_calls: delete_calls.clone(),
            create_result: None,
            find_by_id_result: Some(Ok(Some(sample_message(
                owner_id,
                Uuid::new_v4(),
                Uuid::new_v4(),
            )))),
            find_by_channel_result: None,
            update_result: None,
            delete_result: Some(Err("should not happen".to_string())),
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: None,
            membership_and_username_result: None,
            is_server_member_result: None,
            server_role_result: Some(Ok(None)),
        });

        let service = make_service(repo, access);

        let _ = service
            .delete_message(other_user_id, Uuid::new_v4())
            .await
            .unwrap_err();

        assert_eq!(delete_calls.load(Ordering::SeqCst), 0);
    }

    #[actix_web::test]
    async fn test_delete_message_forbidden_for_non_admin_role() {
        let owner_id = Uuid::new_v4();
        let other_user_id = Uuid::new_v4();
        let message = sample_message(owner_id, Uuid::new_v4(), Uuid::new_v4());

        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(FakeMessageRepository {
            create_result: None,
            find_by_id_result: Some(Ok(Some(message))),
            find_by_channel_result: None,
            update_result: None,
            delete_result: None,
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: None,
            membership_and_username_result: None,
            is_server_member_result: None,
            server_role_result: Some(Ok(Some("member".to_string()))),
        });

        let service = make_service(repo, access);

        let err = service
            .delete_message(other_user_id, Uuid::new_v4())
            .await
            .unwrap_err();

        assert!(matches!(
            err,
            ServiceError::Forbidden(msg) if msg == "You don't have permission to delete this message"
        ));
    }

    #[actix_web::test]
    async fn test_delete_message_repository_find_error_maps_to_internal() {
        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(FakeMessageRepository {
            create_result: None,
            find_by_id_result: Some(Err("find failed".to_string())),
            find_by_channel_result: None,
            update_result: None,
            delete_result: None,
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: None,
            membership_and_username_result: None,
            is_server_member_result: None,
            server_role_result: None,
        });

        let service = make_service(repo, access);

        let err = service
            .delete_message(Uuid::new_v4(), Uuid::new_v4())
            .await
            .unwrap_err();

        assert!(matches!(err, ServiceError::Internal(msg) if msg == "find failed"));
    }

    #[actix_web::test]
    async fn test_delete_message_db_error_on_role_lookup() {
        let owner_id = Uuid::new_v4();
        let other_user_id = Uuid::new_v4();
        let message = sample_message(owner_id, Uuid::new_v4(), Uuid::new_v4());

        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(FakeMessageRepository {
            create_result: None,
            find_by_id_result: Some(Ok(Some(message))),
            find_by_channel_result: None,
            update_result: None,
            delete_result: None,
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: None,
            membership_and_username_result: None,
            is_server_member_result: None,
            server_role_result: Some(Err(())),
        });

        let service = make_service(repo, access);

        let err = service
            .delete_message(other_user_id, Uuid::new_v4())
            .await
            .unwrap_err();

        assert!(matches!(err, ServiceError::Database(_)));
    }

    #[actix_web::test]
    async fn test_delete_message_does_not_call_delete_when_role_lookup_fails() {
        let owner_id = Uuid::new_v4();
        let other_user_id = Uuid::new_v4();

        let delete_calls = Arc::new(AtomicUsize::new(0));
        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(CountingMessageRepository {
            create_calls: Arc::new(AtomicUsize::new(0)),
            find_by_id_calls: Arc::new(AtomicUsize::new(0)),
            find_by_channel_calls: Arc::new(AtomicUsize::new(0)),
            update_calls: Arc::new(AtomicUsize::new(0)),
            delete_calls: delete_calls.clone(),
            create_result: None,
            find_by_id_result: Some(Ok(Some(sample_message(
                owner_id,
                Uuid::new_v4(),
                Uuid::new_v4(),
            )))),
            find_by_channel_result: None,
            update_result: None,
            delete_result: Some(Err("should not happen".to_string())),
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: None,
            membership_and_username_result: None,
            is_server_member_result: None,
            server_role_result: Some(Err(())),
        });

        let service = make_service(repo, access);

        let _ = service
            .delete_message(other_user_id, Uuid::new_v4())
            .await
            .unwrap_err();

        assert_eq!(delete_calls.load(Ordering::SeqCst), 0);
    }

    #[actix_web::test]
    async fn test_delete_message_repository_delete_error_maps_to_internal() {
        let user_id = Uuid::new_v4();
        let message = sample_message(user_id, Uuid::new_v4(), Uuid::new_v4());

        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(FakeMessageRepository {
            create_result: None,
            find_by_id_result: Some(Ok(Some(message))),
            find_by_channel_result: None,
            update_result: None,
            delete_result: Some(Err("delete failed".to_string())),
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: None,
            membership_and_username_result: None,
            is_server_member_result: None,
            server_role_result: None,
        });

        let service = make_service(repo, access);

        let err = service
            .delete_message(user_id, Uuid::new_v4())
            .await
            .unwrap_err();

        assert!(matches!(err, ServiceError::Internal(msg) if msg == "delete failed"));
    }

    #[test]
    fn test_message_service_can_be_constructed_with_dependencies() {
        let repo: Arc<dyn MessageRepositoryTrait> = Arc::new(FakeMessageRepository {
            create_result: None,
            find_by_id_result: None,
            find_by_channel_result: None,
            update_result: None,
            delete_result: None,
        });

        let access: Arc<dyn MessageAccessTrait> = Arc::new(FakeMessageAccess {
            channel_server_result: None,
            membership_and_username_result: None,
            is_server_member_result: None,
            server_role_result: None,
        });

        let _service = MessageService::with_dependencies(repo, access);
    }
}
