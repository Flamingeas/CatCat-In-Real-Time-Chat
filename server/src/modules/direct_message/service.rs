use chrono::{DateTime, Utc};
use mongodb::Database;
use sqlx::PgPool;
use std::sync::Arc;
use uuid::Uuid;

use super::repository::DirectMessageRepository;
use crate::models::direct_message::{
    Conversation, ConversationResponse, DirectMessage, DirectMessageResponse,
};
use async_trait::async_trait;

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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::direct_message::DirectMessage;
    use async_trait::async_trait;
    use chrono::Duration;
    use std::sync::Arc;

    fn conversation(user1_id: Uuid, user2_id: Uuid) -> Conversation {
        Conversation {
            id: Uuid::new_v4(),
            user1_id,
            user2_id,
            created_at: Utc::now(),
        }
    }

    fn direct_message(sender_id: Uuid, recipient_id: Uuid) -> DirectMessage {
        DirectMessage {
            id: None,
            message_id: Uuid::new_v4(),
            conversation_id: Uuid::new_v4(),
            sender_id,
            sender_username: "alice".to_string(),
            recipient_id,
            content: "hello".to_string(),
            created_at: Utc::now(),
            updated_at: None,
            deleted_at: None,
            reactions: Vec::new(),
        }
    }

    struct FakeRepo {
        create_result: Option<Result<DirectMessage, String>>,
        find_by_id_result: Option<Result<Option<DirectMessage>, String>>,
        find_by_conversation_result: Option<Result<Vec<DirectMessage>, String>>,
        update_result: Option<Result<DirectMessage, String>>,
        delete_result: Option<Result<(), String>>,
        add_reaction_result: Option<Result<(), String>>,
        remove_reaction_result: Option<Result<(), String>>,
    }

    #[async_trait]
    impl DirectMessageRepo for FakeRepo {
        async fn create(
            &self,
            _conversation_id: Uuid,
            _sender_id: Uuid,
            _sender_username: String,
            _recipient_id: Uuid,
            _content: String,
        ) -> Result<DirectMessage, String> {
            self.create_result.clone().unwrap()
        }

        async fn find_by_id(&self, _message_id: Uuid) -> Result<Option<DirectMessage>, String> {
            self.find_by_id_result.clone().unwrap()
        }

        async fn find_by_conversation(
            &self,
            _conversation_id: Uuid,
            _limit: i64,
            _before: Option<DateTime<Utc>>,
        ) -> Result<Vec<DirectMessage>, String> {
            self.find_by_conversation_result.clone().unwrap()
        }

        async fn update(
            &self,
            _message_id: Uuid,
            _content: String,
        ) -> Result<DirectMessage, String> {
            self.update_result.clone().unwrap()
        }

        async fn delete(&self, _message_id: Uuid) -> Result<(), String> {
            self.delete_result.clone().unwrap()
        }

        async fn add_reaction(
            &self,
            _message_id: Uuid,
            _user_id: Uuid,
            _emoji: &str,
        ) -> Result<(), String> {
            self.add_reaction_result.clone().unwrap()
        }

        async fn remove_reaction(
            &self,
            _message_id: Uuid,
            _user_id: Uuid,
            _emoji: &str,
        ) -> Result<(), String> {
            self.remove_reaction_result.clone().unwrap()
        }
    }

    struct FakeAccess {
        recipient_result: Option<Result<Option<(Uuid, String)>, ()>>,
        upsert_result: Option<Result<Conversation, ()>>,
        list_result: Option<Result<Vec<(Uuid, Uuid, Uuid, DateTime<Utc>, String)>, ()>>,
        conversation_result: Option<Result<Option<Conversation>, ()>>,
    }

    #[async_trait]
    impl DirectMessageAccess for FakeAccess {
        async fn find_recipient(
            &self,
            _recipient_id: Uuid,
        ) -> Result<Option<(Uuid, String)>, sqlx::Error> {
            match self.recipient_result.clone().unwrap() {
                Ok(v) => Ok(v),
                Err(()) => Err(sqlx::Error::RowNotFound),
            }
        }

        async fn upsert_conversation(
            &self,
            _user1_id: Uuid,
            _user2_id: Uuid,
        ) -> Result<Conversation, sqlx::Error> {
            match self.upsert_result.clone().unwrap() {
                Ok(v) => Ok(v),
                Err(()) => Err(sqlx::Error::RowNotFound),
            }
        }

        async fn list_conversations(
            &self,
            _user_id: Uuid,
        ) -> Result<Vec<(Uuid, Uuid, Uuid, DateTime<Utc>, String)>, sqlx::Error> {
            match self.list_result.clone().unwrap() {
                Ok(v) => Ok(v),
                Err(()) => Err(sqlx::Error::RowNotFound),
            }
        }

        async fn find_conversation(
            &self,
            _conversation_id: Uuid,
        ) -> Result<Option<Conversation>, sqlx::Error> {
            match self.conversation_result.clone().unwrap() {
                Ok(v) => Ok(v),
                Err(()) => Err(sqlx::Error::RowNotFound),
            }
        }
    }

    fn fake_service(repo: FakeRepo, access: FakeAccess) -> DirectMessageService {
        DirectMessageService::new_with_dependencies(Arc::new(repo), Arc::new(access))
    }

    fn empty_repo() -> FakeRepo {
        FakeRepo {
            create_result: None,
            find_by_id_result: None,
            find_by_conversation_result: None,
            update_result: None,
            delete_result: None,
            add_reaction_result: None,
            remove_reaction_result: None,
        }
    }

    fn empty_access() -> FakeAccess {
        FakeAccess {
            recipient_result: None,
            upsert_result: None,
            list_result: None,
            conversation_result: None,
        }
    }

    #[test]
    fn ordered_user_pair_rejects_self_and_sorts_ids() {
        let a = Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap();
        let b = Uuid::parse_str("00000000-0000-0000-0000-000000000002").unwrap();

        assert!(matches!(
            ordered_user_pair(a, a),
            Err(ServiceError::Forbidden(message)) if message.contains("yourself")
        ));
        assert_eq!(ordered_user_pair(a, b).unwrap(), (a, b));
        assert_eq!(ordered_user_pair(b, a).unwrap(), (a, b));
    }

    #[test]
    fn conversation_helpers_identify_participants_and_other_user() {
        let user1_id = Uuid::new_v4();
        let user2_id = Uuid::new_v4();
        let outsider_id = Uuid::new_v4();
        let conv = conversation(user1_id, user2_id);

        assert!(ensure_participant(&conv, user1_id).is_ok());
        assert!(ensure_participant(&conv, user2_id).is_ok());
        assert!(matches!(
            ensure_participant(&conv, outsider_id),
            Err(ServiceError::Forbidden(message)) if message.contains("not a participant")
        ));
        assert_eq!(other_conversation_user(&conv, user1_id), user2_id);
        assert_eq!(other_conversation_user(&conv, user2_id), user1_id);
    }

    #[test]
    fn conversation_response_uses_recipient_fields() {
        let user1_id = Uuid::new_v4();
        let user2_id = Uuid::new_v4();
        let conv = conversation(user1_id, user2_id);
        let conv_id = conv.id;
        let created_at = conv.created_at;

        let response = conversation_response(conv, user2_id, "bob".to_string());

        assert_eq!(response.id, conv_id);
        assert_eq!(response.other_user_id, user2_id);
        assert_eq!(response.other_username, "bob");
        assert_eq!(response.created_at, created_at);
    }

    #[test]
    fn other_message_user_returns_recipient_for_sender_and_sender_for_recipient() {
        let sender_id = Uuid::new_v4();
        let recipient_id = Uuid::new_v4();
        let dm = direct_message(sender_id, recipient_id);

        assert_eq!(other_message_user(&dm, sender_id), recipient_id);
        assert_eq!(other_message_user(&dm, recipient_id), sender_id);
    }

    #[test]
    fn ensure_can_edit_message_checks_owner_deleted_and_time_limit() {
        let sender_id = Uuid::new_v4();
        let recipient_id = Uuid::new_v4();
        let mut dm = direct_message(sender_id, recipient_id);
        let now = dm.created_at + Duration::minutes(1);

        assert!(ensure_can_edit_message(&dm, sender_id, now).is_ok());
        assert!(matches!(
            ensure_can_edit_message(&dm, recipient_id, now),
            Err(ServiceError::Forbidden(message)) if message.contains("edit your own")
        ));

        dm.deleted_at = Some(now);
        assert!(matches!(
            ensure_can_edit_message(&dm, sender_id, now),
            Err(ServiceError::Forbidden(message)) if message.contains("deleted")
        ));

        dm.deleted_at = None;
        let too_late = dm.created_at + Duration::minutes(5);
        assert!(matches!(
            ensure_can_edit_message(&dm, sender_id, too_late),
            Err(ServiceError::Forbidden(message)) if message.contains("5 minutes")
        ));
    }

    #[test]
    fn ensure_can_delete_message_checks_owner_and_deleted_state() {
        let sender_id = Uuid::new_v4();
        let recipient_id = Uuid::new_v4();
        let mut dm = direct_message(sender_id, recipient_id);

        assert!(ensure_can_delete_message(&dm, sender_id).is_ok());
        assert!(matches!(
            ensure_can_delete_message(&dm, recipient_id),
            Err(ServiceError::Forbidden(message)) if message.contains("delete your own")
        ));

        dm.deleted_at = Some(Utc::now());
        assert!(matches!(
            ensure_can_delete_message(&dm, sender_id),
            Err(ServiceError::NotFound(message)) if message == "Message not found"
        ));
    }

    #[test]
    fn service_error_display_formats_all_variants() {
        assert_eq!(
            ServiceError::NotFound("x".to_string()).to_string(),
            "Not found: x"
        );
        assert_eq!(
            ServiceError::Forbidden("x".to_string()).to_string(),
            "Forbidden: x"
        );
        assert_eq!(
            ServiceError::Database(sqlx::Error::RowNotFound).to_string(),
            "Database error: no rows returned by a query that expected to return at least one row"
        );
        assert_eq!(
            ServiceError::Internal("x".to_string()).to_string(),
            "Internal error: x"
        );
    }

    #[actix_web::test]
    async fn get_or_create_conversation_success_and_missing_recipient() {
        let user_id = Uuid::parse_str("00000000-0000-0000-0000-000000000010").unwrap();
        let recipient_id = Uuid::parse_str("00000000-0000-0000-0000-000000000020").unwrap();
        let conv = conversation(user_id, recipient_id);
        let conv_id = conv.id;

        let mut access = empty_access();
        access.recipient_result = Some(Ok(Some((recipient_id, "bob".to_string()))));
        access.upsert_result = Some(Ok(conv));
        let service = fake_service(empty_repo(), access);

        let response = service
            .get_or_create_conversation(user_id, recipient_id)
            .await
            .unwrap();

        assert_eq!(response.id, conv_id);
        assert_eq!(response.other_user_id, recipient_id);
        assert_eq!(response.other_username, "bob");

        let mut access = empty_access();
        access.recipient_result = Some(Ok(None));
        let service = fake_service(empty_repo(), access);
        let err = service
            .get_or_create_conversation(user_id, recipient_id)
            .await
            .unwrap_err();
        assert!(matches!(err, ServiceError::NotFound(msg) if msg.contains("Recipient")));
    }

    #[actix_web::test]
    async fn list_conversations_maps_rows_and_database_errors() {
        let user_id = Uuid::new_v4();
        let other_id = Uuid::new_v4();
        let conv = conversation(user_id, other_id);
        let mut access = empty_access();
        access.list_result = Some(Ok(vec![(
            conv.id,
            conv.user1_id,
            conv.user2_id,
            conv.created_at,
            "bob".to_string(),
        )]));
        let service = fake_service(empty_repo(), access);

        let rows = service.list_conversations(user_id).await.unwrap();

        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].other_user_id, other_id);
        assert_eq!(rows[0].other_username, "bob");

        let mut access = empty_access();
        access.list_result = Some(Err(()));
        let service = fake_service(empty_repo(), access);
        let err = service.list_conversations(user_id).await.unwrap_err();
        assert!(matches!(err, ServiceError::Database(_)));
    }

    #[actix_web::test]
    async fn send_and_get_messages_cover_participant_checks_and_repo_errors() {
        let sender_id = Uuid::new_v4();
        let recipient_id = Uuid::new_v4();
        let conv = conversation(sender_id, recipient_id);
        let dm = direct_message(sender_id, recipient_id);

        let mut repo = empty_repo();
        repo.create_result = Some(Ok(dm.clone()));
        let mut access = empty_access();
        access.conversation_result = Some(Ok(Some(conv.clone())));
        let service = fake_service(repo, access);

        let (response, other_id) = service
            .send_message(conv.id, sender_id, "alice".to_string(), "hello".to_string())
            .await
            .unwrap();
        assert_eq!(response.content, "hello");
        assert_eq!(other_id, recipient_id);

        let mut repo = empty_repo();
        repo.find_by_conversation_result = Some(Ok(vec![dm.clone()]));
        let mut access = empty_access();
        access.conversation_result = Some(Ok(Some(conv.clone())));
        let service = fake_service(repo, access);
        let messages = service
            .get_messages(conv.id, sender_id, 50, None)
            .await
            .unwrap();
        assert_eq!(messages.len(), 1);

        let mut repo = empty_repo();
        repo.create_result = Some(Err("mongo down".to_string()));
        let mut access = empty_access();
        access.conversation_result = Some(Ok(Some(conv)));
        let service = fake_service(repo, access);
        let err = service
            .send_message(
                Uuid::new_v4(),
                sender_id,
                "alice".to_string(),
                "hello".to_string(),
            )
            .await
            .unwrap_err();
        assert!(matches!(err, ServiceError::Internal(msg) if msg == "mongo down"));
    }

    #[actix_web::test]
    async fn update_and_delete_message_cover_success_and_guards() {
        let sender_id = Uuid::new_v4();
        let recipient_id = Uuid::new_v4();
        let mut dm = direct_message(sender_id, recipient_id);
        let message_id = dm.message_id;
        let updated = {
            dm.content = "edited".to_string();
            dm.updated_at = Some(Utc::now());
            dm.clone()
        };

        let mut repo = empty_repo();
        repo.find_by_id_result = Some(Ok(Some(direct_message(sender_id, recipient_id))));
        repo.update_result = Some(Ok(updated));
        let service = fake_service(repo, empty_access());
        let (response, other_id) = service
            .update_message(message_id, sender_id, "edited".to_string())
            .await
            .unwrap();
        assert_eq!(response.content, "edited");
        assert_eq!(other_id, recipient_id);

        let mut repo = empty_repo();
        repo.find_by_id_result = Some(Ok(Some(direct_message(sender_id, recipient_id))));
        repo.delete_result = Some(Ok(()));
        let service = fake_service(repo, empty_access());
        let (conversation_id, other_id) =
            service.delete_message(message_id, sender_id).await.unwrap();
        assert_ne!(conversation_id, Uuid::nil());
        assert_eq!(other_id, recipient_id);

        let mut repo = empty_repo();
        repo.find_by_id_result = Some(Ok(None));
        let service = fake_service(repo, empty_access());
        let err = service
            .update_message(message_id, sender_id, "edited".to_string())
            .await
            .unwrap_err();
        assert!(matches!(err, ServiceError::NotFound(_)));
    }

    #[actix_web::test]
    async fn reaction_methods_check_deleted_participation_and_repo_errors() {
        let sender_id = Uuid::new_v4();
        let recipient_id = Uuid::new_v4();
        let dm = direct_message(sender_id, recipient_id);
        let conv = Conversation {
            id: dm.conversation_id,
            user1_id: sender_id,
            user2_id: recipient_id,
            created_at: dm.created_at,
        };

        let mut repo = empty_repo();
        repo.find_by_id_result = Some(Ok(Some(dm.clone())));
        repo.add_reaction_result = Some(Ok(()));
        let mut access = empty_access();
        access.conversation_result = Some(Ok(Some(conv.clone())));
        let service = fake_service(repo, access);
        let (conversation_id, other_id) = service
            .add_reaction(dm.message_id, sender_id, "👍".to_string())
            .await
            .unwrap();
        assert_eq!(conversation_id, dm.conversation_id);
        assert_eq!(other_id, recipient_id);

        let mut repo = empty_repo();
        repo.find_by_id_result = Some(Ok(Some(dm.clone())));
        repo.remove_reaction_result = Some(Ok(()));
        let mut access = empty_access();
        access.conversation_result = Some(Ok(Some(conv)));
        let service = fake_service(repo, access);
        let (_, other_id) = service
            .remove_reaction(dm.message_id, recipient_id, "👍".to_string())
            .await
            .unwrap();
        assert_eq!(other_id, sender_id);

        let mut deleted = dm.clone();
        deleted.deleted_at = Some(Utc::now());
        let mut repo = empty_repo();
        repo.find_by_id_result = Some(Ok(Some(deleted)));
        let service = fake_service(repo, empty_access());
        let err = service
            .add_reaction(dm.message_id, sender_id, "👍".to_string())
            .await
            .unwrap_err();
        assert!(matches!(err, ServiceError::Forbidden(msg) if msg.contains("deleted")));
    }
}

