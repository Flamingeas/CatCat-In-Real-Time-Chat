use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use validator::Validate;
use utoipa::ToSchema;

use crate::models::message_reactions::Reaction;

mod chrono_as_bson_datetime {
    use chrono::{DateTime, Utc};
    use serde::{Deserializer, Serializer, Serialize, Deserialize};
    use std::time::SystemTime;

    pub fn serialize<S>(value: &DateTime<Utc>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        // Conversion via SystemTime
        let st: SystemTime = (*value).into();
        mongodb::bson::DateTime::from_system_time(st).serialize(serializer)
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<DateTime<Utc>, D::Error>
    where
        D: Deserializer<'de>,
    {
        let bdt = mongodb::bson::DateTime::deserialize(deserializer)?;
        // Conversion vers chrono via SystemTime
        let st = bdt.to_system_time();
        Ok(DateTime::<Utc>::from(st))
    }
}

mod opt_chrono_as_bson_datetime {
    use chrono::{DateTime, Utc};
    use serde::{Deserializer, Serializer, Serialize, Deserialize};
    use std::time::SystemTime;

    pub fn serialize<S>(value: &Option<DateTime<Utc>>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match value {
            Some(dt) => {
                let st: SystemTime = (*dt).into();
                mongodb::bson::DateTime::from_system_time(st).serialize(serializer)
            },
            None => serializer.serialize_none(),
        }
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Option<DateTime<Utc>>, D::Error>
    where
        D: Deserializer<'de>,
    {
        let opt = Option::<mongodb::bson::DateTime>::deserialize(deserializer)?;
        Ok(opt.map(|bdt| {
            let st = bdt.to_system_time();
            DateTime::<Utc>::from(st)
        }))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<mongodb::bson::oid::ObjectId>,
    
    pub message_id: Uuid,
    pub content: String,
    pub user_id: Uuid,
    pub username: String,
    pub channel_id: Uuid,
    pub server_id: Uuid,

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

#[derive(Debug, serde::Deserialize, validator::Validate)]
pub struct CreateMessage {
    #[validate(length(min = 1, max = 2000, message = "Message must be between 1 and 2000 characters"))]
    pub content: String,
    pub channel_id: Uuid,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateMessage {
    #[validate(length(min = 1, max = 2000, message = "Message must be between 1 and 2000 characters"))]
    pub content: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct MessageResponse {
    pub message_id: Uuid,
    pub content: String,
    pub user_id: Uuid,
    pub username: String,
    pub channel_id: Uuid,
    pub server_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: Option<DateTime<Utc>>,
    pub is_edited: bool,
    pub is_deleted: bool,
    pub reactions: Vec<Reaction>,
}

impl From<Message> for MessageResponse {
    fn from(message: Message) -> Self {
        let is_edited = message.updated_at.is_some();
        let is_deleted = message.deleted_at.is_some();
        Self {
            message_id: message.message_id,
            content: message.content,
            user_id: message.user_id,
            username: message.username,
            channel_id: message.channel_id,
            server_id: message.server_id,
            created_at: message.created_at,
            updated_at: message.updated_at,
            is_edited,
            is_deleted,
            reactions: message.reactions,
        }
    }
}

#[derive(Debug, Deserialize, Validate)]
pub struct GetMessagesQuery {
    #[validate(range(min = 1, max = 100, message = "Limit must be between 1 and 100"))]
    pub limit: Option<i64>,
    #[validate(range(min = 0, message = "Skip must be positive"))]
    pub skip: Option<i64>,
    pub before: Option<DateTime<Utc>>,
}

impl Default for GetMessagesQuery {
    fn default() -> Self {
        Self {
            limit: Some(50),
            skip: Some(0),
            before: None,
        }
    }
}

impl Message {
    pub fn new(
        content: String,
        user_id: Uuid,
        username: String,
        channel_id: Uuid,
        server_id: Uuid,
    ) -> Self {
        Self {
            id: None,
            message_id: Uuid::new_v4(),
            content,
            user_id,
            username,
            channel_id,
            server_id,
            created_at: Utc::now(),
            updated_at: None,
            deleted_at: None,
            reactions: Vec::new(),
        }
    }
    pub fn to_response(&self) -> MessageResponse {
        MessageResponse {
            message_id: self.message_id,
            content: self.content.clone(),
            user_id: self.user_id,
            username: self.username.clone(),
            channel_id: self.channel_id,
            server_id: self.server_id,
            created_at: self.created_at,
            updated_at: self.updated_at,
            is_edited: self.updated_at.is_some(),
            is_deleted: self.deleted_at.is_some(),
            reactions: self.reactions.clone(),
        }
    }
    pub fn mark_as_deleted(&mut self) {
        self.deleted_at = Some(Utc::now());
    }
    pub fn is_deleted(&self) -> bool {
        self.deleted_at.is_some()
    }
    pub fn update_content(&mut self, new_content: String) {
        self.content = new_content;
        self.updated_at = Some(Utc::now());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_message_validation() {
        let channel_id = Uuid::new_v4();

        let valid_message = CreateMessage {
            content: "zoubizou!".to_string(),
            channel_id,
        };
        assert!(valid_message.validate().is_ok());

        let invalid_message = CreateMessage {
            content: "".to_string(),
            channel_id,
        };
        assert!(invalid_message.validate().is_err());

        let invalid_message = CreateMessage {
            content: "a".repeat(2001),
            channel_id,
        };
        assert!(invalid_message.validate().is_err());
    }

    #[test]
    fn test_update_message_validation() {
        let valid = UpdateMessage {
            content: "updated".to_string(),
        };
        assert!(valid.validate().is_ok());

        let invalid = UpdateMessage {
            content: "".to_string(),
        };
        assert!(invalid.validate().is_err());

        let invalid = UpdateMessage {
            content: "a".repeat(2001),
        };
        assert!(invalid.validate().is_err());
    }

    #[test]
    fn test_message_new() {
        let user_id = Uuid::new_v4();
        let channel_id = Uuid::new_v4();
        let server_id = Uuid::new_v4();

        let message = Message::new(
            "Test message".to_string(),
            user_id,
            "tester".to_string(),
            channel_id,
            server_id,
        );

        assert_eq!(message.content, "Test message");
        assert_eq!(message.user_id, user_id);
        assert_eq!(message.username, "tester");
        assert_eq!(message.channel_id, channel_id);
        assert_eq!(message.server_id, server_id);
        assert!(message.updated_at.is_none());
        assert!(message.deleted_at.is_none());
        assert!(message.id.is_none());
    }

    #[test]
    fn test_message_soft_delete() {
        let mut message = Message::new(
            "Test".to_string(),
            Uuid::new_v4(),
            "user".to_string(),
            Uuid::new_v4(),
            Uuid::new_v4(),
        );

        assert!(!message.is_deleted());
        assert!(message.deleted_at.is_none());

        message.mark_as_deleted();

        assert!(message.is_deleted());
        assert!(message.deleted_at.is_some());
    }

    #[test]
    fn test_message_update_content() {
        let mut message = Message::new(
            "Original".to_string(),
            Uuid::new_v4(),
            "user".to_string(),
            Uuid::new_v4(),
            Uuid::new_v4(),
        );

        assert!(message.updated_at.is_none());

        message.update_content("Updated".to_string());

        assert_eq!(message.content, "Updated");
        assert!(message.updated_at.is_some());
    }

    #[test]
    fn test_get_messages_query_validation() {
        let valid = GetMessagesQuery {
            limit: Some(50),
            skip: Some(0),
            before: None,
        };
        assert!(valid.validate().is_ok());

        let invalid = GetMessagesQuery {
            limit: Some(101),
            skip: Some(0),
            before: None,
        };
        assert!(invalid.validate().is_err());

        let invalid = GetMessagesQuery {
            limit: Some(50),
            skip: Some(-1),
            before: None,
        };
        assert!(invalid.validate().is_err());
    }

    #[test]
    fn test_get_messages_query_default() {
        let q = GetMessagesQuery::default();
        assert_eq!(q.limit, Some(50));
        assert_eq!(q.skip, Some(0));
        assert!(q.before.is_none());
    }

    #[test]
    fn test_message_to_response() {
        let message = Message::new(
            "Test".to_string(),
            Uuid::new_v4(),
            "tester".to_string(),
            Uuid::new_v4(),
            Uuid::new_v4(),
        );

        let response = message.to_response();

        assert_eq!(response.message_id, message.message_id);
        assert_eq!(response.content, "Test");
        assert_eq!(response.user_id, message.user_id);
        assert_eq!(response.username, "tester");
        assert_eq!(response.channel_id, message.channel_id);
        assert_eq!(response.server_id, message.server_id);
        assert!(!response.is_edited);
        assert!(!response.is_deleted);
    }

    #[test]
    fn test_message_into_response_flags() {
        let mut message = Message::new(
            "Hello".to_string(),
            Uuid::new_v4(),
            "tester".to_string(),
            Uuid::new_v4(),
            Uuid::new_v4(),
        );

        message.update_content("Hello edited".to_string());
        message.mark_as_deleted();

        let resp: MessageResponse = message.into();
        assert!(resp.is_edited);
        assert!(resp.is_deleted);
        assert_eq!(resp.content, "Hello edited");
    }
}
