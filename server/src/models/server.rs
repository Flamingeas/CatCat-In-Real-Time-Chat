use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use sqlx::PgPool;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use validator::Validate;
use rand::Rng;

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateServer {
    #[validate(length(min = 3, max = 50))]
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Server {
    pub id: Uuid,
    pub name: String,
    pub owner_id: Uuid,
    pub invitation_code: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateServer {
    #[validate(length(min = 3, max = 50, message = "Server name must be between 3 and 50 characters."))]
    pub name: String,
}

#[derive(Debug, Serialize)]
pub struct ServerResponse {
    pub id: Uuid,
    pub name: String,
    pub owner_id: Uuid,
    pub invitation_code: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<Server> for ServerResponse {
    fn from(server: Server) -> Self {
        Self {
            id: server.id,
            name: server.name,
            owner_id: server.owner_id,
            invitation_code: server.invitation_code,
            created_at: server.created_at,
            updated_at: server.updated_at,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct ServerDetailedResponse {
    pub id: Uuid,
    pub name: String,
    pub owner_id: Uuid,
    pub owner_username: String,
    pub invitation_code: String,
    pub member_count: i64,
    pub channel_count: i64,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct JoinServerRequest {
    #[validate(length(equal = 8, message = "Invalid invitation code"))]
    pub invitation_code: String,
}

impl Server {
    pub fn generate_invitation_code() -> String {
        const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let mut rng = rand::thread_rng();

        (0..8)
            .map(|_| {
                let idx = rng.random_range(0..CHARSET.len());
                CHARSET[idx] as char
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn test_create_server_validation() {
        let valid_server = CreateServer { name: "My server test".to_string() };
        assert!(valid_server.validate().is_ok());

        let invalid_server = CreateServer { name: "ab".to_string() };
        assert!(invalid_server.validate().is_err());

        let invalid_server = CreateServer { name: "a".repeat(51) };
        assert!(invalid_server.validate().is_err());
    }

    #[test]
    fn test_update_server_validation() {
        let valid = UpdateServer { name: Some("New server name".to_string()) };
        assert!(valid.validate().is_ok());

        let valid = UpdateServer { name: None };
        assert!(valid.validate().is_ok());

        let invalid = UpdateServer { name: Some("ab".to_string()) };
        assert!(invalid.validate().is_err());

        let invalid = UpdateServer { name: Some("a".repeat(51)) };
        assert!(invalid.validate().is_err());
    }

    #[test]
    fn test_join_server_request_validation() {
        let valid = JoinServerRequest { invitation_code: "AB12CD34".to_string() };
        assert!(valid.validate().is_ok());

        let invalid = JoinServerRequest { invitation_code: "SHORT".to_string() };
        assert!(invalid.validate().is_err());

        let invalid = JoinServerRequest { invitation_code: "TOO_LONG_CODE".to_string() };
        assert!(invalid.validate().is_err());
    }

    #[test]
    fn test_generate_invitation_code() {
        let code = Server::generate_invitation_code();
        assert_eq!(code.len(), 8);
        assert!(code.chars().all(|c| c.is_ascii_uppercase() || c.is_ascii_digit()));
    }

    #[test]
    fn test_generate_invitation_code_multiple_are_valid_and_not_all_identical() {
        let mut codes = Vec::new();
        for _ in 0..50 {
            let c = Server::generate_invitation_code();
            assert_eq!(c.len(), 8);
            assert!(c.chars().all(|ch| ch.is_ascii_uppercase() || ch.is_ascii_digit()));
            codes.push(c);
        }
        let first = &codes[0];
        assert!(codes.iter().any(|c| c != first));
    }

    #[test]
    fn test_server_into_response_from_impl_moves_fields() {
        let created_at = Utc.with_ymd_and_hms(2026, 2, 8, 10, 0, 0).unwrap();
        let updated_at = Utc.with_ymd_and_hms(2026, 2, 8, 11, 0, 0).unwrap();

        let id = Uuid::new_v4();
        let owner_id = Uuid::new_v4();

        let server = Server {
            id,
            name: "My Server".to_string(),
            owner_id,
            invitation_code: "AB12CD34".to_string(),
            created_at,
            updated_at,
        };

        let resp: ServerResponse = server.into();
        assert_eq!(resp.id, id);
        assert_eq!(resp.name, "My Server");
        assert_eq!(resp.owner_id, owner_id);
        assert_eq!(resp.invitation_code, "AB12CD34");
        assert_eq!(resp.created_at, created_at);
        assert_eq!(resp.updated_at, updated_at);
    }
}