#[async_trait]
pub trait DirectMessageRepo: Send + Sync {
    async fn create(
        &self,
        conversation_id: Uuid,
        sender_id: Uuid,
        sender_username: String,
        recipient_id: Uuid,
        content: String,
    ) -> Result<DirectMessage, String>;
    async fn find_by_id(&self, message_id: Uuid) -> Result<Option<DirectMessage>, String>;
    async fn find_by_conversation(
        &self,
        conversation_id: Uuid,
        limit: i64,
        before: Option<DateTime<Utc>>,
    ) -> Result<Vec<DirectMessage>, String>;
    async fn update(&self, message_id: Uuid, content: String) -> Result<DirectMessage, String>;
    async fn delete(&self, message_id: Uuid) -> Result<(), String>;
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
}

#[async_trait]
pub trait DirectMessageAccess: Send + Sync {
    async fn find_recipient(
        &self,
        recipient_id: Uuid,
    ) -> Result<Option<(Uuid, String)>, sqlx::Error>;
    async fn upsert_conversation(
        &self,
        user1_id: Uuid,
        user2_id: Uuid,
    ) -> Result<Conversation, sqlx::Error>;
    async fn list_conversations(
        &self,
        user_id: Uuid,
    ) -> Result<Vec<(Uuid, Uuid, Uuid, DateTime<Utc>, String)>, sqlx::Error>;
    async fn find_conversation(
        &self,
        conversation_id: Uuid,
    ) -> Result<Option<Conversation>, sqlx::Error>;
}

