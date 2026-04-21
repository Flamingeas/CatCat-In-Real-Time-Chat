use sqlx::PgPool;
use uuid::Uuid;

use crate::models::user::{UpdateUser, User};

#[derive(Clone)]
pub struct UserRepository {
    pool: PgPool,
}
impl UserRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
    pub async fn create(
        &self,
        username: &str,
        email: &str,
        password_hash: &str,
    ) -> Result<User, sqlx::Error> {
        let user = sqlx::query_as::<_, User>(
            r#"
            INSERT INTO users (username, email, password_hash)
            VALUES ($1, $2, $3)
            RETURNING id, username, email, password_hash, created_at, updated_at
            "#,
        )
        .bind(username)
        .bind(email)
        .bind(password_hash)
        .fetch_one(&self.pool)
        .await?;

        Ok(user)
    }
    pub async fn find_by_email(&self, email: &str) -> Result<Option<User>, sqlx::Error> {
        let user = sqlx::query_as::<_, User>(
            r#"
            SELECT id, username, email, password_hash, created_at, updated_at
            FROM users
            WHERE email = $1
            "#,
        )
        .bind(email)
        .fetch_optional(&self.pool)
        .await?;

        Ok(user)
    }
    pub async fn find_by_id(&self, id: Uuid) -> Result<Option<User>, sqlx::Error> {
        let user = sqlx::query_as::<_, User>(
            r#"
            SELECT id, username, email, password_hash, created_at, updated_at
            FROM users
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(user)
    }
    pub async fn find_by_username(&self, username: &str) -> Result<Option<User>, sqlx::Error> {
        let user = sqlx::query_as::<_, User>(
            r#"
            SELECT id, username, email, password_hash, created_at, updated_at
            FROM users
            WHERE username = $1
            "#,
        )
        .bind(username)
        .fetch_optional(&self.pool)
        .await?;

        Ok(user)
    }
    pub async fn email_exists(&self, email: &str) -> Result<bool, sqlx::Error> {
        let result =
            sqlx::query_scalar::<_, bool>(r#"SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)"#)
                .bind(email)
                .fetch_one(&self.pool)
                .await?;

        Ok(result)
    }
    pub async fn username_exists(&self, username: &str) -> Result<bool, sqlx::Error> {
        let result = sqlx::query_scalar::<_, bool>(
            r#"SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)"#,
        )
        .bind(username)
        .fetch_one(&self.pool)
        .await?;

        Ok(result)
    }
    pub async fn update(&self, user_id: Uuid, data: &UpdateUser) -> Result<User, sqlx::Error> {
        let current_user = self
            .find_by_id(user_id)
            .await?
            .ok_or(sqlx::Error::RowNotFound)?;

        let username = data.username.as_ref().unwrap_or(&current_user.username);
        let email = data.email.as_ref().unwrap_or(&current_user.email);
        let password_hash = data
            .password
            .as_ref()
            .unwrap_or(&current_user.password_hash);
        let user = sqlx::query_as::<_, User>(
            r#"
            UPDATE users
            SET username = $1,
                email = $2,
                password_hash = $3
            WHERE id = $4
            RETURNING id, username, email, password_hash, created_at, updated_at
            "#,
        )
        .bind(username)
        .bind(email)
        .bind(password_hash)
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(user)
    }
    pub async fn update_password(
        &self,
        user_id: Uuid,
        new_password_hash: &str,
    ) -> Result<User, sqlx::Error> {
        let user = sqlx::query_as::<_, User>(
            r#"
            UPDATE users
            SET password_hash = $1
            WHERE id = $2
            RETURNING id, username, email, password_hash, created_at, updated_at
            "#,
        )
        .bind(new_password_hash)
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(user)
    }
    pub async fn update_username(
        &self,
        user_id: Uuid,
        new_username: &str,
    ) -> Result<User, sqlx::Error> {
        let user = sqlx::query_as::<_, User>(
            r#"
            UPDATE users
            SET username = $1
            WHERE id = $2
            RETURNING id, username, email, password_hash, created_at, updated_at
            "#,
        )
        .bind(new_username)
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(user)
    }
    pub async fn delete(&self, user_id: Uuid) -> Result<(), sqlx::Error> {
        sqlx::query(r#"DELETE FROM users WHERE id = $1"#)
            .bind(user_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }
    pub async fn list(&self, limit: i64, offset: i64) -> Result<Vec<User>, sqlx::Error> {
        let users = sqlx::query_as::<_, User>(
            r#"
            SELECT id, username, email, password_hash, created_at, updated_at
            FROM users
            ORDER BY created_at DESC
            LIMIT $1 OFFSET $2
            "#,
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await?;

        Ok(users)
    }
    pub async fn count(&self) -> Result<i64, sqlx::Error> {
        let count = sqlx::query_scalar::<_, i64>(r#"SELECT COUNT(*) FROM users"#)
            .fetch_one(&self.pool)
            .await?;

        Ok(count)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn test_repository_is_clone() {
        fn assert_clone<T: Clone>() {}
        assert_clone::<UserRepository>();
    }

    #[test]
    fn test_repository_new_is_callable() {
        fn accepts_ctor(_f: fn(PgPool) -> UserRepository) {}
        accepts_ctor(UserRepository::new);
    }

    #[test]
    fn test_public_methods_signatures_compile() {
        fn _sig_checks(repo: &UserRepository, uid: Uuid, upd: &UpdateUser) {
            let _ = repo.find_by_id(uid);
            let _ = repo.find_by_email("a@b.com");
            let _ = repo.find_by_username("name");
            let _ = repo.email_exists("a@b.com");
            let _ = repo.username_exists("name");
            let _ = repo.list(10, 0);
            let _ = repo.count();
            let _ = repo.update(uid, upd);
            let _ = repo.delete(uid);
            let _ = repo.update_password(uid, "hash");
            let _ = repo.update_username(uid, "newname");
            let _ = repo.create("u", "e", "p");
        }
    }
}
