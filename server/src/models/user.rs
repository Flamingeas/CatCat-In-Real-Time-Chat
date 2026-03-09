use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use validator::Validate;

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub password_hash: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateUser {
    #[validate(length(min = 3, max = 50, message = "Username must be between 3 and 50 characters"))]
    pub username: String,
    #[validate(email(message = "Invalid email format"))]
    pub email: String,
    #[validate(length(min = 8, message = "Password must be at least 8 characters"))]
    pub password: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateUser {
    #[validate(length(min = 3, max = 50))]
    pub username: Option<String>,
    #[validate(email)]
    pub email: Option<String>,
    #[validate(length(min = 8))]
    pub password: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct UserPublicResponse {
    pub id: Uuid,
    pub username: String,
}

impl From<User> for UserPublicResponse {
    fn from(user: User) -> Self {
        Self {
            id: user.id,
            username: user.username,
        }
    }
}

impl User {
    pub fn to_response(&self) -> UserResponse {
        UserResponse {
            id: self.id,
            username: self.username.clone(),
            email: self.email.clone(),
            created_at: self.created_at,
            updated_at: self.updated_at,
        }
    }

    pub fn to_public_response(&self) -> UserPublicResponse {
        UserPublicResponse {
            id: self.id,
            username: self.username.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn test_create_user_validation() {
        let valid_user = CreateUser {
            username: "tester".to_string(),
            email: "test@example.com".to_string(),
            password: "password123".to_string(),
        };
        assert!(valid_user.validate().is_ok());

        let invalid_user = CreateUser {
            username: "ab".to_string(),
            email: "test@example.com".to_string(),
            password: "password123".to_string(),
        };
        assert!(invalid_user.validate().is_err());

        let invalid_user = CreateUser {
            username: "tester".to_string(),
            email: "not-an-email".to_string(),
            password: "password123".to_string(),
        };
        assert!(invalid_user.validate().is_err());

        let invalid_user = CreateUser {
            username: "tester".to_string(),
            email: "test@example.com".to_string(),
            password: "short".to_string(),
        };
        assert!(invalid_user.validate().is_err());
    }

    #[test]
    fn test_update_user_validation() {
        let valid = UpdateUser {
            username: Some("newname".to_string()),
            email: Some("new@example.com".to_string()),
            password: Some("newpassword123".to_string()),
        };
        assert!(valid.validate().is_ok());

        let valid = UpdateUser {
            username: None,
            email: None,
            password: None,
        };
        assert!(valid.validate().is_ok());

        let invalid = UpdateUser {
            username: Some("ab".to_string()),
            email: None,
            password: None,
        };
        assert!(invalid.validate().is_err());

        let invalid = UpdateUser {
            username: None,
            email: Some("nope".to_string()),
            password: None,
        };
        assert!(invalid.validate().is_err());

        let invalid = UpdateUser {
            username: None,
            email: None,
            password: Some("short".to_string()),
        };
        assert!(invalid.validate().is_err());
    }

    #[test]
    fn test_user_to_response() {
        let created_at = Utc.with_ymd_and_hms(2026, 2, 8, 12, 0, 0).unwrap();
        let updated_at = Utc.with_ymd_and_hms(2026, 2, 8, 12, 30, 0).unwrap();

        let user = User {
            id: Uuid::new_v4(),
            username: "tester".to_string(),
            email: "test@example.com".to_string(),
            password_hash: "hashed_password".to_string(),
            created_at,
            updated_at,
        };

        let response = user.to_response();
        assert_eq!(response.username, "tester");
        assert_eq!(response.email, "test@example.com");
        assert_eq!(response.created_at, created_at);
        assert_eq!(response.updated_at, updated_at);
    }

    #[test]
    fn test_user_to_public_response() {
        let user = User {
            id: Uuid::new_v4(),
            username: "tester".to_string(),
            email: "test@example.com".to_string(),
            password_hash: "hashed_password".to_string(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let pub_resp = user.to_public_response();
        assert_eq!(pub_resp.id, user.id);
        assert_eq!(pub_resp.username, "tester");

        let json = serde_json::to_string(&pub_resp).unwrap();
        assert!(!json.contains("email"));
        assert!(!json.contains("password_hash"));
        assert!(!json.contains("hashed_password"));
    }

    #[test]
    fn test_user_response_does_not_contain_password() {
        let user = User {
            id: Uuid::new_v4(),
            username: "tester".to_string(),
            email: "test@example.com".to_string(),
            password_hash: "hashed_password".to_string(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let response = user.to_response();
        let json = serde_json::to_string(&response).unwrap();

        assert!(!json.contains("password_hash"));
        assert!(!json.contains("hashed_password"));
    }

    #[test]
    fn test_user_public_response_from_user_moves_fields() {
        let user = User {
            id: Uuid::new_v4(),
            username: "tester".to_string(),
            email: "test@example.com".to_string(),
            password_hash: "hashed_password".to_string(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let pub_resp: UserPublicResponse = user.into();
        assert_eq!(pub_resp.username, "tester");
    }
}
