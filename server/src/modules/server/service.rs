use crate::models::server::{Server, UpdateServer};
use crate::models::server_ban::ServerBanResponse;
use crate::models::server_member::{ServerMemberResponse, ServerMemberRole};
use crate::modules::server::repository::ServerRepository;
use async_trait::async_trait;
use chrono::{DateTime, Duration, Utc};
use std::sync::Arc;
use uuid::Uuid;

#[derive(Clone)]
pub struct ServerService {
    repo: Arc<dyn ServerRepo>,
}

#[derive(Debug)]
pub enum JoinServerError {
    InvalidCode,
    NotFound,
    AlreadyMember,
    Forbidden { expires_at: Option<DateTime<Utc>> },
    Db,
}

#[derive(Debug)]
pub enum LeaveServerError {
    NotFound,
    AlreadyLeave,
    Db,
}

#[async_trait]
pub trait ServerRepo: Send + Sync {
    async fn create_with_owner(&self, owner_id: Uuid, name: &str) -> Result<Server, sqlx::Error>;
    async fn list_for_user(&self, user_id: Uuid) -> Result<Vec<Server>, sqlx::Error>;
    async fn get_username(&self, user_id: Uuid) -> Result<String, sqlx::Error>;
    async fn join_by_invitation_code(
        &self,
        user_id: Uuid,
        code: &str,
    ) -> Result<(Server, bool), sqlx::Error>;
    async fn find_by_id(&self, server_id: Uuid) -> Result<Server, sqlx::Error>;
    async fn list_bans(&self, server_id: Uuid) -> Result<Vec<ServerBanResponse>, sqlx::Error>;
    async fn leave_server(
        &self,
        server_id: Uuid,
        user_id: Uuid,
    ) -> Result<(Server, bool), sqlx::Error>;
    async fn update(&self, server_id: Uuid, payload: UpdateServer) -> Result<Server, sqlx::Error>;
    async fn is_member(&self, server_id: Uuid, user_id: Uuid) -> Result<bool, sqlx::Error>;
    async fn list_members(&self, server_id: Uuid)
        -> Result<Vec<ServerMemberResponse>, sqlx::Error>;
    async fn delete_server(&self, server_id: Uuid, owner_id: Uuid) -> Result<(), sqlx::Error>;
    async fn update_member_role(
        &self,
        server_id: Uuid,
        user_id: Uuid,
        role: ServerMemberRole,
    ) -> Result<(), sqlx::Error>;
    async fn transfer_owner(
        &self,
        server_id: Uuid,
        old_owner_id: Uuid,
        new_owner_id: Uuid,
    ) -> Result<Server, sqlx::Error>;
    async fn remove_member(&self, server_id: Uuid, user_id: Uuid) -> Result<(), sqlx::Error>;
    async fn ban_member(
        &self,
        server_id: Uuid,
        user_id: Uuid,
        banned_by: Uuid,
        reason: Option<String>,
        expires_at: Option<DateTime<Utc>>,
    ) -> Result<(), sqlx::Error>;
    async fn unban_member(&self, server_id: Uuid, user_id: Uuid) -> Result<(), sqlx::Error>;
}

#[async_trait]
impl ServerRepo for ServerRepository {
    async fn create_with_owner(&self, owner_id: Uuid, name: &str) -> Result<Server, sqlx::Error> {
        ServerRepository::create_with_owner(self, owner_id, name).await
    }

    async fn list_for_user(&self, user_id: Uuid) -> Result<Vec<Server>, sqlx::Error> {
        ServerRepository::list_for_user(self, user_id).await
    }

    async fn get_username(&self, user_id: Uuid) -> Result<String, sqlx::Error> {
        ServerRepository::get_username(self, user_id).await
    }

    async fn join_by_invitation_code(
        &self,
        user_id: Uuid,
        code: &str,
    ) -> Result<(Server, bool), sqlx::Error> {
        ServerRepository::join_by_invitation_code(self, user_id, code).await
    }

    async fn find_by_id(&self, server_id: Uuid) -> Result<Server, sqlx::Error> {
        ServerRepository::find_by_id(self, server_id).await
    }

    async fn list_bans(&self, server_id: Uuid) -> Result<Vec<ServerBanResponse>, sqlx::Error> {
        ServerRepository::list_bans(self, server_id).await
    }

    async fn leave_server(
        &self,
        server_id: Uuid,
        user_id: Uuid,
    ) -> Result<(Server, bool), sqlx::Error> {
        ServerRepository::leave_server(self, server_id, user_id).await
    }

