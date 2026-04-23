use async_trait::async_trait;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::channel::{Channel, UpdateChannel};

#[async_trait]
pub trait ChannelRepositoryTrait: Send + Sync {
    async fn create(&self, server_id: Uuid, name: &str) -> Result<Channel, String>;
    async fn list_for_server(&self, server_id: Uuid) -> Result<Vec<Channel>, String>;
    async fn update(&self, channel_id: Uuid, payload: UpdateChannel) -> Result<Channel, String>;
    async fn delete(&self, channel_id: Uuid) -> Result<Channel, String>;
    async fn user_is_member(&self, server_id: Uuid, user_id: Uuid) -> Result<bool, String>;
    async fn user_can_manage_channels(
        &self,
        server_id: Uuid,
        user_id: Uuid,
    ) -> Result<bool, String>;
    async fn user_can_manage_channel(
        &self,
        channel_id: Uuid,
        user_id: Uuid,
    ) -> Result<bool, String>;
}

pub struct ChannelRepository {
    pool: PgPool,
}

impl ChannelRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create(&self, server_id: Uuid, name: &str) -> Result<Channel, sqlx::Error> {
        sqlx::query_as::<_, Channel>(
            r#"
            INSERT INTO channels (id, name, server_id)
            VALUES (gen_random_uuid(), $1, $2)
            RETURNING id, name, server_id, created_at, updated_at
            "#,
        )
        .bind(name)
        .bind(server_id)
        .fetch_one(&self.pool)
        .await
    }

    pub async fn list_for_server(&self, server_id: Uuid) -> Result<Vec<Channel>, sqlx::Error> {
        sqlx::query_as::<_, Channel>(
            r#"
            SELECT id, name, server_id, created_at, updated_at
            FROM channels
            WHERE server_id = $1
            ORDER BY created_at ASC
            "#,
        )
        .bind(server_id)
        .fetch_all(&self.pool)
        .await
    }

    pub async fn update(
        &self,
        channel_id: Uuid,
        payload: UpdateChannel,
    ) -> Result<Channel, sqlx::Error> {
        let name = payload.name.map(|n| n.trim().to_string());

        sqlx::query_as::<_, Channel>(
            r#"
            UPDATE channels
            SET
                name = COALESCE($2, name),
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, name, server_id, created_at, updated_at
            "#,
        )
        .bind(channel_id)
        .bind(name)
        .fetch_one(&self.pool)
        .await
    }

    pub async fn delete(&self, channel_id: Uuid) -> Result<Channel, sqlx::Error> {
        let channel = sqlx::query_as!(
            Channel,
            r#"
        DELETE FROM channels
        WHERE id = $1
        RETURNING id, name, server_id, created_at, updated_at
        "#,
            channel_id
        )
        .fetch_optional(&self.pool)
        .await?;

        match channel {
            Some(channel) => Ok(channel),
            None => Err(sqlx::Error::RowNotFound),
        }
    }

    pub async fn user_is_member(&self, server_id: Uuid, user_id: Uuid) -> Result<bool, String> {
        let exists = sqlx::query_scalar!(
            r#"
            SELECT EXISTS (
                SELECT 1
                FROM server_members
                WHERE server_id = $1
                  AND user_id = $2
            )
            "#,
            server_id,
            user_id
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|e| {
            log::error!("user_is_member error: {:?}", e);
            "DB error".to_string()
        })?;

        Ok(exists.unwrap_or(false))
    }

    pub async fn user_can_manage_channels(
        &self,
        server_id: Uuid,
        user_id: Uuid,
    ) -> Result<bool, String> {
        let allowed = sqlx::query_scalar!(
            r#"
            SELECT EXISTS (
                SELECT 1
                FROM server_members
                WHERE server_id = $1
                  AND user_id = $2
                  AND role IN ('owner', 'admin')
            )
            "#,
            server_id,
            user_id
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|e| {
            log::error!("user_can_manage_channels error: {:?}", e);
            "DB error".to_string()
        })?;

        Ok(allowed.unwrap_or(false))
    }

    pub async fn user_can_manage_channel(
        &self,
        channel_id: Uuid,
        user_id: Uuid,
    ) -> Result<bool, String> {
        let allowed = sqlx::query_scalar!(
            r#"
            SELECT EXISTS (
                SELECT 1
                FROM channels c
                INNER JOIN server_members sm
                    ON sm.server_id = c.server_id
                WHERE c.id = $1
                  AND sm.user_id = $2
                  AND sm.role IN ('owner', 'admin')
            )
            "#,
            channel_id,
            user_id
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|e| {
            log::error!("user_can_manage_channel error: {:?}", e);
            "DB error".to_string()
        })?;

        Ok(allowed.unwrap_or(false))
    }
}