struct MongoDirectMessageRepo {
    db: Database,
}

#[async_trait]
impl DirectMessageRepo for MongoDirectMessageRepo {
    async fn create(
        &self,
        conversation_id: Uuid,
        sender_id: Uuid,
        sender_username: String,
        recipient_id: Uuid,
        content: String,
    ) -> Result<DirectMessage, String> {
        DirectMessageRepository::new(&self.db)
            .create(
                conversation_id,
                sender_id,
                sender_username,
                recipient_id,
                content,
            )
            .await
            .map_err(|e| e.to_string())
    }

    async fn find_by_id(&self, message_id: Uuid) -> Result<Option<DirectMessage>, String> {
        DirectMessageRepository::new(&self.db)
            .find_by_id(message_id)
            .await
            .map_err(|e| e.to_string())
    }

    async fn find_by_conversation(
        &self,
        conversation_id: Uuid,
        limit: i64,
        before: Option<DateTime<Utc>>,
    ) -> Result<Vec<DirectMessage>, String> {
        DirectMessageRepository::new(&self.db)
            .find_by_conversation(conversation_id, limit, before)
            .await
            .map_err(|e| e.to_string())
    }

    async fn update(&self, message_id: Uuid, content: String) -> Result<DirectMessage, String> {
        DirectMessageRepository::new(&self.db)
            .update(message_id, content)
            .await
            .map_err(|e| e.to_string())
    }