    async fn update(&self, server_id: Uuid, payload: UpdateServer) -> Result<Server, sqlx::Error> {
        ServerRepository::update(self, server_id, payload).await
    }

    async fn is_member(&self, server_id: Uuid, user_id: Uuid) -> Result<bool, sqlx::Error> {
        ServerRepository::is_member(self, server_id, user_id).await
    }

    async fn list_members(
        &self,
        server_id: Uuid,
    ) -> Result<Vec<ServerMemberResponse>, sqlx::Error> {
        ServerRepository::list_members(self, server_id).await
    }

    async fn delete_server(&self, server_id: Uuid, owner_id: Uuid) -> Result<(), sqlx::Error> {
        ServerRepository::delete_server(self, server_id, owner_id).await
    }

    async fn update_member_role(
        &self,
        server_id: Uuid,
        user_id: Uuid,
        role: ServerMemberRole,
    ) -> Result<(), sqlx::Error> {
        ServerRepository::update_member_role(self, server_id, user_id, role).await
    }

    async fn transfer_owner(
        &self,
        server_id: Uuid,
        old_owner_id: Uuid,
        new_owner_id: Uuid,
    ) -> Result<Server, sqlx::Error> {
        ServerRepository::transfer_owner(self, server_id, old_owner_id, new_owner_id).await
    }

    async fn remove_member(&self, server_id: Uuid, user_id: Uuid) -> Result<(), sqlx::Error> {
        ServerRepository::remove_member(self, server_id, user_id).await
    }

    async fn ban_member(
        &self,
        server_id: Uuid,
        user_id: Uuid,
        banned_by: Uuid,
        reason: Option<String>,
        expires_at: Option<DateTime<Utc>>,
    ) -> Result<(), sqlx::Error> {
        ServerRepository::ban_member(self, server_id, user_id, banned_by, reason, expires_at).await
    }

    async fn unban_member(&self, server_id: Uuid, user_id: Uuid) -> Result<(), sqlx::Error> {
        ServerRepository::unban_member(self, server_id, user_id).await
    }
}

impl ServerService {
    pub fn new(repo: ServerRepository) -> Self {
        Self {
            repo: Arc::new(repo),
        }
    }

    pub fn new_with_repo(repo: Arc<dyn ServerRepo>) -> Self {
        Self { repo }
    }

    pub async fn create_server(&self, owner_id: Uuid, name: &str) -> Result<Server, String> {
        let name = name.trim();
        if name.len() < 3 || name.len() > 50 {
            return Err("Server name must be between 3 and 50 characters.".into());
        }

        self.repo
            .create_with_owner(owner_id, name)
            .await
            .map_err(|e| {
                log::error!("create_server error: {:?}", e);
                "Unable to create server.".to_string()
            })
    }

    pub async fn list_my_servers(&self, user_id: Uuid) -> Result<Vec<Server>, String> {
        self.repo.list_for_user(user_id).await.map_err(|e| {
            log::error!("list_my_servers error: {:?}", e);
            "Unable to list servers.".to_string()
        })
    }

    pub async fn get_username(&self, user_id: Uuid) -> Result<String, String> {
        self.repo.get_username(user_id).await.map_err(|e| {
            log::error!("get_username error: {:?}", e);
            "Unable to fetch username".to_string()
        })
    }

    pub async fn join_by_invitation_code(
        &self,
        user_id: Uuid,
        code: &str,
    ) -> Result<Server, JoinServerError> {
        let code = code.trim().to_uppercase();
        if code.len() != 8 {
            return Err(JoinServerError::InvalidCode);
        }

        match self.repo.join_by_invitation_code(user_id, &code).await {
            Ok((server, inserted)) => {
                if !inserted {
                    return Err(JoinServerError::AlreadyMember);
                }
                Ok(server)
            }
            Err(sqlx::Error::RowNotFound) => Err(JoinServerError::NotFound),
            Err(sqlx::Error::Protocol(msg)) if msg.contains("User is banned") => {
                let expires_at = msg
                    .strip_prefix("User is banned from this server until ")
                    .and_then(|value| DateTime::parse_from_rfc3339(value).ok())
                    .map(|date| date.with_timezone(&Utc));

                Err(JoinServerError::Forbidden { expires_at })
            }
            Err(e) => {
                log::error!("join_by_invitation_code error: {:?}", e);
                Err(JoinServerError::Db)
            }
        }
    }

