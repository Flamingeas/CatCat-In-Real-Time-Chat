use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

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

