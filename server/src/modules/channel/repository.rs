use sqlx::PgPool;
use uuid::Uuid;

use crate::models::channel::{Channel, UpdateChannel};

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

    pub async fn update(&self, channel_id: Uuid, payload: UpdateChannel) -> Result<Channel, sqlx::Error> {
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

    pub async fn delete(&self, channel_id: Uuid) -> Result<(), sqlx::Error> {
        let res = sqlx::query!(r#"DELETE FROM channels WHERE id = $1"#, channel_id)
            .execute(&self.pool)
            .await?;

        if res.rows_affected() == 0 {
            return Err(sqlx::Error::RowNotFound);
        }

        Ok(())
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

    pub async fn user_can_manage_channels(&self, server_id: Uuid, user_id: Uuid) -> Result<bool, String> {
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

    pub async fn user_can_manage_channel(&self, channel_id: Uuid, user_id: Uuid) -> Result<bool, String> {
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