    pub async fn list_bans(
        &self,
        requester_id: Uuid,
        server_id: Uuid,
    ) -> Result<Vec<ServerBanResponse>, String> {
        let server = self
            .repo
            .find_by_id(server_id)
            .await
            .map_err(|_| "Server not found".to_string())?;

        if server.owner_id != requester_id {
            return Err("Forbidden".into());
        }

        self.repo.list_bans(server_id).await.map_err(|e| {
            log::error!("list_bans error: {:?}", e);
            "Unable to list bans".to_string()
        })
    }

    pub async fn leave_server(
        &self,
        server_id: Uuid,
        user_id: Uuid,
    ) -> Result<(), LeaveServerError> {
        match self.repo.leave_server(server_id, user_id).await {
            Ok((_server, deleted)) => {
                if !deleted {
                    return Err(LeaveServerError::AlreadyLeave);
                }
                Ok(())
            }
            Err(sqlx::Error::RowNotFound) => Err(LeaveServerError::NotFound),
            Err(e) => {
                log::error!("leave_server error: {:?}", e);
                Err(LeaveServerError::Db)
            }
        }
    }

    pub async fn update_server(
        &self,
        user_id: Uuid,
        server_id: Uuid,
        payload: UpdateServer,
    ) -> Result<Server, String> {
        let server = self.repo.find_by_id(server_id).await.map_err(|e| {
            log::error!("find_by_id error: {:?}", e);
            "Server not found.".to_string()
        })?;

        if server.owner_id != user_id {
            return Err("Forbidden".into());
        }

        self.repo.update(server_id, payload).await.map_err(|e| {
            log::error!("update_server error: {:?}", e);
            "Unable to update server.".to_string()
        })
    }

    pub async fn is_member(&self, server_id: Uuid, user_id: Uuid) -> Result<bool, String> {
        self.repo.is_member(server_id, user_id).await.map_err(|e| {
            log::error!("is_member error: {:?}", e);
            "Unable to check membership.".to_string()
        })
    }

    pub async fn list_members(
        &self,
        requester_id: Uuid,
        server_id: Uuid,
    ) -> Result<Vec<ServerMemberResponse>, String> {
        let is_member = self
            .repo
            .is_member(server_id, requester_id)
            .await
            .map_err(|e| {
                log::error!("list_members/is_member error: {:?}", e);
                "Unable to check membership.".to_string()
            })?;

        if !is_member {
            return Err("Forbidden".to_string());
        }

        self.repo.list_members(server_id).await.map_err(|e| {
            log::error!("list_members error: {:?}", e);
            "Unable to list members.".to_string()
        })
    }

    pub async fn delete_server(&self, server_id: Uuid, owner_id: Uuid) -> Result<(), String> {
        self.repo
            .delete_server(server_id, owner_id)
            .await
            .map_err(|e| {
                log::error!("delete_server error: {:?}", e);
                "Unable to delete server.".to_string()
            })
    }

    pub async fn set_role(
        &self,
        requester_id: Uuid,
        server_id: Uuid,
        target_user_id: Uuid,
        role: ServerMemberRole,
    ) -> Result<(), String> {
        let server = self
            .repo
            .find_by_id(server_id)
            .await
            .map_err(|_| "Server not found".to_string())?;

        if server.owner_id != requester_id {
            return Err("Forbidden".into());
        }

        if target_user_id == server.owner_id {
            return Err("Cannot change owner role".into());
        }

        if matches!(role, ServerMemberRole::Owner) {
            return Err("Cannot assign owner role".into());
        }

        self.repo
            .update_member_role(server_id, target_user_id, role)
            .await
            .map_err(|e| {
                log::error!("set_role error: {:?}", e);
                "Unable to update role".to_string()
            })
    }

    pub async fn get_server_owner_id(&self, server_id: Uuid) -> Result<Uuid, String> {
        let server = self.repo.find_by_id(server_id).await.map_err(|e| {
            log::error!("get_server_owner_id/find_by_id error: {:?}", e);
            "Server not found.".to_string()
        })?;
        Ok(server.owner_id)
    }

    pub async fn transfer_owner(
        &self,
        requester_id: Uuid,
        server_id: Uuid,
        new_owner_id: Uuid,
    ) -> Result<Server, String> {
        let server = self
            .repo
            .find_by_id(server_id)
            .await
            .map_err(|_| "Server not found".to_string())?;

        if server.owner_id != requester_id {
            return Err("Forbidden".into());
        }

        if new_owner_id == server.owner_id {
            return Err("Already owner".into());
        }
        let is_member = self
            .repo
            .is_member(server_id, new_owner_id)
            .await
            .map_err(|e| {
                log::error!("transfer_owner/is_member error: {:?}", e);
                "Unable to check membership".to_string()
            })?;
        if !is_member {
            return Err("Target is not a member".into());
        }
        self.repo
            .transfer_owner(server_id, requester_id, new_owner_id)
            .await
            .map_err(|e| {
                log::error!("transfer_owner error: {:?}", e);
                "Unable to transfer owner".to_string()
            })
    }

