use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::models::message_reactions::Reaction;

mod chrono_as_bson_datetime {
    use chrono::{DateTime, Utc};
    use serde::{Deserialize, Deserializer, Serialize, Serializer};
    pub fn serialize<S>(value: &DateTime<Utc>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        bson::DateTime::from_chrono(*value).serialize(serializer)
    }
    pub fn deserialize<'de, D>(deserializer: D) -> Result<DateTime<Utc>, D::Error>
    where
        D: Deserializer<'de>,
    {
        let bdt = bson::DateTime::deserialize(deserializer)?;
        Ok(bdt.to_chrono())
    }
}

mod opt_chrono_as_bson_datetime {
    use chrono::{DateTime, Utc};
    use serde::{Deserialize, Deserializer, Serialize, Serializer};
    pub fn serialize<S>(value: &Option<DateTime<Utc>>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match value {
            Some(dt) => bson::DateTime::from_chrono(*dt).serialize(serializer),
            None => serializer.serialize_none(),
        }
    }
    pub fn deserialize<'de, D>(deserializer: D) -> Result<Option<DateTime<Utc>>, D::Error>
    where
        D: Deserializer<'de>,
    {
        let opt = Option::<bson::DateTime>::deserialize(deserializer)?;
        Ok(opt.map(|bdt| bdt.to_chrono()))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirectMessage {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<mongodb::bson::oid::ObjectId>,
    pub message_id: Uuid,
    pub conversation_id: Uuid,
    pub sender_id: Uuid,
    pub sender_username: String,
    pub recipient_id: Uuid,
    pub content: String,
    #[serde(with = "chrono_as_bson_datetime")]
    pub created_at: DateTime<Utc>,
    #[serde(
        default,
        with = "opt_chrono_as_bson_datetime",
        skip_serializing_if = "Option::is_none"
    )]
    pub updated_at: Option<DateTime<Utc>>,
    #[serde(
        default,
        with = "opt_chrono_as_bson_datetime",
        skip_serializing_if = "Option::is_none"
    )]
    pub deleted_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub reactions: Vec<Reaction>,
}

impl DirectMessage {
    pub fn new(
        conversation_id: Uuid,
        sender_id: Uuid,
        sender_username: String,
        recipient_id: Uuid,
        content: String,
    ) -> Self {
        Self {
            id: None,
            message_id: Uuid::new_v4(),
            conversation_id,
            sender_id,
            sender_username,
            recipient_id,
            content,
            created_at: Utc::now(),
            updated_at: None,
            deleted_at: None,
            reactions: Vec::new(),
        }
    }
    pub fn is_deleted(&self) -> bool {
        self.deleted_at.is_some()
    }
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct DirectMessageResponse {
    pub message_id: Uuid,
    pub conversation_id: Uuid,
    pub sender_id: Uuid,
    pub sender_username: String,
    pub recipient_id: Uuid,
    pub content: String,
    pub created_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<DateTime<Utc>>,
    pub is_edited: bool,
    pub is_deleted: bool,
    pub reactions: Vec<Reaction>,
}

impl From<DirectMessage> for DirectMessageResponse {
    fn from(m: DirectMessage) -> Self {
        let is_edited = m.updated_at.is_some();
        let is_deleted = m.deleted_at.is_some();
        Self {
            message_id: m.message_id,
            conversation_id: m.conversation_id,
            sender_id: m.sender_id,
            sender_username: m.sender_username,
            recipient_id: m.recipient_id,
            content: m.content,
            created_at: m.created_at,
            updated_at: m.updated_at,
            is_edited,
            is_deleted,
            reactions: m.reactions,
        }
    }
}

// Postgre: a conv between two users
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Conversation {
    pub id: Uuid,
    pub user1_id: Uuid,
    pub user2_id: Uuid,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct ConversationResponse {
    pub id: Uuid,
    pub other_user_id: Uuid,
    pub other_username: String,
    pub created_at: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn direct_message_new_sets_expected_defaults() {
        let conversation_id = Uuid::new_v4();
        let sender_id = Uuid::new_v4();
        let recipient_id = Uuid::new_v4();

        let message = DirectMessage::new(
            conversation_id,
            sender_id,
            "alice".to_string(),
            recipient_id,
            "hello".to_string(),
        );

        assert!(message.id.is_none());
        assert_eq!(message.conversation_id, conversation_id);
        assert_eq!(message.sender_id, sender_id);
        assert_eq!(message.sender_username, "alice");
        assert_eq!(message.recipient_id, recipient_id);
        assert_eq!(message.content, "hello");
        assert!(message.updated_at.is_none());
        assert!(message.deleted_at.is_none());
        assert!(message.reactions.is_empty());
    }

    #[test]
    fn direct_message_is_deleted_reflects_deleted_at_presence() {
        let created_at = Utc.with_ymd_and_hms(2026, 4, 24, 10, 0, 0).unwrap();
        let deleted_at = Utc.with_ymd_and_hms(2026, 4, 24, 10, 5, 0).unwrap();

        let active = DirectMessage {
            id: None,
            message_id: Uuid::new_v4(),
            conversation_id: Uuid::new_v4(),
            sender_id: Uuid::new_v4(),
            sender_username: "alice".to_string(),
            recipient_id: Uuid::new_v4(),
            content: "hello".to_string(),
            created_at,
            updated_at: None,
            deleted_at: None,
            reactions: Vec::new(),
        };

        let deleted = DirectMessage {
            deleted_at: Some(deleted_at),
            ..active.clone()
        };

        assert!(!active.is_deleted());
        assert!(deleted.is_deleted());
    }

    #[test]
    fn direct_message_response_from_sets_flags_and_fields() {
        let created_at = Utc.with_ymd_and_hms(2026, 4, 24, 10, 0, 0).unwrap();
        let updated_at = Utc.with_ymd_and_hms(2026, 4, 24, 10, 1, 0).unwrap();
        let deleted_at = Utc.with_ymd_and_hms(2026, 4, 24, 10, 2, 0).unwrap();
        let message_id = Uuid::new_v4();
        let conversation_id = Uuid::new_v4();
        let sender_id = Uuid::new_v4();
        let recipient_id = Uuid::new_v4();
        let reactions = vec![Reaction {
            emoji: ":+1:".to_string(),
            users: vec![Uuid::new_v4(), Uuid::new_v4()],
        }];

        let response: DirectMessageResponse = DirectMessage {
            id: None,
            message_id,
            conversation_id,
            sender_id,
            sender_username: "alice".to_string(),
            recipient_id,
            content: "hello".to_string(),
            created_at,
            updated_at: Some(updated_at),
            deleted_at: Some(deleted_at),
            reactions: reactions.clone(),
        }
        .into();

        assert_eq!(response.message_id, message_id);
        assert_eq!(response.conversation_id, conversation_id);
        assert_eq!(response.sender_id, sender_id);
        assert_eq!(response.sender_username, "alice");
        assert_eq!(response.recipient_id, recipient_id);
        assert_eq!(response.content, "hello");
        assert_eq!(response.created_at, created_at);
        assert_eq!(response.updated_at, Some(updated_at));
        assert!(response.is_edited);
        assert!(response.is_deleted);
        assert_eq!(response.reactions.len(), reactions.len());
        assert_eq!(response.reactions[0].emoji, reactions[0].emoji);
    }
}
