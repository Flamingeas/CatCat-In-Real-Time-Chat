use bcrypt::{hash, verify};

use crate::models::user::{CreateUser, User, UserResponse};
use crate::modules::user::repository::UserRepository;
use crate::utils::jwt::generate_token;

const BCRYPT_COST: u32 = if cfg!(test) { 4 } else { 12 };

#[async_trait::async_trait]
pub trait UserRepo: Send + Sync {
    async fn find_by_email(&self, email: &str) -> Result<Option<User>, String>;
    async fn find_by_username(&self, username: &str) -> Result<Option<User>, String>;
    async fn create(&self, username: &str, email: &str, password_hash: &str) -> Result<User, String>;
}

#[async_trait::async_trait]
impl UserRepo for UserRepository {
    async fn find_by_email(&self, email: &str) -> Result<Option<User>, String> {
        self.find_by_email(email)
            .await
            .map_err(|e| format!("Database error: {}", e))
    }

    async fn find_by_username(&self, username: &str) -> Result<Option<User>, String> {
        self.find_by_username(username)
            .await
            .map_err(|e| format!("Database error: {}", e))
    }

    async fn create(&self, username: &str, email: &str, password_hash: &str) -> Result<User, String> {
        self.create(username, email, password_hash)
            .await
            .map_err(|e| format!("Database error: {}", e))
    }
}

pub struct AuthService {
    user_repo: std::sync::Arc<dyn UserRepo>,
    jwt_secret: String,
}

impl AuthService {
    pub fn new(user_repo: UserRepository, jwt_secret: String) -> Self {
        Self {
            user_repo: std::sync::Arc::new(user_repo),
            jwt_secret,
        }
    }

    pub fn new_with_repo(user_repo: std::sync::Arc<dyn UserRepo>, jwt_secret: String) -> Self {
        Self { user_repo, jwt_secret }
    }

    pub async fn signup(&self, data: CreateUser) -> Result<(UserResponse, String), String> {
        let email = data.email.trim().to_lowercase();
        let username = data.username.trim().to_string();

        if username.len() < 3 {
            return Err("Username must be at least 3 characters".to_string());
        }

        if let Ok(Some(_)) = self.user_repo.find_by_email(&email).await {
            return Err("Email already exists".to_string());
        }
        if let Ok(Some(_)) = self.user_repo.find_by_username(&username).await {
            return Err("Username already exists".to_string());
        }

        let password_hash = hash(&data.password, BCRYPT_COST).map_err(|_| "Failed to hash password")?;

        let user = self
            .user_repo
            .create(&username, &email, &password_hash)
            .await
            .map_err(|e| format!("Database error: {}", e))?;

        let token = generate_token(user.id, &user.email, Some(&user.username), &self.jwt_secret, 86400)
            .map_err(|_| "Failed to create token")?;

        let response = UserResponse {
            id: user.id,
            username: user.username,
            email: user.email,
            created_at: user.created_at,
            updated_at: user.updated_at,
        };

        Ok((response, token))
    }