    pub async fn kick_member(
        &self,
        requester_id: Uuid,
        server_id: Uuid,
        target_user_id: Uuid,
    ) -> Result<(), String> {
        let server = self
            .repo
            .find_by_id(server_id)
            .await
            .map_err(|_| "Server not found".to_string())?;

        if server.owner_id != requester_id {
            return Err("Forbidden".into());
        }

        if target_user_id == server.owner_id {
            return Err("Cannot kick owner".into());
        }

        self.repo
            .remove_member(server_id, target_user_id)
            .await
            .map_err(|e| {
                log::error!("kick_member error: {:?}", e);
                "Unable to remove member".to_string()
            })
    }

    pub async fn ban_member(
        &self,
        requester_id: Uuid,
        server_id: Uuid,
        target_user_id: Uuid,
    ) -> Result<(), String> {
        let server = self
            .repo
            .find_by_id(server_id)
            .await
            .map_err(|_| "Server not found".to_string())?;

        if server.owner_id != requester_id {
            return Err("Forbidden".into());
        }

        if target_user_id == server.owner_id {
            return Err("Cannot ban owner".into());
        }

        self.repo
            .ban_member(server_id, target_user_id, requester_id, None, None)
            .await
            .map_err(|e| {
                log::error!("ban_member error: {:?}", e);
                "Unable to ban member".to_string()
            })
    }

    pub async fn ban_temporary_member(
        &self,
        requester_id: Uuid,
        server_id: Uuid,
        target_user_id: Uuid,
        duration_minutes: u32,
    ) -> Result<DateTime<Utc>, String> {
        let server = self
            .repo
            .find_by_id(server_id)
            .await
            .map_err(|_| "Server not found".to_string())?;

        if server.owner_id != requester_id {
            return Err("Forbidden".into());
        }

        if target_user_id == server.owner_id {
            return Err("Cannot ban owner".into());
        }

        if duration_minutes == 0 {
            return Err("Duration must be greater than 0".into());
        }

        let expires_at = Utc::now() + Duration::minutes(duration_minutes as i64);
        self.repo
            .ban_member(
                server_id,
                target_user_id,
                requester_id,
                None,
                Some(expires_at),
            )
            .await
            .map_err(|e| {
                log::error!("ban_temporary_member error: {:?}", e);
                "Unable to ban member temporarily".to_string()
            })?;

        Ok(expires_at)
    }

