use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct Channel {
    pub id: Uuid,
    pub name: String,
    pub server_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct CreateChannel {
    #[validate(length(
        min = 1,
        max = 100,
        message = "Channel name must be between 1 and 100 characters"
    ))]
    pub name: String,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct UpdateChannel {
    #[validate(length(min = 1, max = 100))]
    pub name: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ChannelResponse {
    pub id: Uuid,
    pub name: String,
    pub server_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<Channel> for ChannelResponse {
    fn from(channel: Channel) -> Self {
        Self {
            id: channel.id,
            name: channel.name,
            server_id: channel.server_id,
            created_at: channel.created_at,
            updated_at: channel.updated_at,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ChannelDetailedResponse {
    pub id: Uuid,
    pub name: String,
    pub server_id: Uuid,
    pub server_name: String,
    pub message_count: i64,
    pub created_at: DateTime<Utc>,
}

impl Channel {
    pub fn to_response(&self) -> ChannelResponse {
        ChannelResponse {
            id: self.id,
            name: self.name.clone(),
            server_id: self.server_id,
            created_at: self.created_at,
            updated_at: self.updated_at,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn test_create_channel_validation() {
        let valid = CreateChannel {
            name: "general".to_string(),
        };
        assert!(valid.validate().is_ok());

        let valid = CreateChannel {
            name: "announcements-and-discounts".to_string(),
        };
        assert!(valid.validate().is_ok());

        let invalid = CreateChannel {
            name: "".to_string(),
        };
        assert!(invalid.validate().is_err());

        let invalid = CreateChannel {
            name: "a".repeat(101),
        };
        assert!(invalid.validate().is_err());
    }

    #[test]
    fn test_update_channel_validation() {
        let valid = UpdateChannel {
            name: Some("new-name".to_string()),
        };
        assert!(valid.validate().is_ok());

        let valid = UpdateChannel { name: None };
        assert!(valid.validate().is_ok());

        let invalid = UpdateChannel {
            name: Some("a".repeat(101)),
        };
        assert!(invalid.validate().is_err());

        let invalid = UpdateChannel {
            name: Some("".to_string()),
        };
        assert!(invalid.validate().is_err());
    }

    #[test]
    fn test_channel_to_response() {
        let created_at = Utc.with_ymd_and_hms(2026, 2, 8, 12, 0, 0).unwrap();
        let updated_at = Utc.with_ymd_and_hms(2026, 2, 8, 12, 30, 0).unwrap();

        let channel = Channel {
            id: Uuid::new_v4(),
            name: "general".to_string(),
            server_id: Uuid::new_v4(),
            created_at,
            updated_at,
        };

        let response = channel.to_response();

        assert_eq!(response.id, channel.id);
        assert_eq!(response.name, channel.name);
        assert_eq!(response.server_id, channel.server_id);
        assert_eq!(response.created_at, created_at);
        assert_eq!(response.updated_at, updated_at);
    }

    #[test]
    fn test_channel_into_response_from_impl_moves_fields() {
        let created_at = Utc.with_ymd_and_hms(2026, 2, 8, 10, 0, 0).unwrap();
        let updated_at = Utc.with_ymd_and_hms(2026, 2, 8, 11, 0, 0).unwrap();

        let id = Uuid::new_v4();
        let server_id = Uuid::new_v4();

        let channel = Channel {
            id,
            name: "general".to_string(),
            server_id,
            created_at,
            updated_at,
        };

        let resp: ChannelResponse = channel.into();

        assert_eq!(resp.id, id);
        assert_eq!(resp.name, "general");
        assert_eq!(resp.server_id, server_id);
        assert_eq!(resp.created_at, created_at);
        assert_eq!(resp.updated_at, updated_at);
    }
}
