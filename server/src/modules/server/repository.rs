use crate::models::server::{Server, UpdateServer};
use crate::models::server_ban::ServerBanResponse;
use crate::models::server_member::{ServerMemberResponse, ServerMemberRole};
use chrono::{DateTime, Duration, Utc};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;

#[derive(Debug, FromRow)]
struct ServerMemberRow {
    user_id: Uuid,
    username: String,
    role: String,
}

#[derive(Clone)]
pub struct ServerRepository {
    pool: PgPool,
}

impl ServerRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create_with_owner(
        &self,
        owner_id: Uuid,
        name: &str,
    ) -> Result<Server, sqlx::Error> {
        let mut tx: Transaction<'_, Postgres> = self.pool.begin().await?;

        let server = self
            .insert_server_retrying_code(&mut tx, owner_id, name)
            .await?;

        sqlx::query(
            r#"
            INSERT INTO server_members (server_id, user_id, role)
            VALUES ($1, $2, 'owner')
            ON CONFLICT (server_id, user_id) DO NOTHING
            "#,
        )
        .bind(server.id)
        .bind(owner_id)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(server)
    }

    pub async fn is_banned(&self, server_id: Uuid, user_id: Uuid) -> Result<bool, sqlx::Error> {
        let exists = sqlx::query_scalar::<_, bool>(
            r#"
        SELECT EXISTS(
            SELECT 1
            FROM server_bans
            WHERE server_id = $1
              AND user_id = $2
              AND (expires_at IS NULL OR expires_at > NOW())
        )
        "#,
        )
        .bind(server_id)
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(exists)
    }

    pub async fn ban_member(
        &self,
        server_id: Uuid,
        user_id: Uuid,
        banned_by: Uuid,
        reason: Option<String>,
        expires_at: Option<DateTime<Utc>>,
    ) -> Result<(), sqlx::Error> {
        let mut tx: Transaction<'_, Postgres> = self.pool.begin().await?;

        sqlx::query(
            r#"
        INSERT INTO server_bans (server_id, user_id, banned_by, reason, expires_at)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (server_id, user_id)
        DO UPDATE SET
            banned_by = EXCLUDED.banned_by,
            reason = EXCLUDED.reason,
            expires_at = EXCLUDED.expires_at,
            created_at = NOW()
        "#,
        )
        .bind(server_id)
        .bind(user_id)
        .bind(banned_by)
        .bind(reason)
        .bind(expires_at.map(|dt| dt.naive_utc()))
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            r#"
        DELETE FROM server_members
        WHERE server_id = $1 AND user_id = $2
        "#,
        )
        .bind(server_id)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(())
    }

    pub async fn list_bans(&self, server_id: Uuid) -> Result<Vec<ServerBanResponse>, sqlx::Error> {
        let bans = sqlx::query_as::<_, ServerBanResponse>(
            r#"
        SELECT
            sb.user_id,
            u.username,
            sb.reason,
            sb.created_at,
            sb.expires_at
        FROM server_bans sb
        INNER JOIN users u ON u.id = sb.user_id
        WHERE sb.server_id = $1
          AND (sb.expires_at IS NULL OR sb.expires_at > NOW())
        ORDER BY sb.created_at DESC
        "#,
        )
        .bind(server_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(bans)
    }

    pub async fn unban_member(&self, server_id: Uuid, user_id: Uuid) -> Result<(), sqlx::Error> {
        let res = sqlx::query(
            r#"
        DELETE FROM server_bans
        WHERE server_id = $1 AND user_id = $2
        "#,
        )
        .bind(server_id)
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        if res.rows_affected() == 0 {
            return Err(sqlx::Error::RowNotFound);
        }

        Ok(())
    }

    async fn insert_server_retrying_code(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        owner_id: Uuid,
        name: &str,
    ) -> Result<Server, sqlx::Error> {
        const MAX_TRIES: usize = 5;

        for _ in 0..MAX_TRIES {
            let id = Uuid::new_v4();
            let code = crate::models::server::Server::generate_invitation_code();

            let inserted = sqlx::query_as::<_, Server>(
                r#"
                INSERT INTO servers (id, name, owner_id, invitation_code)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (invitation_code) DO NOTHING
                RETURNING id, name, owner_id, invitation_code, created_at, updated_at
                "#,
            )
            .bind(id)
            .bind(name)
            .bind(owner_id)
            .bind(code)
            .fetch_optional(&mut **tx)
            .await?;

            if let Some(server) = inserted {
                return Ok(server);
            }
        }

        Err(sqlx::Error::Protocol(
            "Failed to generate unique invitation_code after retries".into(),
        ))
    }

    pub async fn list_for_user(&self, user_id: Uuid) -> Result<Vec<Server>, sqlx::Error> {
        let servers = sqlx::query_as::<_, Server>(
            r#"
            SELECT s.id, s.name, s.owner_id, s.invitation_code, s.created_at, s.updated_at
            FROM servers s
            INNER JOIN server_members sm ON sm.server_id = s.id
            WHERE sm.user_id = $1
            ORDER BY s.created_at DESC
            "#,
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(servers)
    }

    pub async fn join_by_invitation_code(
        &self,
        user_id: Uuid,
        code: &str,
    ) -> Result<(Server, bool), sqlx::Error> {
        let mut tx: Transaction<'_, Postgres> = self.pool.begin().await?;

        let server = sqlx::query_as::<_, Server>(
            r#"
        SELECT id, name, owner_id, invitation_code, created_at, updated_at
        FROM servers
        WHERE invitation_code = $1
        "#,
        )
        .bind(code)
        .fetch_one(&mut *tx)
        .await?;

        let is_banned = sqlx::query_scalar::<_, bool>(
            r#"
                SELECT EXISTS(
                    SELECT 1
                    FROM server_bans
                    WHERE server_id = $1
                      AND user_id = $2
                      AND (expires_at IS NULL OR expires_at > NOW())
                )
            "#,
        )
        .bind(server.id)
        .bind(user_id)
        .fetch_one(&mut *tx)
        .await?;

        if is_banned {
            tx.rollback().await?;
            return Err(sqlx::Error::Protocol(
                "User is banned from this server".into(),
            ));
        }

        let inserted = sqlx::query_scalar::<_, Uuid>(
            r#"
        INSERT INTO server_members (server_id, user_id, role)
        VALUES ($1, $2, 'member')
        ON CONFLICT (server_id, user_id) DO NOTHING
        RETURNING server_id
        "#,
        )
        .bind(server.id)
        .bind(user_id)
        .fetch_optional(&mut *tx)
        .await?
        .is_some();

        tx.commit().await?;
        Ok((server, inserted))
    }

    pub async fn leave_server(
        &self,
        server_id: Uuid,
        user_id: Uuid,
    ) -> Result<(Server, bool), sqlx::Error> {
        let mut tx: Transaction<'_, Postgres> = self.pool.begin().await?;

        let server = sqlx::query_as::<_, Server>(
            r#"
            SELECT id, name, owner_id, invitation_code, created_at, updated_at
            FROM servers
            WHERE id = $1
            "#,
        )
        .bind(server_id)
        .fetch_one(&mut *tx)
        .await?;

        if server.owner_id == user_id {
            tx.rollback().await?;
            return Err(sqlx::Error::Protocol(
                "Owner cannot leave their own server".into(),
            ));
        }

        let affected = sqlx::query(
            r#"
            DELETE FROM server_members
            WHERE server_id = $1 AND user_id = $2
            "#,
        )
        .bind(server_id)
        .bind(user_id)
        .execute(&mut *tx)
        .await?
        .rows_affected();

        tx.commit().await?;
        Ok((server, affected > 0))
    }

    pub async fn is_member(&self, server_id: Uuid, user_id: Uuid) -> Result<bool, sqlx::Error> {
        let exists = sqlx::query_scalar::<_, bool>(
            r#"
            SELECT EXISTS(
              SELECT 1 FROM server_members
              WHERE server_id = $1 AND user_id = $2
            )
            "#,
        )
        .bind(server_id)
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(exists)
    }

    pub async fn get_username(&self, user_id: Uuid) -> Result<String, sqlx::Error> {
        let username = sqlx::query_scalar::<_, String>(
            r#"
            SELECT username
            FROM users
            WHERE id = $1
            "#,
        )
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(username)
    }

    pub async fn list_members(
        &self,
        server_id: Uuid,
    ) -> Result<Vec<ServerMemberResponse>, sqlx::Error> {
        let rows = sqlx::query_as::<_, ServerMemberRow>(
            r#"
            SELECT
                sm.user_id,
                u.username,
                sm.role
            FROM server_members sm
            INNER JOIN users u ON u.id = sm.user_id
            WHERE sm.server_id = $1
            ORDER BY u.username ASC
            "#,
        )
        .bind(server_id)
        .fetch_all(&self.pool)
        .await?;

        let members = rows
            .into_iter()
            .filter_map(|r| {
                let role = match r.role.as_str() {
                    "owner" => ServerMemberRole::Owner,
                    "admin" => ServerMemberRole::Admin,
                    "member" => ServerMemberRole::Member,
                    _ => return None,
                };

                Some(ServerMemberResponse {
                    user_id: r.user_id,
                    username: r.username,
                    role,
                })
            })
            .collect();

        Ok(members)
    }

    pub async fn get_member_role(
        &self,
        server_id: Uuid,
        user_id: Uuid,
    ) -> Result<ServerMemberRole, sqlx::Error> {
        let role = sqlx::query_scalar::<_, String>(
            r#"
            SELECT role
            FROM server_members
            WHERE server_id = $1 AND user_id = $2
            "#,
        )
        .bind(server_id)
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        ServerMemberRole::try_from(role).map_err(|e| sqlx::Error::Protocol(e.into()))
    }

    pub async fn update_member_role(
        &self,
        server_id: Uuid,
        user_id: Uuid,
        role: ServerMemberRole,
    ) -> Result<(), sqlx::Error> {
        let res = sqlx::query(
            r#"
            UPDATE server_members
            SET role = $3
            WHERE server_id = $1
              AND user_id = $2
              AND role != 'owner'
            "#,
        )
        .bind(server_id)
        .bind(user_id)
        .bind(role.as_str())
        .execute(&self.pool)
        .await?;

        if res.rows_affected() == 0 {
            return Err(sqlx::Error::RowNotFound);
        }

        Ok(())
    }

    pub async fn transfer_owner(
        &self,
        server_id: Uuid,
        old_owner_id: Uuid,
        new_owner_id: Uuid,
    ) -> Result<Server, sqlx::Error> {
        let mut tx: Transaction<'_, Postgres> = self.pool.begin().await?;

        let server = sqlx::query_as::<_, Server>(
            r#"
            UPDATE servers
            SET owner_id = $2,
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, name, owner_id, invitation_code, created_at, updated_at
            "#,
        )
        .bind(server_id)
        .bind(new_owner_id)
        .fetch_one(&mut *tx)
        .await?;

        sqlx::query(
            r#"
            UPDATE server_members
            SET role = 'owner'
            WHERE server_id = $1 AND user_id = $2
            "#,
        )
        .bind(server_id)
        .bind(new_owner_id)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            r#"
            UPDATE server_members
            SET role = 'member'
            WHERE server_id = $1 AND user_id = $2
            "#,
        )
        .bind(server_id)
        .bind(old_owner_id)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(server)
    }

    pub async fn remove_member(&self, server_id: Uuid, user_id: Uuid) -> Result<(), sqlx::Error> {
        let res = sqlx::query(
            r#"
            DELETE FROM server_members
            WHERE server_id = $1 AND user_id = $2
            "#,
        )
        .bind(server_id)
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        if res.rows_affected() == 0 {
            return Err(sqlx::Error::RowNotFound);
        }

        Ok(())
    }

    pub async fn find_by_id(&self, server_id: Uuid) -> Result<Server, sqlx::Error> {
        sqlx::query_as::<_, Server>(
            r#"
            SELECT id, name, owner_id, invitation_code, created_at, updated_at
            FROM servers
            WHERE id = $1
            "#,
        )
        .bind(server_id)
        .fetch_one(&self.pool)
        .await
    }

    pub async fn update(
        &self,
        server_id: Uuid,
        payload: UpdateServer,
    ) -> Result<Server, sqlx::Error> {
        let name = payload.name.map(|s| s.trim().to_string());

        sqlx::query_as::<_, Server>(
            r#"
            UPDATE servers
            SET
                name = COALESCE($2, name),
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, name, owner_id, invitation_code, created_at, updated_at
            "#,
        )
        .bind(server_id)
        .bind(name)
        .fetch_one(&self.pool)
        .await
    }

    pub async fn delete_server(&self, server_id: Uuid, owner_id: Uuid) -> Result<(), sqlx::Error> {
        let mut tx: Transaction<'_, Postgres> = self.pool.begin().await?;

        sqlx::query(r#"DELETE FROM server_members WHERE server_id = $1"#)
            .bind(server_id)
            .execute(&mut *tx)
            .await?;

        let res = sqlx::query(
            r#"
            DELETE FROM servers
            WHERE id = $1 AND owner_id = $2
            "#,
        )
        .bind(server_id)
        .bind(owner_id)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        if res.rows_affected() == 0 {
            return Err(sqlx::Error::RowNotFound);
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use sqlx::Row;

    async fn pool_or_skip() -> Option<PgPool> {
        let url = match std::env::var("DATABASE_URL") {
            Ok(v) if !v.trim().is_empty() => v,
            _ => {
                eprintln!("SKIP: DATABASE_URL not set (set it to run ServerRepository DB tests)");
                return None;
            }
        };

        let pool = match PgPool::connect(&url).await {
            Ok(p) => p,
            Err(e) => {
                eprintln!("SKIP: cannot connect DATABASE_URL: {e}");
                return None;
            }
        };

        Some(pool)
    }

    async fn insert_user(pool: &PgPool, user_id: Uuid, username: &str, email: &str) {
        let _ = sqlx::query(
            r#"
            INSERT INTO users (id, username, email, password_hash, created_at, updated_at)
            VALUES ($1, $2, $3, 'x', NOW(), NOW())
            ON CONFLICT (id) DO NOTHING
            "#,
        )
        .bind(user_id)
        .bind(username)
        .bind(email)
        .execute(pool)
        .await;
    }

    async fn cleanup(pool: &PgPool, server_id: Uuid, user_ids: &[Uuid]) {
        let _ = sqlx::query("DELETE FROM server_bans WHERE server_id = $1")
            .bind(server_id)
            .execute(pool)
            .await;

        let _ = sqlx::query("DELETE FROM server_members WHERE server_id = $1")
            .bind(server_id)
            .execute(pool)
            .await;

        let _ = sqlx::query("DELETE FROM servers WHERE id = $1")
            .bind(server_id)
            .execute(pool)
            .await;

        for uid in user_ids {
            let _ = sqlx::query("DELETE FROM users WHERE id = $1")
                .bind(*uid)
                .execute(pool)
                .await;
        }
    }

    #[actix_web::test]
    async fn test_create_with_owner_creates_server_and_owner_member() {
        let pool = match pool_or_skip().await {
            Some(p) => p,
            None => return,
        };

        let repo = ServerRepository::new(pool.clone());

        let owner_id = Uuid::new_v4();
        insert_user(&pool, owner_id, "repo_owner_u", "repo_owner_u@example.com").await;

        let server = repo
            .create_with_owner(owner_id, "repo test server")
            .await
            .unwrap();
        assert_eq!(server.owner_id, owner_id);

        let is_member = repo.is_member(server.id, owner_id).await.unwrap();
        assert!(is_member);

        let role = repo.get_member_role(server.id, owner_id).await.unwrap();
        assert!(matches!(role, ServerMemberRole::Owner));

        cleanup(&pool, server.id, &[owner_id]).await;
    }

    #[actix_web::test]
    async fn test_join_by_invitation_code_inserts_once_then_returns_false_on_second_join() {
        let pool = match pool_or_skip().await {
            Some(p) => p,
            None => return,
        };

        let repo = ServerRepository::new(pool.clone());

        let owner_id = Uuid::new_v4();
        let user_id = Uuid::new_v4();
        insert_user(&pool, owner_id, "repo_owner2", "repo_owner2@example.com").await;
        insert_user(&pool, user_id, "repo_user2", "repo_user2@example.com").await;

        let server = repo
            .create_with_owner(owner_id, "repo join test")
            .await
            .unwrap();

        let (_s, inserted1) = repo
            .join_by_invitation_code(user_id, &server.invitation_code)
            .await
            .unwrap();
        assert!(inserted1);

        let (_s, inserted2) = repo
            .join_by_invitation_code(user_id, &server.invitation_code)
            .await
            .unwrap();
        assert!(!inserted2);

        cleanup(&pool, server.id, &[owner_id, user_id]).await;
    }

    #[actix_web::test]
    async fn test_leave_server_owner_cannot_leave() {
        let pool = match pool_or_skip().await {
            Some(p) => p,
            None => return,
        };

        let repo = ServerRepository::new(pool.clone());

        let owner_id = Uuid::new_v4();
        insert_user(&pool, owner_id, "repo_owner3", "repo_owner3@example.com").await;

        let server = repo
            .create_with_owner(owner_id, "repo leave test")
            .await
            .unwrap();

        let err = repo.leave_server(server.id, owner_id).await.unwrap_err();
        match err {
            sqlx::Error::Protocol(msg) => assert!(msg.contains("Owner cannot leave")),
            other => panic!("expected Protocol error, got {other:?}"),
        }

        cleanup(&pool, server.id, &[owner_id]).await;
    }

    #[actix_web::test]
    async fn test_update_member_role_cannot_update_owner_returns_rownotfound() {
        let pool = match pool_or_skip().await {
            Some(p) => p,
            None => return,
        };

        let repo = ServerRepository::new(pool.clone());

        let owner_id = Uuid::new_v4();
        insert_user(&pool, owner_id, "repo_owner4", "repo_owner4@example.com").await;

        let server = repo
            .create_with_owner(owner_id, "repo role test")
            .await
            .unwrap();

        let err = repo
            .update_member_role(server.id, owner_id, ServerMemberRole::Admin)
            .await
            .unwrap_err();
        assert!(matches!(err, sqlx::Error::RowNotFound));

        cleanup(&pool, server.id, &[owner_id]).await;
    }

    #[actix_web::test]
    async fn test_transfer_owner_updates_server_and_roles() {
        let pool = match pool_or_skip().await {
            Some(p) => p,
            None => return,
        };

        let repo = ServerRepository::new(pool.clone());

        let old_owner_id = Uuid::new_v4();
        let new_owner_id = Uuid::new_v4();
        insert_user(
            &pool,
            old_owner_id,
            "repo_owner5",
            "repo_owner5@example.com",
        )
        .await;
        insert_user(
            &pool,
            new_owner_id,
            "repo_owner6",
            "repo_owner6@example.com",
        )
        .await;

        let server = repo
            .create_with_owner(old_owner_id, "repo transfer test")
            .await
            .unwrap();

        let _ = sqlx::query(
            r#"
            INSERT INTO server_members (server_id, user_id, role)
            VALUES ($1, $2, 'member')
            ON CONFLICT (server_id, user_id) DO NOTHING
            "#,
        )
        .bind(server.id)
        .bind(new_owner_id)
        .execute(&pool)
        .await
        .unwrap();

        let updated = repo
            .transfer_owner(server.id, old_owner_id, new_owner_id)
            .await
            .unwrap();
        assert_eq!(updated.owner_id, new_owner_id);

        let r_new = repo.get_member_role(server.id, new_owner_id).await.unwrap();
        let r_old = repo.get_member_role(server.id, old_owner_id).await.unwrap();
        assert!(matches!(r_new, ServerMemberRole::Owner));
        assert!(matches!(r_old, ServerMemberRole::Member));

        cleanup(&pool, server.id, &[old_owner_id, new_owner_id]).await;
    }

    #[actix_web::test]
    async fn test_remove_member_rownotfound_when_missing() {
        let pool = match pool_or_skip().await {
            Some(p) => p,
            None => return,
        };

        let repo = ServerRepository::new(pool.clone());

        let owner_id = Uuid::new_v4();
        insert_user(&pool, owner_id, "repo_owner7", "repo_owner7@example.com").await;

        let server = repo
            .create_with_owner(owner_id, "repo remove test")
            .await
            .unwrap();

        let missing_user_id = Uuid::new_v4();
        let err = repo
            .remove_member(server.id, missing_user_id)
            .await
            .unwrap_err();
        assert!(matches!(err, sqlx::Error::RowNotFound));

        cleanup(&pool, server.id, &[owner_id]).await;
    }

    #[actix_web::test]
    async fn test_delete_server_requires_owner() {
        let pool = match pool_or_skip().await {
            Some(p) => p,
            None => return,
        };

        let repo = ServerRepository::new(pool.clone());

        let owner_id = Uuid::new_v4();
        let other_id = Uuid::new_v4();
        insert_user(&pool, owner_id, "repo_owner8", "repo_owner8@example.com").await;
        insert_user(&pool, other_id, "repo_other8", "repo_other8@example.com").await;

        let server = repo
            .create_with_owner(owner_id, "repo delete test")
            .await
            .unwrap();

        let err = repo.delete_server(server.id, other_id).await.unwrap_err();
        assert!(matches!(err, sqlx::Error::RowNotFound));

        repo.delete_server(server.id, owner_id).await.unwrap();

        let exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM servers WHERE id = $1)")
            .bind(server.id)
            .fetch_one(&pool)
            .await
            .unwrap();
        assert!(!exists);

        cleanup(&pool, server.id, &[owner_id, other_id]).await;
    }

    #[actix_web::test]
    async fn test_list_members_maps_roles_and_sorts() {
        let pool = match pool_or_skip().await {
            Some(p) => p,
            None => return,
        };

        let repo = ServerRepository::new(pool.clone());

        let owner_id = Uuid::new_v4();
        let admin_id = Uuid::new_v4();
        let member_id = Uuid::new_v4();

        insert_user(&pool, owner_id, "aaa_owner", "aaa_owner@example.com").await;
        insert_user(&pool, admin_id, "bbb_admin", "bbb_admin@example.com").await;
        insert_user(&pool, member_id, "ccc_member", "ccc_member@example.com").await;

        let server = repo
            .create_with_owner(owner_id, "repo list members test")
            .await
            .unwrap();

        let _ = sqlx::query(
            r#"
            INSERT INTO server_members (server_id, user_id, role)
            VALUES ($1, $2, 'admin')
            ON CONFLICT (server_id, user_id) DO NOTHING
            "#,
        )
        .bind(server.id)
        .bind(admin_id)
        .execute(&pool)
        .await
        .unwrap();

        let _ = sqlx::query(
            r#"
            INSERT INTO server_members (server_id, user_id, role)
            VALUES ($1, $2, 'member')
            ON CONFLICT (server_id, user_id) DO NOTHING
            "#,
        )
        .bind(server.id)
        .bind(member_id)
        .execute(&pool)
        .await
        .unwrap();

        let members = repo.list_members(server.id).await.unwrap();
        assert_eq!(members.len(), 3);

        assert_eq!(members[0].username, "aaa_owner");
        assert_eq!(members[1].username, "bbb_admin");
        assert_eq!(members[2].username, "ccc_member");

        assert!(matches!(members[0].role, ServerMemberRole::Owner));
        assert!(matches!(members[1].role, ServerMemberRole::Admin));
        assert!(matches!(members[2].role, ServerMemberRole::Member));

        cleanup(&pool, server.id, &[owner_id, admin_id, member_id]).await;
    }

    #[actix_web::test]
    async fn test_update_trims_name_when_provided() {
        let pool = match pool_or_skip().await {
            Some(p) => p,
            None => return,
        };

        let repo = ServerRepository::new(pool.clone());

        let owner_id = Uuid::new_v4();
        insert_user(&pool, owner_id, "repo_owner9", "repo_owner9@example.com").await;

        let server = repo
            .create_with_owner(owner_id, "repo update test")
            .await
            .unwrap();

        let updated = repo
            .update(
                server.id,
                UpdateServer {
                    name: Some("  new name  ".to_string()),
                },
            )
            .await
            .unwrap();

        assert_eq!(updated.name, "new name");

        cleanup(&pool, server.id, &[owner_id]).await;
    }
}