    pub async fn unban_member(
        &self,
        requester_id: Uuid,
        server_id: Uuid,
        target_user_id: Uuid,
    ) -> Result<(), String> {
        let server = self
            .repo
            .find_by_id(server_id)
            .await
            .map_err(|_| "Server not found".to_string())?;

        if server.owner_id != requester_id {
            return Err("Forbidden".into());
        }

        self.repo
            .unban_member(server_id, target_user_id)
            .await
            .map_err(|e| {
                log::error!("unban_member error: {:?}", e);
                "Unable to unban member".to_string()
            })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use std::sync::Mutex;

    struct FakeServerRepo {
        server: Server,
        fail_create: Mutex<bool>,
        fail_list: Mutex<bool>,
        fail_find: Mutex<bool>,
        fail_update: Mutex<bool>,
        fail_is_member: Mutex<bool>,
        is_member: Mutex<bool>,
        join_row_not_found: Mutex<bool>,
        join_banned: Mutex<Option<String>>,
        join_inserted: Mutex<bool>,
        leave_row_not_found: Mutex<bool>,
        leave_deleted: Mutex<bool>,
        fail_list_bans: Mutex<bool>,
        fail_members: Mutex<bool>,
        fail_delete: Mutex<bool>,
        fail_role: Mutex<bool>,
        fail_transfer: Mutex<bool>,
        fail_remove: Mutex<bool>,
        fail_ban: Mutex<bool>,
        fail_unban: Mutex<bool>,
        last_created_name: Mutex<Option<String>>,
        last_join_code: Mutex<Option<String>>,
        last_ban_expires_at: Mutex<Option<DateTime<Utc>>>,
    }

    impl FakeServerRepo {
        fn new(owner_id: Uuid) -> Self {
            let now = Utc::now();
            let server = Server {
                id: Uuid::new_v4(),
                name: "general".to_string(),
                owner_id,
                invitation_code: "ABCD1234".to_string(),
                created_at: now,
                updated_at: now,
            };
            Self {
                server,
                fail_create: Mutex::new(false),
                fail_list: Mutex::new(false),
                fail_find: Mutex::new(false),
                fail_update: Mutex::new(false),
                fail_is_member: Mutex::new(false),
                is_member: Mutex::new(true),
                join_row_not_found: Mutex::new(false),
                join_banned: Mutex::new(None),
                join_inserted: Mutex::new(true),
                leave_row_not_found: Mutex::new(false),
                leave_deleted: Mutex::new(true),
                fail_list_bans: Mutex::new(false),
                fail_members: Mutex::new(false),
                fail_delete: Mutex::new(false),
                fail_role: Mutex::new(false),
                fail_transfer: Mutex::new(false),
                fail_remove: Mutex::new(false),
                fail_ban: Mutex::new(false),
                fail_unban: Mutex::new(false),
                last_created_name: Mutex::new(None),
                last_join_code: Mutex::new(None),
                last_ban_expires_at: Mutex::new(None),
            }
        }

        fn service(self: &Arc<Self>) -> ServerService {
            ServerService::new_with_repo(self.clone())
        }

        fn db_error() -> sqlx::Error {
            sqlx::Error::Protocol("forced error".into())
        }
    }

    #[async_trait]
    impl ServerRepo for FakeServerRepo {
        async fn create_with_owner(
            &self,
            _owner_id: Uuid,
            name: &str,
        ) -> Result<Server, sqlx::Error> {
            *self.last_created_name.lock().unwrap() = Some(name.to_string());
            if *self.fail_create.lock().unwrap() {
                Err(Self::db_error())
            } else {
                Ok(self.server.clone())
            }
        }

        async fn list_for_user(&self, _user_id: Uuid) -> Result<Vec<Server>, sqlx::Error> {
            if *self.fail_list.lock().unwrap() {
                Err(Self::db_error())
            } else {
                Ok(vec![self.server.clone()])
            }
        }

        async fn get_username(&self, _user_id: Uuid) -> Result<String, sqlx::Error> {
            if *self.fail_list.lock().unwrap() {
                Err(Self::db_error())
            } else {
                Ok("alice".to_string())
            }
        }

        async fn join_by_invitation_code(
            &self,
            _user_id: Uuid,
            code: &str,
        ) -> Result<(Server, bool), sqlx::Error> {
            *self.last_join_code.lock().unwrap() = Some(code.to_string());
            if *self.join_row_not_found.lock().unwrap() {
                return Err(sqlx::Error::RowNotFound);
            }
            if let Some(message) = self.join_banned.lock().unwrap().clone() {
                return Err(sqlx::Error::Protocol(message.into()));
            }
            Ok((self.server.clone(), *self.join_inserted.lock().unwrap()))
        }

        async fn find_by_id(&self, _server_id: Uuid) -> Result<Server, sqlx::Error> {
            if *self.fail_find.lock().unwrap() {
                Err(sqlx::Error::RowNotFound)
            } else {
                Ok(self.server.clone())
            }
        }

        async fn list_bans(&self, _server_id: Uuid) -> Result<Vec<ServerBanResponse>, sqlx::Error> {
            if *self.fail_list_bans.lock().unwrap() {
                Err(Self::db_error())
            } else {
                Ok(vec![ServerBanResponse {
                    user_id: Uuid::new_v4(),
                    username: "bob".to_string(),
                    reason: Some("spam".to_string()),
                    created_at: Utc::now(),
                    expires_at: None,
                }])
            }
        }

        async fn leave_server(
            &self,
            _server_id: Uuid,
            _user_id: Uuid,
        ) -> Result<(Server, bool), sqlx::Error> {
            if *self.leave_row_not_found.lock().unwrap() {
                Err(sqlx::Error::RowNotFound)
            } else {
                Ok((self.server.clone(), *self.leave_deleted.lock().unwrap()))
            }
        }

        async fn update(
            &self,
            _server_id: Uuid,
            _payload: UpdateServer,
        ) -> Result<Server, sqlx::Error> {
            if *self.fail_update.lock().unwrap() {
                Err(Self::db_error())
            } else {
                Ok(self.server.clone())
            }
        }

        async fn is_member(&self, _server_id: Uuid, _user_id: Uuid) -> Result<bool, sqlx::Error> {
            if *self.fail_is_member.lock().unwrap() {
                Err(Self::db_error())
            } else {
                Ok(*self.is_member.lock().unwrap())
            }
        }

        async fn list_members(
            &self,
            _server_id: Uuid,
        ) -> Result<Vec<ServerMemberResponse>, sqlx::Error> {
            if *self.fail_members.lock().unwrap() {
                Err(Self::db_error())
            } else {
                Ok(vec![ServerMemberResponse {
                    user_id: self.server.owner_id,
                    username: "alice".to_string(),
                    role: ServerMemberRole::Owner,
                }])
            }
        }

        async fn delete_server(
            &self,
            _server_id: Uuid,
            _owner_id: Uuid,
        ) -> Result<(), sqlx::Error> {
            if *self.fail_delete.lock().unwrap() {
                Err(Self::db_error())
            } else {
                Ok(())
            }
        }

        async fn update_member_role(
            &self,
            _server_id: Uuid,
            _user_id: Uuid,
            _role: ServerMemberRole,
        ) -> Result<(), sqlx::Error> {
            if *self.fail_role.lock().unwrap() {
                Err(Self::db_error())
            } else {
                Ok(())
            }
        }

        async fn transfer_owner(
            &self,
            _server_id: Uuid,
            _old_owner_id: Uuid,
            new_owner_id: Uuid,
        ) -> Result<Server, sqlx::Error> {
            if *self.fail_transfer.lock().unwrap() {
                Err(Self::db_error())
            } else {
                Ok(Server {
                    owner_id: new_owner_id,
                    ..self.server.clone()
                })
            }
        }

        async fn remove_member(&self, _server_id: Uuid, _user_id: Uuid) -> Result<(), sqlx::Error> {
            if *self.fail_remove.lock().unwrap() {
                Err(Self::db_error())
            } else {
                Ok(())
            }
        }

        async fn ban_member(
            &self,
            _server_id: Uuid,
            _user_id: Uuid,
            _banned_by: Uuid,
            _reason: Option<String>,
            expires_at: Option<DateTime<Utc>>,
        ) -> Result<(), sqlx::Error> {
            *self.last_ban_expires_at.lock().unwrap() = expires_at;
            if *self.fail_ban.lock().unwrap() {
                Err(Self::db_error())
            } else {
                Ok(())
            }
        }

        async fn unban_member(&self, _server_id: Uuid, _user_id: Uuid) -> Result<(), sqlx::Error> {
            if *self.fail_unban.lock().unwrap() {
                Err(Self::db_error())
            } else {
                Ok(())
            }
        }
    }

    #[actix_web::test]
    async fn create_server_trims_validates_and_maps_repo_errors() {
        let owner_id = Uuid::new_v4();
        let repo = Arc::new(FakeServerRepo::new(owner_id));
        let service = repo.service();

        assert!(matches!(
            service
                .create_server(owner_id, "ab")
                .await
                .unwrap_err()
                .as_str(),
            "Server name must be between 3 and 50 characters."
        ));
        assert!(service
            .create_server(owner_id, &"a".repeat(51))
            .await
            .is_err());

        let server = service
            .create_server(owner_id, "  better name  ")
            .await
            .unwrap();
        assert_eq!(server.owner_id, owner_id);
        assert_eq!(
            repo.last_created_name.lock().unwrap().as_deref(),
            Some("better name")
        );

        *repo.fail_create.lock().unwrap() = true;
        assert_eq!(
            service.create_server(owner_id, "valid").await.unwrap_err(),
            "Unable to create server."
        );
    }

    #[actix_web::test]
    async fn simple_read_methods_map_success_and_database_errors() {
        let repo = Arc::new(FakeServerRepo::new(Uuid::new_v4()));
        let service = repo.service();
        let user_id = Uuid::new_v4();

        assert_eq!(service.list_my_servers(user_id).await.unwrap().len(), 1);
        assert_eq!(service.get_username(user_id).await.unwrap(), "alice");

        *repo.fail_list.lock().unwrap() = true;
        assert_eq!(
            service.list_my_servers(user_id).await.unwrap_err(),
            "Unable to list servers."
        );
        assert_eq!(
            service.get_username(user_id).await.unwrap_err(),
            "Unable to fetch username"
        );
    }

    #[actix_web::test]
    async fn join_by_invitation_code_covers_validation_and_repo_outcomes() {
        let repo = Arc::new(FakeServerRepo::new(Uuid::new_v4()));
        let service = repo.service();
        let user_id = Uuid::new_v4();

        assert!(matches!(
            service.join_by_invitation_code(user_id, "short").await,
            Err(JoinServerError::InvalidCode)
        ));

        service
            .join_by_invitation_code(user_id, " abcd1234 ")
            .await
            .unwrap();
        assert_eq!(
            repo.last_join_code.lock().unwrap().as_deref(),
            Some("ABCD1234")
        );

        *repo.join_inserted.lock().unwrap() = false;
        assert!(matches!(
            service.join_by_invitation_code(user_id, "ABCD1234").await,
            Err(JoinServerError::AlreadyMember)
        ));

        *repo.join_inserted.lock().unwrap() = true;
        *repo.join_row_not_found.lock().unwrap() = true;
        assert!(matches!(
            service.join_by_invitation_code(user_id, "ABCD1234").await,
            Err(JoinServerError::NotFound)
        ));

        *repo.join_row_not_found.lock().unwrap() = false;
        *repo.join_banned.lock().unwrap() =
            Some("User is banned from this server until 2026-04-26T10:00:00Z".to_string());
        assert!(matches!(
            service.join_by_invitation_code(user_id, "ABCD1234").await,
            Err(JoinServerError::Forbidden {
                expires_at: Some(_)
            })
        ));

        *repo.join_banned.lock().unwrap() = Some("other protocol failure".to_string());
        assert!(matches!(
            service.join_by_invitation_code(user_id, "ABCD1234").await,
            Err(JoinServerError::Db)
        ));
    }

    #[actix_web::test]
    async fn owner_gated_methods_reject_non_owners_and_call_repo_for_owner() {
        let owner_id = Uuid::new_v4();
        let repo = Arc::new(FakeServerRepo::new(owner_id));
        let service = repo.service();
        let server_id = repo.server.id;
        let other_id = Uuid::new_v4();

        assert_eq!(
            service.list_bans(other_id, server_id).await.unwrap_err(),
            "Forbidden"
        );
        assert_eq!(
            service
                .update_server(
                    other_id,
                    server_id,
                    UpdateServer {
                        name: Some("name".to_string())
                    }
                )
                .await
                .unwrap_err(),
            "Forbidden"
        );
        assert_eq!(
            service
                .set_role(owner_id, server_id, owner_id, ServerMemberRole::Admin)
                .await
                .unwrap_err(),
            "Cannot change owner role"
        );
        assert_eq!(
            service
                .set_role(owner_id, server_id, other_id, ServerMemberRole::Owner)
                .await
                .unwrap_err(),
            "Cannot assign owner role"
        );

        assert_eq!(
            service.list_bans(owner_id, server_id).await.unwrap().len(),
            1
        );
        assert!(service
            .update_server(
                owner_id,
                server_id,
                UpdateServer {
                    name: Some("renamed".to_string())
                }
            )
            .await
            .is_ok());
        assert!(service
            .set_role(owner_id, server_id, other_id, ServerMemberRole::Admin)
            .await
            .is_ok());
    }

    #[actix_web::test]
    async fn membership_methods_cover_forbidden_and_error_paths() {
        let repo = Arc::new(FakeServerRepo::new(Uuid::new_v4()));
        let service = repo.service();
        let user_id = Uuid::new_v4();
        let server_id = repo.server.id;

        assert!(service.is_member(server_id, user_id).await.unwrap());
        assert_eq!(
            service
                .list_members(user_id, server_id)
                .await
                .unwrap()
                .len(),
            1
        );

        *repo.is_member.lock().unwrap() = false;
        assert_eq!(
            service.list_members(user_id, server_id).await.unwrap_err(),
            "Forbidden"
        );

        *repo.fail_is_member.lock().unwrap() = true;
        assert_eq!(
            service.is_member(server_id, user_id).await.unwrap_err(),
            "Unable to check membership."
        );
        assert_eq!(
            service.list_members(user_id, server_id).await.unwrap_err(),
            "Unable to check membership."
        );
    }

    #[actix_web::test]
    async fn leave_and_delete_methods_map_outcomes() {
        let owner_id = Uuid::new_v4();
        let repo = Arc::new(FakeServerRepo::new(owner_id));
        let service = repo.service();
        let user_id = Uuid::new_v4();
        let server_id = repo.server.id;

        assert!(service.leave_server(server_id, user_id).await.is_ok());
        *repo.leave_deleted.lock().unwrap() = false;
        assert!(matches!(
            service.leave_server(server_id, user_id).await,
            Err(LeaveServerError::AlreadyLeave)
        ));
        *repo.leave_row_not_found.lock().unwrap() = true;
        assert!(matches!(
            service.leave_server(server_id, user_id).await,
            Err(LeaveServerError::NotFound)
        ));

        assert!(service.delete_server(server_id, owner_id).await.is_ok());
        *repo.fail_delete.lock().unwrap() = true;
        assert_eq!(
            service
                .delete_server(server_id, owner_id)
                .await
                .unwrap_err(),
            "Unable to delete server."
        );
    }

    #[actix_web::test]
    async fn transfer_owner_validates_requester_target_and_membership() {
        let owner_id = Uuid::new_v4();
        let repo = Arc::new(FakeServerRepo::new(owner_id));
        let service = repo.service();
        let server_id = repo.server.id;
        let new_owner_id = Uuid::new_v4();

        assert_eq!(
            service
                .transfer_owner(Uuid::new_v4(), server_id, new_owner_id)
                .await
                .unwrap_err(),
            "Forbidden"
        );
        assert_eq!(
            service
                .transfer_owner(owner_id, server_id, owner_id)
                .await
                .unwrap_err(),
            "Already owner"
        );
        *repo.is_member.lock().unwrap() = false;
        assert_eq!(
            service
                .transfer_owner(owner_id, server_id, new_owner_id)
                .await
                .unwrap_err(),
            "Target is not a member"
        );

        *repo.is_member.lock().unwrap() = true;
        let updated = service
            .transfer_owner(owner_id, server_id, new_owner_id)
            .await
            .unwrap();
        assert_eq!(updated.owner_id, new_owner_id);
    }

    #[actix_web::test]
    async fn kick_ban_temp_ban_and_unban_cover_guards_and_success() {
        let owner_id = Uuid::new_v4();
        let repo = Arc::new(FakeServerRepo::new(owner_id));
        let service = repo.service();
        let server_id = repo.server.id;
        let target_id = Uuid::new_v4();

        assert_eq!(
            service
                .kick_member(Uuid::new_v4(), server_id, target_id)
                .await
                .unwrap_err(),
            "Forbidden"
        );
        assert_eq!(
            service
                .kick_member(owner_id, server_id, owner_id)
                .await
                .unwrap_err(),
            "Cannot kick owner"
        );
        assert!(service
            .kick_member(owner_id, server_id, target_id)
            .await
            .is_ok());

        assert_eq!(
            service
                .ban_member(owner_id, server_id, owner_id)
                .await
                .unwrap_err(),
            "Cannot ban owner"
        );
        assert!(service
            .ban_member(owner_id, server_id, target_id)
            .await
            .is_ok());

        assert_eq!(
            service
                .ban_temporary_member(owner_id, server_id, target_id, 0)
                .await
                .unwrap_err(),
            "Duration must be greater than 0"
        );
        let expires_at = service
            .ban_temporary_member(owner_id, server_id, target_id, 10)
            .await
            .unwrap();
        assert_eq!(*repo.last_ban_expires_at.lock().unwrap(), Some(expires_at));

        assert_eq!(
            service
                .unban_member(Uuid::new_v4(), server_id, target_id)
                .await
                .unwrap_err(),
            "Forbidden"
        );
        assert!(service
            .unban_member(owner_id, server_id, target_id)
            .await
            .is_ok());
    }

    #[actix_web::test]
    async fn missing_server_is_reported_consistently() {
        let owner_id = Uuid::new_v4();
        let repo = Arc::new(FakeServerRepo::new(owner_id));
        let service = repo.service();
        let server_id = repo.server.id;
        let target_id = Uuid::new_v4();
        *repo.fail_find.lock().unwrap() = true;

        assert_eq!(
            service
                .update_server(owner_id, server_id, UpdateServer { name: None })
                .await
                .unwrap_err(),
            "Server not found."
        );
        assert_eq!(
            service
                .set_role(owner_id, server_id, target_id, ServerMemberRole::Admin)
                .await
                .unwrap_err(),
            "Server not found"
        );
        assert_eq!(
            service
                .kick_member(owner_id, server_id, target_id)
                .await
                .unwrap_err(),
            "Server not found"
        );
        assert_eq!(
            service
                .ban_member(owner_id, server_id, target_id)
                .await
                .unwrap_err(),
            "Server not found"
        );
        assert_eq!(
            service
                .unban_member(owner_id, server_id, target_id)
                .await
                .unwrap_err(),
            "Server not found"
        );
    }
}
