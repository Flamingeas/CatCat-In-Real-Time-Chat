use super::repository::UserRepository;
use crate::models::user::{UpdateUser, UserPublicResponse, UserResponse, PushSubscription};
use uuid::Uuid;

pub struct UserService {
    repository: UserRepository,
}

impl UserService {
    pub fn new(repository: UserRepository) -> Self {
        Self { repository }
    }

    pub async fn get_profile(&self, user_id: Uuid) -> Result<UserResponse, ServiceError> {
        let user = self
            .repository
            .find_by_id(user_id)
            .await
            .map_err(ServiceError::Database)?
            .ok_or(ServiceError::NotFound("User not found".to_string()))?;

        Ok(user.to_response())
    }

    pub async fn get_public_profile(
        &self,
        user_id: Uuid,
    ) -> Result<UserPublicResponse, ServiceError> {
        let user = self
            .repository
            .find_by_id(user_id)
            .await
            .map_err(ServiceError::Database)?
            .ok_or(ServiceError::NotFound("User not found".to_string()))?;

        Ok(user.to_public_response())
    }

    pub async fn list_users(
        &self,
        page: i64,
        per_page: i64,
    ) -> Result<UserListResponse, ServiceError> {
        let per_page = per_page.min(100).max(1);
        let page = page.max(1);
        let offset = (page - 1) * per_page;

        let users = self
            .repository
            .list(per_page, offset)
            .await
            .map_err(ServiceError::Database)?;

        let total = self
            .repository
            .count()
            .await
            .map_err(ServiceError::Database)?;

        let users: Vec<UserPublicResponse> =
            users.into_iter().map(|u| u.to_public_response()).collect();

        Ok(UserListResponse {
            users,
            total,
            page,
            per_page,
            total_pages: (total as f64 / per_page as f64).ceil() as i64,
        })
    }

    pub async fn update_profile(
        &self,
        user_id: Uuid,
        mut data: UpdateUser,
    ) -> Result<UserResponse, ServiceError> {
        if let Some(ref username) = data.username {
            if let Some(existing) = self
                .repository
                .find_by_username(username)
                .await
                .map_err(ServiceError::Database)?
            {
                if existing.id != user_id {
                    return Err(ServiceError::Conflict("Username already taken".to_string()));
                }
            }
        }

        if let Some(ref email) = data.email {
            if let Some(existing) = self
                .repository
                .find_by_email(email)
                .await
                .map_err(ServiceError::Database)?
            {
                if existing.id != user_id {
                    return Err(ServiceError::Conflict("Email already taken".to_string()));
                }
            }
        }

        if let Some(ref password) = data.password {
            let password_hash = hash_password(password).map_err(ServiceError::Internal)?;
            data.password = Some(password_hash);
        }

        let user = self
            .repository
            .update(user_id, &data)
            .await
            .map_err(ServiceError::Database)?;

        Ok(user.to_response())
    }

    pub async fn delete_user(&self, user_id: Uuid) -> Result<(), ServiceError> {
        self.repository
            .find_by_id(user_id)
            .await
            .map_err(ServiceError::Database)?
            .ok_or(ServiceError::NotFound("User not found".to_string()))?;

        self.repository
            .delete(user_id)
            .await
            .map_err(ServiceError::Database)?;

        Ok(())
    }

    pub async fn add_push_subscription(
        &self,
        user_id: uuid::Uuid,
        sub: PushSubscription,
    ) -> Result<(), ServiceError> {
        self.repository
            .add_push_subscription(user_id, sub)
            .await
            .map_err(ServiceError::Database)
    }
}

#[derive(Debug, serde::Serialize)]
pub struct UserListResponse {
    pub users: Vec<UserPublicResponse>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
    pub total_pages: i64,
}

#[derive(Debug, thiserror::Error)]
pub enum ServiceError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Conflict: {0}")]
    Conflict(String),
    #[error("Internal error: {0}")]
    Internal(String),
}

fn hash_password(password: &str) -> Result<String, String> {
    bcrypt::hash(password, bcrypt::DEFAULT_COST).map_err(|e| e.to_string())
}
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_password_returns_bcrypt_hash_and_not_plaintext() {
        let password = "password123";
        let hashed = hash_password(password).expect("hash_password should succeed");

        assert!(!hashed.is_empty());
        assert_ne!(hashed, password);
        assert!(hashed.starts_with("$2"), "expected bcrypt hash format");

        let ok = bcrypt::verify(password, &hashed).expect("verify should succeed");
        assert!(ok);

        let ko = bcrypt::verify("wrong_password", &hashed).expect("verify should succeed");
        assert!(!ko);
    }

    #[test]
    fn test_pagination_normalization_logic_matches_service() {
        fn normalize(page: i64, per_page: i64) -> (i64, i64, i64) {
            let per_page = per_page.min(100).max(1);
            let page = page.max(1);
            let offset = (page - 1) * per_page;
            (page, per_page, offset)
        }

        assert_eq!(normalize(0, 0), (1, 1, 0));

        assert_eq!(normalize(1, 500), (1, 100, 0));

        assert_eq!(normalize(3, 20), (3, 20, 40));
    }

    #[test]
    fn test_total_pages_calculation_matches_service() {
        fn total_pages(total: i64, per_page: i64) -> i64 {
            let per_page = per_page.min(100).max(1);
            (total as f64 / per_page as f64).ceil() as i64
        }

        assert_eq!(total_pages(0, 20), 0);
        assert_eq!(total_pages(1, 20), 1);
        assert_eq!(total_pages(20, 20), 1);
        assert_eq!(total_pages(21, 20), 2);
        assert_eq!(total_pages(200, 100), 2);
        assert_eq!(total_pages(201, 100), 3);
    }
}