#[async_trait]
impl ChannelRepositoryTrait for ChannelRepository {
    async fn create(&self, server_id: Uuid, name: &str) -> Result<Channel, String> {
        ChannelRepository::create(self, server_id, name)
            .await
            .map_err(|e| e.to_string())
    }

    async fn list_for_server(&self, server_id: Uuid) -> Result<Vec<Channel>, String> {
        ChannelRepository::list_for_server(self, server_id)
            .await
            .map_err(|e| e.to_string())
    }

    async fn update(&self, channel_id: Uuid, payload: UpdateChannel) -> Result<Channel, String> {
        ChannelRepository::update(self, channel_id, payload)
            .await
            .map_err(|e| e.to_string())
    }

    async fn delete(&self, channel_id: Uuid) -> Result<Channel, String> {
        ChannelRepository::delete(self, channel_id)
            .await
            .map_err(|e| e.to_string())
    }

    async fn user_is_member(&self, server_id: Uuid, user_id: Uuid) -> Result<bool, String> {
        ChannelRepository::user_is_member(self, server_id, user_id).await
    }

    async fn user_can_manage_channels(
        &self,
        server_id: Uuid,
        user_id: Uuid,
    ) -> Result<bool, String> {
        ChannelRepository::user_can_manage_channels(self, server_id, user_id).await
    }