    async fn delete(&self, message_id: Uuid) -> Result<(), String> {
        DirectMessageRepository::new(&self.db)
            .delete(message_id)
            .await
            .map_err(|e| e.to_string())
    }

    async fn add_reaction(
        &self,
        message_id: Uuid,
        user_id: Uuid,
        emoji: &str,
    ) -> Result<(), String> {
        DirectMessageRepository::new(&self.db)
            .add_reaction(message_id, user_id, emoji)
            .await
            .map_err(|e| e.to_string())
    }

    async fn remove_reaction(
        &self,
        message_id: Uuid,
        user_id: Uuid,
        emoji: &str,
    ) -> Result<(), String> {
        DirectMessageRepository::new(&self.db)
            .remove_reaction(message_id, user_id, emoji)
            .await
            .map_err(|e| e.to_string())
    }
}

struct PgDirectMessageAccess {
    pool: PgPool,
}

#[async_trait]
impl DirectMessageAccess for PgDirectMessageAccess {
    async fn find_recipient(
        &self,
        recipient_id: Uuid,
    ) -> Result<Option<(Uuid, String)>, sqlx::Error> {
        sqlx::query_as::<_, (Uuid, String)>("SELECT id, username FROM users WHERE id = $1")
            .bind(recipient_id)
            .fetch_optional(&self.pool)
            .await
    }

