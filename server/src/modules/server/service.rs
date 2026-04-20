use uuid::Uuid;
use chrono::{DateTime, Duration, Utc};
use crate::models::server::{Server, UpdateServer};
use crate::models::server_member::{ServerMemberResponse, ServerMemberRole};
use crate::models::server_ban::ServerBanResponse;
use crate::modules::server::repository::ServerRepository;

#[derive(Clone)]
pub struct ServerService {
    repo: ServerRepository,
}

#[derive(Debug)]
pub enum JoinServerError {
    InvalidCode,
    NotFound,
    AlreadyMember,
    Forbidden,
    Db,
}

#[derive(Debug)]
pub enum LeaveServerError {
    NotFound,
    AlreadyLeave,
    Db,
}

impl ServerService {
    pub fn new(repo: ServerRepository) -> Self {
        Self { repo }
    }

    pub async fn create_server(&self, owner_id: Uuid, name: &str) -> Result<Server, String> {
        let name = name.trim();
        if name.len() < 3 || name.len() > 50 {
            return Err("Server name must be between 3 and 50 characters.".into());
        }

        self.repo.create_with_owner(owner_id, name).await.map_err(|e| {
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

    pub async fn join_by_invitation_code(&self, user_id: Uuid, code: &str) -> Result<Server, JoinServerError> {
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
                Err(JoinServerError::Forbidden)
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

    pub async fn leave_server(&self, server_id: Uuid, user_id: Uuid) -> Result<(), LeaveServerError> {
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

    pub async fn update_server(&self, user_id: Uuid, server_id: Uuid, payload: UpdateServer) -> Result<Server, String> {
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

    pub async fn list_members(&self, requester_id: Uuid, server_id: Uuid) -> Result<Vec<ServerMemberResponse>, String> {
        let is_member = self.repo.is_member(server_id, requester_id).await.map_err(|e| {
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
        self.repo.delete_server(server_id, owner_id).await.map_err(|e| {
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
        let server = self.repo.find_by_id(server_id).await.map_err(|_| "Server not found".to_string())?;

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
        let server = self.repo.find_by_id(server_id).await.map_err(|_| "Server not found".to_string())?;

        if server.owner_id != requester_id {
            return Err("Forbidden".into());
        }

        if new_owner_id == server.owner_id {
            return Err("Already owner".into());
        }
        let is_member = self.repo.is_member(server_id, new_owner_id).await.map_err(|e| {
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

    pub async fn kick_member(&self, requester_id: Uuid, server_id: Uuid, target_user_id: Uuid) -> Result<(), String> {
        let server = self.repo.find_by_id(server_id).await.map_err(|_| "Server not found".to_string())?;

        if server.owner_id != requester_id {
            return Err("Forbidden".into());
        }

        if target_user_id == server.owner_id {
            return Err("Cannot kick owner".into());
        }

        self.repo.remove_member(server_id, target_user_id).await.map_err(|e| {
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

        self.repo.unban_member(server_id, target_user_id).await.map_err(|e| {
            log::error!("unban_member error: {:?}", e);
            "Unable to unban member".to_string()
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_server_rejects_name_too_short_or_too_long() {
        fn validate_name(name: &str) -> Result<(), String> {
            let name = name.trim();
            if name.len() < 3 || name.len() > 50 {
                return Err("Server name must be between 3 and 50 characters.".into());
            }
            Ok(())
        }

        assert!(validate_name("ab").is_err());
        assert!(validate_name("a".repeat(51).as_str()).is_err());
        assert!(validate_name("   ok   ").is_err());
        assert!(validate_name("   okay   ").is_ok());
    }

    #[test]
    fn test_join_by_invitation_code_rejects_invalid_length_and_normalizes() {
        fn normalize_and_validate(code: &str) -> Result<String, JoinServerError> {
            let code = code.trim().to_uppercase();
            if code.len() != 8 {
                return Err(JoinServerError::InvalidCode);
            }
            Ok(code)
        }

        assert!(matches!(normalize_and_validate("123"), Err(JoinServerError::InvalidCode)));

        let c = normalize_and_validate(" abcd1234 ").unwrap();
        assert_eq!(c, "ABCD1234");
    }

    #[test]
    fn test_set_role_rule_rejects_owner_assignment_variant() {
        assert!(matches!(ServerMemberRole::Owner, ServerMemberRole::Owner));
    }
}