    async fn user_can_manage_channel(
        &self,
        channel_id: Uuid,
        user_id: Uuid,
    ) -> Result<bool, String> {
        ChannelRepository::user_can_manage_channel(self, channel_id, user_id).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::PgPool;
    use uuid::Uuid;

    async fn setup_pool() -> PgPool {
        dotenvy::dotenv().ok();

        let database_url = std::env::var("TEST_DATABASE_URL")
            .or_else(|_| std::env::var("DATABASE_URL"))
            .unwrap_or_else(|_| "postgresql://postgres:epitech@127.0.0.1:5432/catcat".to_string());

        eprintln!("TEST DATABASE_URL = {}", database_url);

        sqlx::postgres::PgPoolOptions::new()
            .max_connections(1)
            .connect(&database_url)
            .await
            .unwrap_or_else(|e| {
                panic!(
                    "failed to connect with TEST_DATABASE_URL/DATABASE_URL={database_url:?}: {e}"
                )
            })
    }

    async fn cleanup_db(pool: &PgPool) {
        sqlx::query!("DELETE FROM channels")
            .execute(pool)
            .await
            .unwrap();

        sqlx::query!("DELETE FROM server_members")
            .execute(pool)
            .await
            .unwrap();

        sqlx::query!("DELETE FROM servers")
            .execute(pool)
            .await
            .unwrap();

        sqlx::query!("DELETE FROM users")
            .execute(pool)
            .await
            .unwrap();
    }

    async fn insert_user(pool: &PgPool) -> Uuid {
        let id = Uuid::new_v4();

        sqlx::query!(
            r#"
            INSERT INTO users (id, username, email, password_hash)
            VALUES ($1, $2, $3, $4)
            "#,
            id,
            format!("user_{}", id),
            format!("{}@example.com", id),
            "hashed_password"
        )
        .execute(pool)
        .await
        .unwrap();

        id
    }

    async fn insert_server(pool: &PgPool) -> Uuid {
        let owner_id = insert_user(pool).await;
        let id = Uuid::new_v4();

        sqlx::query!(
            r#"
            INSERT INTO servers (id, name, owner_id, invitation_code)
            VALUES ($1, $2, $3, $4)
            "#,
            id,
            "Test server",
            owner_id,
            format!("invite-{}", &id.to_string()[..8])
        )
        .execute(pool)
        .await
        .unwrap();

        id
    }

    async fn insert_member(pool: &PgPool, server_id: Uuid, user_id: Uuid, role: &str) {
        sqlx::query!(
            r#"
            INSERT INTO server_members (server_id, user_id, role)
            VALUES ($1, $2, $3)
            "#,
            server_id,
            user_id,
            role
        )
        .execute(pool)
        .await
        .unwrap();
    }

    async fn insert_channel(pool: &PgPool, server_id: Uuid, name: &str) -> Channel {
        sqlx::query_as::<_, Channel>(
            r#"
            INSERT INTO channels (id, name, server_id)
            VALUES (gen_random_uuid(), $1, $2)
            RETURNING id, name, server_id, created_at, updated_at
            "#,
        )
        .bind(name)
        .bind(server_id)
        .fetch_one(pool)
        .await
        .unwrap()
    }

    #[actix_web::test]
    async fn create_channel() {
        let pool = setup_pool().await;
        cleanup_db(&pool).await;

        let repo = ChannelRepository::new(pool.clone());
        let server_id = insert_server(&pool).await;

        let channel = repo.create(server_id, "general").await.unwrap();

        assert_eq!(channel.name, "general");
        assert_eq!(channel.server_id, server_id);

        cleanup_db(&pool).await;
    }

    #[actix_web::test]
    async fn create_channel_sets_timestamps() {
        let pool = setup_pool().await;
        cleanup_db(&pool).await;

        let repo = ChannelRepository::new(pool.clone());
        let server_id = insert_server(&pool).await;

        let channel = repo.create(server_id, "general").await.unwrap();

        assert!(channel.created_at <= channel.updated_at);

        cleanup_db(&pool).await;
    }

    #[actix_web::test]
    async fn create_channel_does_not_trim_name_in_repository() {
        let pool = setup_pool().await;
        cleanup_db(&pool).await;

        let repo = ChannelRepository::new(pool.clone());
        let server_id = insert_server(&pool).await;

        let channel = repo.create(server_id, "  general  ").await.unwrap();

        assert_eq!(channel.name, "  general  ");

        cleanup_db(&pool).await;
    }

    #[actix_web::test]
    async fn create_channel_returns_error_when_server_does_not_exist() {
        let pool = setup_pool().await;
        cleanup_db(&pool).await;

        let repo = ChannelRepository::new(pool.clone());

        let result = repo.create(Uuid::new_v4(), "general").await;

        assert!(result.is_err());

        cleanup_db(&pool).await;
    }

    #[actix_web::test]
    async fn list_for_server_returns_only_channels_for_given_server() {
        let pool = setup_pool().await;
        cleanup_db(&pool).await;

        let repo = ChannelRepository::new(pool.clone());
        let server_1 = insert_server(&pool).await;
        let server_2 = insert_server(&pool).await;

        let c1 = insert_channel(&pool, server_1, "general").await;
        let c2 = insert_channel(&pool, server_1, "random").await;
        let _other = insert_channel(&pool, server_2, "private").await;

        let channels = repo.list_for_server(server_1).await.unwrap();

        assert_eq!(channels.len(), 2);
        assert!(channels.iter().any(|c| c.id == c1.id));
        assert!(channels.iter().any(|c| c.id == c2.id));
        assert!(channels.iter().all(|c| c.server_id == server_1));

        cleanup_db(&pool).await;
    }

    #[actix_web::test]
    async fn list_for_server_returns_empty_vec_when_no_channels() {
        let pool = setup_pool().await;
        cleanup_db(&pool).await;

        let repo = ChannelRepository::new(pool.clone());
        let server_id = insert_server(&pool).await;

        let channels = repo.list_for_server(server_id).await.unwrap();

        assert!(channels.is_empty());

        cleanup_db(&pool).await;
    }

    #[actix_web::test]
    async fn list_for_server_returns_channels_in_created_at_order() {
        let pool = setup_pool().await;
        cleanup_db(&pool).await;

        let repo = ChannelRepository::new(pool.clone());
        let server_id = insert_server(&pool).await;

        let first = insert_channel(&pool, server_id, "first").await;
        actix_web::rt::time::sleep(std::time::Duration::from_millis(5)).await;
        let second = insert_channel(&pool, server_id, "second").await;

        let channels = repo.list_for_server(server_id).await.unwrap();

        assert_eq!(channels.len(), 2);
        assert_eq!(channels[0].id, first.id);
        assert_eq!(channels[1].id, second.id);

        cleanup_db(&pool).await;
    }

    #[actix_web::test]
    async fn update_channel_name() {
        let pool = setup_pool().await;
        cleanup_db(&pool).await;

        let repo = ChannelRepository::new(pool.clone());
        let server_id = insert_server(&pool).await;
        let channel = insert_channel(&pool, server_id, "general").await;

        let updated = repo
            .update(
                channel.id,
                UpdateChannel {
                    name: Some("  renamed-channel  ".to_string()),
                },
            )
            .await
            .unwrap();

        assert_eq!(updated.name, "renamed-channel");
        assert_eq!(updated.id, channel.id);
        assert_eq!(updated.server_id, server_id);

        cleanup_db(&pool).await;
    }

    #[actix_web::test]
    async fn update_channel_updates_updated_at() {
        let pool = setup_pool().await;
        cleanup_db(&pool).await;

        let repo = ChannelRepository::new(pool.clone());
        let server_id = insert_server(&pool).await;
        let channel = insert_channel(&pool, server_id, "general").await;

        actix_web::rt::time::sleep(std::time::Duration::from_millis(5)).await;

        let updated = repo
            .update(
                channel.id,
                UpdateChannel {
                    name: Some("renamed".to_string()),
                },
            )
            .await
            .unwrap();

        assert!(updated.updated_at >= channel.updated_at);

        cleanup_db(&pool).await;
    }

    #[actix_web::test]
    async fn update_channel_with_spaces_only_sets_empty_string() {
        let pool = setup_pool().await;
        cleanup_db(&pool).await;

        let repo = ChannelRepository::new(pool.clone());
        let server_id = insert_server(&pool).await;
        let channel = insert_channel(&pool, server_id, "general").await;

        let updated = repo
            .update(
                channel.id,
                UpdateChannel {
                    name: Some("   ".to_string()),
                },
            )
            .await
            .unwrap();

        assert_eq!(updated.name, "");

        cleanup_db(&pool).await;
    }

    #[actix_web::test]
    async fn update_channel_with_none_keeps_existing_name() {
        let pool = setup_pool().await;
        cleanup_db(&pool).await;

        let repo = ChannelRepository::new(pool.clone());
        let server_id = insert_server(&pool).await;
        let channel = insert_channel(&pool, server_id, "general").await;

        let updated = repo
            .update(channel.id, UpdateChannel { name: None })
            .await
            .unwrap();

        assert_eq!(updated.name, "general");

        cleanup_db(&pool).await;
    }

    #[actix_web::test]
    async fn update_channel_with_same_name_still_returns_row() {
        let pool = setup_pool().await;
        cleanup_db(&pool).await;

        let repo = ChannelRepository::new(pool.clone());
        let server_id = insert_server(&pool).await;
        let channel = insert_channel(&pool, server_id, "general").await;

        let updated = repo
            .update(
                channel.id,
                UpdateChannel {
                    name: Some("general".to_string()),
                },
            )
            .await
            .unwrap();

        assert_eq!(updated.id, channel.id);
        assert_eq!(updated.name, "general");

        cleanup_db(&pool).await;
    }

    #[actix_web::test]
    async fn update_returns_row_not_found_when_channel_missing() {
        let pool = setup_pool().await;
        cleanup_db(&pool).await;

        let repo = ChannelRepository::new(pool.clone());

        let result = repo
            .update(
                Uuid::new_v4(),
                UpdateChannel {
                    name: Some("new-name".to_string()),
                },
            )
            .await;

        assert!(
            matches!(result, Err(sqlx::Error::RowNotFound)),
            "unexpected result: {:?}",
            result
        );

        cleanup_db(&pool).await;
    }

    #[actix_web::test]
    async fn delete_channel_success() {
        let pool = setup_pool().await;
        cleanup_db(&pool).await;

        let repo = ChannelRepository::new(pool.clone());
        let server_id = insert_server(&pool).await;
        let channel = insert_channel(&pool, server_id, "general").await;

        let result = repo.delete(channel.id).await;
        assert!(result.is_ok());

        let fetched = sqlx::query!(
            r#"
            SELECT id
            FROM channels
            WHERE id = $1
            "#,
            channel.id
        )
        .fetch_optional(&pool)
        .await
        .unwrap();

        assert!(fetched.is_none());

        cleanup_db(&pool).await;
    }

    #[actix_web::test]
    async fn delete_channel_returns_row_not_found_when_missing() {
        let pool = setup_pool().await;
        cleanup_db(&pool).await;

        let repo = ChannelRepository::new(pool.clone());

        let result = repo.delete(Uuid::new_v4()).await;

        assert!(
            matches!(result, Err(sqlx::Error::RowNotFound)),
            "unexpected result: {:?}",
            result
        );

        cleanup_db(&pool).await;
    }

    #[actix_web::test]
    async fn user_is_member_returns_true_when_membership_exists() {
        let pool = setup_pool().await;
        cleanup_db(&pool).await;

        let repo = ChannelRepository::new(pool.clone());
        let server_id = insert_server(&pool).await;
        let user_id = insert_user(&pool).await;

        insert_member(&pool, server_id, user_id, "member").await;

        let is_member = repo.user_is_member(server_id, user_id).await.unwrap();

        assert!(is_member);

        cleanup_db(&pool).await;
    }

    #[actix_web::test]
    async fn user_is_member_returns_false_when_membership_missing() {
        let pool = setup_pool().await;
        cleanup_db(&pool).await;

        let repo = ChannelRepository::new(pool.clone());
        let server_id = insert_server(&pool).await;
        let user_id = insert_user(&pool).await;

        let is_member = repo.user_is_member(server_id, user_id).await.unwrap();

        assert!(!is_member);

        cleanup_db(&pool).await;
    }

    #[actix_web::test]
    async fn user_is_member_returns_false_when_server_or_user_missing() {
        let pool = setup_pool().await;
        cleanup_db(&pool).await;

        let repo = ChannelRepository::new(pool.clone());

        let is_member = repo
            .user_is_member(Uuid::new_v4(), Uuid::new_v4())
            .await
            .unwrap();

        assert!(!is_member);

        cleanup_db(&pool).await;
    }

    #[actix_web::test]
    async fn user_can_manage_channels_returns_true_for_owner() {
        let pool = setup_pool().await;
        cleanup_db(&pool).await;

        let repo = ChannelRepository::new(pool.clone());
        let server_id = insert_server(&pool).await;
        let user_id = insert_user(&pool).await;

        insert_member(&pool, server_id, user_id, "owner").await;

        let allowed = repo
            .user_can_manage_channels(server_id, user_id)
            .await
            .unwrap();

        assert!(allowed);

        cleanup_db(&pool).await;
    }

    #[actix_web::test]
    async fn user_can_manage_channels_returns_true_for_admin() {
        let pool = setup_pool().await;
        cleanup_db(&pool).await;

        let repo = ChannelRepository::new(pool.clone());
        let server_id = insert_server(&pool).await;
        let user_id = insert_user(&pool).await;

        insert_member(&pool, server_id, user_id, "admin").await;

        let allowed = repo
            .user_can_manage_channels(server_id, user_id)
            .await
            .unwrap();

        assert!(allowed);

        cleanup_db(&pool).await;
    }

    #[actix_web::test]
    async fn user_can_manage_channels_returns_false_for_regular_member() {
        let pool = setup_pool().await;
        cleanup_db(&pool).await;

        let repo = ChannelRepository::new(pool.clone());
        let server_id = insert_server(&pool).await;
        let user_id = insert_user(&pool).await;

        insert_member(&pool, server_id, user_id, "member").await;

        let allowed = repo
            .user_can_manage_channels(server_id, user_id)
            .await
            .unwrap();

        assert!(!allowed);

        cleanup_db(&pool).await;
    }

    #[actix_web::test]
    async fn user_can_manage_channels_returns_false_when_server_or_user_missing() {
        let pool = setup_pool().await;
        cleanup_db(&pool).await;

        let repo = ChannelRepository::new(pool.clone());

        let allowed = repo
            .user_can_manage_channels(Uuid::new_v4(), Uuid::new_v4())
            .await
            .unwrap();

        assert!(!allowed);

        cleanup_db(&pool).await;
    }

    #[actix_web::test]
    async fn user_can_manage_channel_returns_true_for_admin_of_linked_server() {
        let pool = setup_pool().await;
        cleanup_db(&pool).await;

        let repo = ChannelRepository::new(pool.clone());
        let server_id = insert_server(&pool).await;
        let user_id = insert_user(&pool).await;
        let channel = insert_channel(&pool, server_id, "general").await;

        insert_member(&pool, server_id, user_id, "admin").await;

        let allowed = repo
            .user_can_manage_channel(channel.id, user_id)
            .await
            .unwrap();

        assert!(allowed);

        cleanup_db(&pool).await;
    }

    #[actix_web::test]
    async fn user_can_manage_channel_returns_true_for_owner_of_linked_server() {
        let pool = setup_pool().await;
        cleanup_db(&pool).await;

        let repo = ChannelRepository::new(pool.clone());
        let server_id = insert_server(&pool).await;
        let user_id = insert_user(&pool).await;
        let channel = insert_channel(&pool, server_id, "general").await;

        insert_member(&pool, server_id, user_id, "owner").await;

        let allowed = repo
            .user_can_manage_channel(channel.id, user_id)
            .await
            .unwrap();

        assert!(allowed);

        cleanup_db(&pool).await;
    }

    #[actix_web::test]
    async fn user_can_manage_channel_returns_false_for_non_admin() {
        let pool = setup_pool().await;
        cleanup_db(&pool).await;

        let repo = ChannelRepository::new(pool.clone());
        let server_id = insert_server(&pool).await;
        let user_id = insert_user(&pool).await;
        let channel = insert_channel(&pool, server_id, "general").await;

        insert_member(&pool, server_id, user_id, "member").await;

        let allowed = repo
            .user_can_manage_channel(channel.id, user_id)
            .await
            .unwrap();

        assert!(!allowed);

        cleanup_db(&pool).await;
    }

    #[actix_web::test]
    async fn user_can_manage_channel_returns_false_when_admin_of_other_server() {
        let pool = setup_pool().await;
        cleanup_db(&pool).await;

        let repo = ChannelRepository::new(pool.clone());
        let server_1 = insert_server(&pool).await;
        let server_2 = insert_server(&pool).await;
        let user_id = insert_user(&pool).await;
        let channel = insert_channel(&pool, server_1, "general").await;

        insert_member(&pool, server_2, user_id, "admin").await;

        let allowed = repo
            .user_can_manage_channel(channel.id, user_id)
            .await
            .unwrap();

        assert!(!allowed);

        cleanup_db(&pool).await;
    }

    #[actix_web::test]
    async fn user_can_manage_channel_returns_false_when_channel_missing() {
        let pool = setup_pool().await;
        cleanup_db(&pool).await;

        let repo = ChannelRepository::new(pool.clone());
        let _server_id = insert_server(&pool).await;
        let user_id = insert_user(&pool).await;

        let allowed = repo
            .user_can_manage_channel(Uuid::new_v4(), user_id)
            .await
            .unwrap();

        assert!(!allowed);

        cleanup_db(&pool).await;
    }

    #[actix_web::test]
    async fn trait_create_works_via_dyn_repository_trait() {
        let pool = setup_pool().await;
        cleanup_db(&pool).await;

        let repo = ChannelRepository::new(pool.clone());
        let repo_trait: &dyn ChannelRepositoryTrait = &repo;
        let server_id = insert_server(&pool).await;

        let channel = repo_trait.create(server_id, "general").await.unwrap();

        assert_eq!(channel.name, "general");
        assert_eq!(channel.server_id, server_id);

        cleanup_db(&pool).await;
    }

    #[actix_web::test]
    async fn trait_list_for_server_works_via_dyn_repository_trait() {
        let pool = setup_pool().await;
        cleanup_db(&pool).await;

        let repo = ChannelRepository::new(pool.clone());
        let repo_trait: &dyn ChannelRepositoryTrait = &repo;
        let server_id = insert_server(&pool).await;

        let first = insert_channel(&pool, server_id, "general").await;
        let second = insert_channel(&pool, server_id, "random").await;

        let channels = repo_trait.list_for_server(server_id).await.unwrap();

        assert_eq!(channels.len(), 2);
        assert!(channels.iter().any(|c| c.id == first.id));
        assert!(channels.iter().any(|c| c.id == second.id));

        cleanup_db(&pool).await;
    }

    #[actix_web::test]
    async fn trait_update_works_via_dyn_repository_trait() {
        let pool = setup_pool().await;
        cleanup_db(&pool).await;

        let repo = ChannelRepository::new(pool.clone());
        let repo_trait: &dyn ChannelRepositoryTrait = &repo;
        let server_id = insert_server(&pool).await;
        let channel = insert_channel(&pool, server_id, "general").await;

        let updated = repo_trait
            .update(
                channel.id,
                UpdateChannel {
                    name: Some("updated-via-trait".to_string()),
                },
            )
            .await
            .unwrap();

        assert_eq!(updated.id, channel.id);
        assert_eq!(updated.name, "updated-via-trait");

        cleanup_db(&pool).await;
    }

    #[actix_web::test]
    async fn trait_delete_works_via_dyn_repository_trait() {
        let pool = setup_pool().await;
        cleanup_db(&pool).await;

        let repo = ChannelRepository::new(pool.clone());
        let repo_trait: &dyn ChannelRepositoryTrait = &repo;
        let server_id = insert_server(&pool).await;
        let channel = insert_channel(&pool, server_id, "general").await;

        let result = repo_trait.delete(channel.id).await;

        assert!(result.is_ok());

        cleanup_db(&pool).await;
    }

    #[actix_web::test]
    async fn trait_user_is_member_works_via_dyn_repository_trait() {
        let pool = setup_pool().await;
        cleanup_db(&pool).await;

        let repo = ChannelRepository::new(pool.clone());
        let repo_trait: &dyn ChannelRepositoryTrait = &repo;
        let server_id = insert_server(&pool).await;
        let user_id = insert_user(&pool).await;

        insert_member(&pool, server_id, user_id, "member").await;

        let is_member = repo_trait.user_is_member(server_id, user_id).await.unwrap();

        assert!(is_member);

        cleanup_db(&pool).await;
    }

    #[actix_web::test]
    async fn trait_user_can_manage_channels_works_via_dyn_repository_trait() {
        let pool = setup_pool().await;
        cleanup_db(&pool).await;

        let repo = ChannelRepository::new(pool.clone());
        let repo_trait: &dyn ChannelRepositoryTrait = &repo;
        let server_id = insert_server(&pool).await;
        let user_id = insert_user(&pool).await;

        insert_member(&pool, server_id, user_id, "admin").await;

        let allowed = repo_trait
            .user_can_manage_channels(server_id, user_id)
            .await
            .unwrap();

        assert!(allowed);

        cleanup_db(&pool).await;
    }

    #[actix_web::test]
    async fn trait_user_can_manage_channel_works_via_dyn_repository_trait() {
        let pool = setup_pool().await;
        cleanup_db(&pool).await;

        let repo = ChannelRepository::new(pool.clone());
        let repo_trait: &dyn ChannelRepositoryTrait = &repo;
        let server_id = insert_server(&pool).await;
        let user_id = insert_user(&pool).await;
        let channel = insert_channel(&pool, server_id, "general").await;

        insert_member(&pool, server_id, user_id, "owner").await;

        let allowed = repo_trait
            .user_can_manage_channel(channel.id, user_id)
            .await
            .unwrap();

        assert!(allowed);

        cleanup_db(&pool).await;
    }
}