    async fn upsert_conversation(
        &self,
        user1_id: Uuid,
        user2_id: Uuid,
    ) -> Result<Conversation, sqlx::Error> {
        sqlx::query_as::<_, Conversation>(
            r#"
            INSERT INTO conversations (id, user1_id, user2_id, created_at)
            VALUES (gen_random_uuid(), $1, $2, NOW())
            ON CONFLICT (user1_id, user2_id) DO UPDATE SET user1_id = EXCLUDED.user1_id
            RETURNING id, user1_id, user2_id, created_at
            "#,
        )
        .bind(user1_id)
        .bind(user2_id)
        .fetch_one(&self.pool)
        .await
    }

    async fn list_conversations(
        &self,
        user_id: Uuid,
    ) -> Result<Vec<(Uuid, Uuid, Uuid, DateTime<Utc>, String)>, sqlx::Error> {
        sqlx::query_as::<_, (Uuid, Uuid, Uuid, DateTime<Utc>, String)>(
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
        .fetch_all(&self.pool)
        .await
    }

    async fn find_conversation(
        &self,
        conversation_id: Uuid,
    ) -> Result<Option<Conversation>, sqlx::Error> {
        sqlx::query_as::<_, Conversation>(
            "SELECT id, user1_id, user2_id, created_at FROM conversations WHERE id = $1",
        )
        .bind(conversation_id)
        .fetch_optional(&self.pool)
        .await
    }
}

pub struct DirectMessageService {
    repo: Arc<dyn DirectMessageRepo>,
    access: Arc<dyn DirectMessageAccess>,
}

fn ordered_user_pair(user_id: Uuid, recipient_id: Uuid) -> Result<(Uuid, Uuid), ServiceError> {
    if user_id == recipient_id {
        return Err(ServiceError::Forbidden(
            "You cannot start a conversation with yourself".to_string(),
        ));
    }

    Ok(if user_id < recipient_id {
        (user_id, recipient_id)
    } else {
        (recipient_id, user_id)
    })
}

fn conversation_response(
    conv: Conversation,
    other_user_id: Uuid,
    other_username: String,
) -> ConversationResponse {
    ConversationResponse {
        id: conv.id,
        other_user_id,
        other_username,
        created_at: conv.created_at,
    }
}

fn ensure_participant(conv: &Conversation, user_id: Uuid) -> Result<(), ServiceError> {
    if conv.user1_id != user_id && conv.user2_id != user_id {
        return Err(ServiceError::Forbidden(
            "You are not a participant of this conversation".to_string(),
        ));
    }
    Ok(())
}

fn other_conversation_user(conv: &Conversation, user_id: Uuid) -> Uuid {
    if conv.user1_id == user_id {
        conv.user2_id
    } else {
        conv.user1_id
    }
}

fn other_message_user(dm: &crate::models::direct_message::DirectMessage, user_id: Uuid) -> Uuid {
    if dm.sender_id == user_id {
        dm.recipient_id
    } else {
        dm.sender_id
    }
}

fn ensure_can_edit_message(
    dm: &crate::models::direct_message::DirectMessage,
    user_id: Uuid,
    now: DateTime<Utc>,
) -> Result<(), ServiceError> {
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
    let elapsed = now.signed_duration_since(dm.created_at).num_seconds();
    if elapsed >= EDIT_TIME_LIMIT_MINUTES * 60 {
        return Err(ServiceError::Forbidden(format!(
            "Messages can only be edited within {} minutes",
            EDIT_TIME_LIMIT_MINUTES
        )));
    }

    Ok(())
}

fn ensure_can_delete_message(
    dm: &crate::models::direct_message::DirectMessage,
    user_id: Uuid,
) -> Result<(), ServiceError> {
    if dm.sender_id != user_id {
        return Err(ServiceError::Forbidden(
            "You can only delete your own messages".to_string(),
        ));
    }
    if dm.is_deleted() {
        return Err(ServiceError::NotFound("Message not found".to_string()));
    }
    Ok(())
}

impl DirectMessageService {
    pub fn new(mongo: &Database, pg: &PgPool) -> Self {
        Self {
            repo: Arc::new(MongoDirectMessageRepo { db: mongo.clone() }),
            access: Arc::new(PgDirectMessageAccess { pool: pg.clone() }),
        }
    }

