use chrono::{DateTime, Utc};
use serde::Serialize;
use uuid::Uuid;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ServerBanResponse {
    pub user_id: Uuid,
    pub username: String,
    pub reason: Option<String>,
    pub created_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn server_ban_response_serializes_optional_fields_when_present() {
        let created_at = Utc.with_ymd_and_hms(2026, 4, 24, 9, 0, 0).unwrap();
        let expires_at = Utc.with_ymd_and_hms(2026, 4, 25, 9, 0, 0).unwrap();
        let value = ServerBanResponse {
            user_id: Uuid::new_v4(),
            username: "alice".to_string(),
            reason: Some("spam".to_string()),
            created_at,
            expires_at: Some(expires_at),
        };

        let json = serde_json::to_value(value).unwrap();

        assert_eq!(json["username"], "alice");
        assert_eq!(json["reason"], "spam");
        assert!(json["created_at"].as_str().is_some());
        assert!(json["expires_at"].as_str().is_some());
    }

    #[test]
    fn server_ban_response_serializes_null_optional_fields_when_absent() {
        let created_at = Utc.with_ymd_and_hms(2026, 4, 24, 9, 0, 0).unwrap();
        let value = ServerBanResponse {
            user_id: Uuid::new_v4(),
            username: "bob".to_string(),
            reason: None,
            created_at,
            expires_at: None,
        };

        let json = serde_json::to_value(value).unwrap();

        assert_eq!(json["username"], "bob");
        assert!(json["reason"].is_null());
        assert!(json["expires_at"].is_null());
    }
}