    pub async fn login(&self, email: String, password: String) -> Result<(UserResponse, String), String> {
        let email = email.trim().to_lowercase();

        let user = self
            .user_repo
            .find_by_email(&email)
            .await
            .map_err(|e| format!("Database error: {}", e))?
            .ok_or("Invalid credentials")?;

        let is_valid = verify(&password, &user.password_hash).map_err(|_| "Failed to verify password")?;

        if !is_valid {
            return Err("Invalid credentials".to_string());
        }

        let token = generate_token(user.id, &user.email, Some(&user.username), &self.jwt_secret, 86400)
            .map_err(|_| "Failed to create token")?;

        let response = UserResponse {
            id: user.id,
            username: user.username,
            email: user.email,
            created_at: user.created_at,
            updated_at: user.updated_at,
        };

        Ok((response, token))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use std::collections::HashMap;
    use std::sync::{Arc, Mutex};
    use uuid::Uuid;

    #[derive(Default)]
    struct MockUserRepo {
        by_email: Mutex<HashMap<String, User>>,
        by_username: Mutex<HashMap<String, User>>,
        create_should_fail: Mutex<bool>,
    }

    impl MockUserRepo {
        fn insert_user(&self, user: User) {
            self.by_email.lock().unwrap().insert(user.email.to_lowercase(), user.clone());
            self.by_username.lock().unwrap().insert(user.username.clone(), user);
        }

        fn set_create_fail(&self, v: bool) {
            *self.create_should_fail.lock().unwrap() = v;
        }
    }

    #[async_trait::async_trait]
    impl UserRepo for MockUserRepo {
        async fn find_by_email(&self, email: &str) -> Result<Option<User>, String> {
            Ok(self.by_email.lock().unwrap().get(&email.to_lowercase()).cloned())
        }

        async fn find_by_username(&self, username: &str) -> Result<Option<User>, String> {
            Ok(self.by_username.lock().unwrap().get(username).cloned())
        }

        async fn create(&self, username: &str, email: &str, password_hash: &str) -> Result<User, String> {
            if *self.create_should_fail.lock().unwrap() {
                return Err("forced create failure".to_string());
            }

            let user = User {
                id: Uuid::new_v4(),
                username: username.to_string(),
                email: email.to_string(),
                password_hash: password_hash.to_string(),
                created_at: Utc::now(),
                updated_at: Utc::now(),
            };

            self.insert_user(user.clone());
            Ok(user)
        }
    }

    fn service_with_mock(mock: Arc<MockUserRepo>) -> AuthService {
        AuthService::new_with_repo(mock, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa".to_string())
    }

    #[actix_web::test]
    async fn test_signup_success() {
        let mock = Arc::new(MockUserRepo::default());
        let service = service_with_mock(mock);

        let (user, token) = service
            .signup(CreateUser {
                username: "tester".to_string(),
                email: "test@example.com".to_string(),
                password: "password123".to_string(),
            })
            .await
            .unwrap();

        assert_eq!(user.username, "tester");
        assert_eq!(user.email, "test@example.com");
        assert!(!token.is_empty());
    }

    #[actix_web::test]
    async fn test_signup_fails_when_username_too_short() {
        let mock = Arc::new(MockUserRepo::default());
        let service = service_with_mock(mock);

        let err = service
            .signup(CreateUser {
                username: "ab".to_string(),
                email: "test@example.com".to_string(),
                password: "password123".to_string(),
            })
            .await
            .unwrap_err();

        assert_eq!(err, "Username must be at least 3 characters");
    }

    #[actix_web::test]
    async fn test_signup_fails_when_email_exists() {
        let mock = Arc::new(MockUserRepo::default());
        let service = service_with_mock(mock.clone());

        let existing = User {
            id: Uuid::new_v4(),
            username: "someone".to_string(),
            email: "test@example.com".to_string(),
            password_hash: "x".to_string(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        mock.insert_user(existing);

        let err = service
            .signup(CreateUser {
                username: "tester".to_string(),
                email: "test@example.com".to_string(),
                password: "password123".to_string(),
            })
            .await
            .unwrap_err();

        assert_eq!(err, "Email already exists");
    }

    #[actix_web::test]
    async fn test_signup_fails_when_username_exists() {
        let mock = Arc::new(MockUserRepo::default());
        let service = service_with_mock(mock.clone());

        let existing = User {
            id: Uuid::new_v4(),
            username: "tester".to_string(),
            email: "other@example.com".to_string(),
            password_hash: "x".to_string(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        mock.insert_user(existing);

        let err = service
            .signup(CreateUser {
                username: "tester".to_string(),
                email: "test@example.com".to_string(),
                password: "password123".to_string(),
            })
            .await
            .unwrap_err();

        assert_eq!(err, "Username already exists");
    }

    #[actix_web::test]
    async fn test_signup_fails_when_create_fails() {
        let mock = Arc::new(MockUserRepo::default());
        mock.set_create_fail(true);
        let service = service_with_mock(mock);

        let err = service
            .signup(CreateUser {
                username: "tester".to_string(),
                email: "test@example.com".to_string(),
                password: "password123".to_string(),
            })
            .await
            .unwrap_err();

        assert!(err.contains("Database error:"));
    }

    #[actix_web::test]
    async fn test_login_success() {
        let mock = Arc::new(MockUserRepo::default());
        let service = service_with_mock(mock.clone());

        let password_hash = hash("password123", BCRYPT_COST).unwrap();
        let user = User {
            id: Uuid::new_v4(),
            username: "tester".to_string(),
            email: "test@example.com".to_string(),
            password_hash,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        mock.insert_user(user);

        let (resp, token) = service
            .login("test@example.com".to_string(), "password123".to_string())
            .await
            .unwrap();

        assert_eq!(resp.email, "test@example.com");
        assert_eq!(resp.username, "tester");
        assert!(!token.is_empty());
    }

    #[actix_web::test]
    async fn test_login_fails_when_user_not_found() {
        let mock = Arc::new(MockUserRepo::default());
        let service = service_with_mock(mock);

        let err = service
            .login("missing@example.com".to_string(), "password123".to_string())
            .await
            .unwrap_err();

        assert_eq!(err, "Invalid credentials");
    }

    #[actix_web::test]
    async fn test_login_fails_when_password_invalid() {
        let mock = Arc::new(MockUserRepo::default());
        let service = service_with_mock(mock.clone());

        let password_hash = hash("password123", BCRYPT_COST).unwrap();
        let user = User {
            id: Uuid::new_v4(),
            username: "tester".to_string(),
            email: "test@example.com".to_string(),
            password_hash,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        mock.insert_user(user);

        let err = service
            .login("test@example.com".to_string(), "wrong_password".to_string())
            .await
            .unwrap_err();

        assert_eq!(err, "Invalid credentials");
    }
}