    pub fn new_with_dependencies(
        repo: Arc<dyn DirectMessageRepo>,
        access: Arc<dyn DirectMessageAccess>,
    ) -> Self {
        Self { repo, access }
    }
    /// get/create a conversation between user_id and recipient_id
    pub async fn get_or_create_conversation(
        &self,
        user_id: Uuid,
        recipient_id: Uuid,
    ) -> Result<ConversationResponse, ServiceError> {
        let (u1, u2) = ordered_user_pair(user_id, recipient_id)?;
        let recipient_row = self
            .access
            .find_recipient(recipient_id)
            .await
            .map_err(ServiceError::Database)?;

        let (_, recipient_username) = recipient_row
            .ok_or_else(|| ServiceError::NotFound("Recipient user not found".to_string()))?;
        let conv = self
            .access
            .upsert_conversation(u1, u2)
            .await
            .map_err(ServiceError::Database)?;

        Ok(conversation_response(
            conv,
            recipient_id,
            recipient_username,
        ))
    }

    pub async fn list_conversations(
        &self,
        user_id: Uuid,
    ) -> Result<Vec<ConversationResponse>, ServiceError> {
        let rows = self
            .access
            .list_conversations(user_id)
            .await
            .map_err(ServiceError::Database)?;
        Ok(rows
            .into_iter()
            .map(|(id, user1_id, user2_id, created_at, other_username)| {
                let other_user_id = other_conversation_user(
                    &Conversation {
                        id,
                        user1_id,
                        user2_id,
                        created_at,
                    },
                    user_id,
                );
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
        let conv = self
            .access
            .find_conversation(conversation_id)
            .await
            .map_err(ServiceError::Database)?
            .ok_or_else(|| ServiceError::NotFound("Conversation not found".to_string()))?;
        ensure_participant(&conv, user_id)?;
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
        let recipient_id = other_conversation_user(&conv, sender_id);
        let dm = self
            .repo
            .create(
                conversation_id,
                sender_id,
                sender_username,
                recipient_id,
                content,
            )
            .await
            .map_err(ServiceError::Internal)?;
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

        let messages = self
            .repo
            .find_by_conversation(conversation_id, limit, before)
            .await
            .map_err(ServiceError::Internal)?;
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
        let dm = self
            .repo
            .find_by_id(message_id)
            .await
            .map_err(ServiceError::Internal)?
            .ok_or_else(|| ServiceError::NotFound("Direct message not found".to_string()))?;

        ensure_can_edit_message(&dm, user_id, Utc::now())?;
        let recipient_id = dm.recipient_id;
        let updated = self
            .repo
            .update(message_id, content)
            .await
            .map_err(ServiceError::Internal)?;
        Ok((updated.into(), recipient_id))
    }

    pub async fn delete_message(
        &self,
        message_id: Uuid,
        user_id: Uuid,
    ) -> Result<(Uuid, Uuid), ServiceError> {
        let dm = self
            .repo
            .find_by_id(message_id)
            .await
            .map_err(ServiceError::Internal)?
            .ok_or_else(|| ServiceError::NotFound("Direct message not found".to_string()))?;

        ensure_can_delete_message(&dm, user_id)?;

        let conversation_id = dm.conversation_id;
        let recipient_id = dm.recipient_id;
        self.repo
            .delete(message_id)
            .await
            .map_err(ServiceError::Internal)?;
        Ok((conversation_id, recipient_id))
    }

    pub async fn add_reaction(
        &self,
        message_id: Uuid,
        user_id: Uuid,
        emoji: String,
    ) -> Result<(Uuid, Uuid), ServiceError> {
        let dm = self
            .repo
            .find_by_id(message_id)
            .await
            .map_err(ServiceError::Internal)?
            .ok_or_else(|| ServiceError::NotFound("Direct message not found".to_string()))?;

        if dm.is_deleted() {
            return Err(ServiceError::Forbidden(
                "Cannot react to a deleted message".to_string(),
            ));
        }

        self.check_participant(dm.conversation_id, user_id).await?;

        let other_user_id = other_message_user(&dm, user_id);

        self.repo
            .add_reaction(message_id, user_id, &emoji)
            .await
            .map_err(ServiceError::Internal)?;

        Ok((dm.conversation_id, other_user_id))
    }

    pub async fn remove_reaction(
        &self,
        message_id: Uuid,
        user_id: Uuid,
        emoji: String,
    ) -> Result<(Uuid, Uuid), ServiceError> {
        let dm = self
            .repo
            .find_by_id(message_id)
            .await
            .map_err(ServiceError::Internal)?
            .ok_or_else(|| ServiceError::NotFound("Direct message not found".to_string()))?;

        self.check_participant(dm.conversation_id, user_id).await?;

        let other_user_id = other_message_user(&dm, user_id);

        self.repo
            .remove_reaction(message_id, user_id, &emoji)
            .await
            .map_err(ServiceError::Internal)?;

        Ok((dm.conversation_id, other_user_id))
    }
}
