use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, sqlx::Type, Clone, PartialEq, Eq)]
#[sqlx(type_name = "member_role", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum ServerMemberRole {
    Owner,
    Admin,
    Member,
}

impl ServerMemberRole {
    pub fn as_str(&self) -> &'static str {
        match self {
            ServerMemberRole::Owner => "owner",
            ServerMemberRole::Admin => "admin",
            ServerMemberRole::Member => "member",
        }
    }

    pub fn is_owner(&self) -> bool {
        matches!(self, ServerMemberRole::Owner)
    }

    pub fn is_admin_or_owner(&self) -> bool {
        matches!(self, ServerMemberRole::Admin | ServerMemberRole::Owner)
    }

    pub fn can_create_channels(&self) -> bool {
        self.is_admin_or_owner()
    }

    pub fn can_delete_channels(&self) -> bool {
        self.is_admin_or_owner()
    }

    pub fn can_delete_others_messages(&self) -> bool {
        self.is_admin_or_owner()
    }

    pub fn can_manage_roles(&self) -> bool {
        self.is_owner()
    }

    pub fn can_create_invitations(&self) -> bool {
        self.is_admin_or_owner()
    }
}

impl TryFrom<String> for ServerMemberRole {
    type Error = String;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        Self::try_from(value.as_str())
    }
}

impl<'a> TryFrom<&'a str> for ServerMemberRole {
    type Error = String;

    fn try_from(value: &'a str) -> Result<Self, Self::Error> {
        match value {
            "owner" => Ok(ServerMemberRole::Owner),
            "admin" => Ok(ServerMemberRole::Admin),
            "member" => Ok(ServerMemberRole::Member),
            other => Err(format!("Invalid role: {}", other)),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ServerMember {
    pub id: Uuid,
    pub server_id: Uuid,
    pub user_id: Uuid,
    pub role: ServerMemberRole,
    pub joined_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateServerMember {
    pub server_id: Uuid,
    pub user_id: Uuid,
    pub role: ServerMemberRole,
}

#[derive(Debug, Deserialize)]
pub struct UpdateServerMemberRole {
    pub role: ServerMemberRole,
}

#[derive(Debug, Serialize, FromRow)]
pub struct ServerMemberResponse {
    pub user_id: Uuid,
    pub username: String,
    pub role: ServerMemberRole,
}

#[derive(Debug, Serialize)]
pub struct ServerMemberDetailedResponse {
    pub id: Uuid,
    pub server_id: Uuid,
    pub server_name: String,
    pub user_id: Uuid,
    pub username: String,
    pub email: String,
    pub role: ServerMemberRole,
    pub joined_at: DateTime<Utc>,
}

impl ServerMember {
    pub fn new(server_id: Uuid, user_id: Uuid) -> Self {
        Self {
            id: Uuid::new_v4(),
            server_id,
            user_id,
            role: ServerMemberRole::Member,
            joined_at: Utc::now(),
        }
    }

    pub fn with_role(server_id: Uuid, user_id: Uuid, role: ServerMemberRole) -> Self {
        Self {
            id: Uuid::new_v4(),
            server_id,
            user_id,
            role,
            joined_at: Utc::now(),
        }
    }

    pub fn is_owner(&self) -> bool {
        self.role.is_owner()
    }

    pub fn is_admin_or_owner(&self) -> bool {
        self.role.is_admin_or_owner()
    }

    pub fn can_perform_action(&self, action: MemberAction) -> bool {
        match action {
            MemberAction::CreateChannel => self.role.can_create_channels(),
            MemberAction::DeleteChannel => self.role.can_delete_channels(),
            MemberAction::DeleteOthersMessages => self.role.can_delete_others_messages(),
            MemberAction::ManageRoles => self.role.can_manage_roles(),
            MemberAction::CreateInvitation => self.role.can_create_invitations(),
            MemberAction::SendMessage => true,
            MemberAction::DeleteOwnMessage => true,
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub enum MemberAction {
    CreateChannel,
    DeleteChannel,
    DeleteOthersMessages,
    ManageRoles,
    CreateInvitation,
    SendMessage,
    DeleteOwnMessage,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_role_as_str() {
        assert_eq!(ServerMemberRole::Owner.as_str(), "owner");
        assert_eq!(ServerMemberRole::Admin.as_str(), "admin");
        assert_eq!(ServerMemberRole::Member.as_str(), "member");
    }

    #[test]
    fn test_role_predicates() {
        assert!(ServerMemberRole::Owner.is_owner());
        assert!(!ServerMemberRole::Admin.is_owner());
        assert!(!ServerMemberRole::Member.is_owner());

        assert!(ServerMemberRole::Owner.is_admin_or_owner());
        assert!(ServerMemberRole::Admin.is_admin_or_owner());
        assert!(!ServerMemberRole::Member.is_admin_or_owner());
    }

    #[test]
    fn test_role_permissions_matrix() {
        let owner = ServerMemberRole::Owner;
        let admin = ServerMemberRole::Admin;
        let member = ServerMemberRole::Member;

        assert!(owner.can_create_channels());
        assert!(admin.can_create_channels());
        assert!(!member.can_create_channels());

        assert!(owner.can_delete_channels());
        assert!(admin.can_delete_channels());
        assert!(!member.can_delete_channels());

        assert!(owner.can_delete_others_messages());
        assert!(admin.can_delete_others_messages());
        assert!(!member.can_delete_others_messages());

        assert!(owner.can_manage_roles());
        assert!(!admin.can_manage_roles());
        assert!(!member.can_manage_roles());

        assert!(owner.can_create_invitations());
        assert!(admin.can_create_invitations());
        assert!(!member.can_create_invitations());
    }

    #[test]
    fn test_try_from_str_role() {
        assert_eq!(
            ServerMemberRole::try_from("owner").unwrap(),
            ServerMemberRole::Owner
        );
        assert_eq!(
            ServerMemberRole::try_from("admin").unwrap(),
            ServerMemberRole::Admin
        );
        assert_eq!(
            ServerMemberRole::try_from("member").unwrap(),
            ServerMemberRole::Member
        );

        let err = ServerMemberRole::try_from("invalid").unwrap_err();
        assert!(err.contains("Invalid role"));
    }

    #[test]
    fn test_try_from_string_role() {
        assert_eq!(
            ServerMemberRole::try_from("owner".to_string()).unwrap(),
            ServerMemberRole::Owner
        );
        let err = ServerMemberRole::try_from("nope".to_string()).unwrap_err();
        assert!(err.contains("Invalid role"));
    }

    #[test]
    fn test_server_member_new_defaults_to_member_role() {
        let server_id = Uuid::new_v4();
        let user_id = Uuid::new_v4();

        let m = ServerMember::new(server_id, user_id);

        assert_eq!(m.server_id, server_id);
        assert_eq!(m.user_id, user_id);
        assert_eq!(m.role, ServerMemberRole::Member);
        assert!(!m.is_owner());
        assert!(!m.is_admin_or_owner());
    }

    #[test]
    fn test_server_member_with_role_sets_role() {
        let server_id = Uuid::new_v4();
        let user_id = Uuid::new_v4();

        let owner = ServerMember::with_role(server_id, user_id, ServerMemberRole::Owner);
        assert!(owner.is_owner());
        assert!(owner.is_admin_or_owner());

        let admin = ServerMember::with_role(server_id, user_id, ServerMemberRole::Admin);
        assert!(!admin.is_owner());
        assert!(admin.is_admin_or_owner());

        let member = ServerMember::with_role(server_id, user_id, ServerMemberRole::Member);
        assert!(!member.is_owner());
        assert!(!member.is_admin_or_owner());
    }

    #[test]
    fn test_can_perform_action_matrix() {
        let server_id = Uuid::new_v4();
        let user_id = Uuid::new_v4();

        let owner = ServerMember::with_role(server_id, user_id, ServerMemberRole::Owner);
        let admin = ServerMember::with_role(server_id, user_id, ServerMemberRole::Admin);
        let member = ServerMember::with_role(server_id, user_id, ServerMemberRole::Member);

        for action in [MemberAction::SendMessage, MemberAction::DeleteOwnMessage] {
            assert!(owner.can_perform_action(action));
            assert!(admin.can_perform_action(action));
            assert!(member.can_perform_action(action));
        }

        for action in [
            MemberAction::CreateChannel,
            MemberAction::DeleteChannel,
            MemberAction::DeleteOthersMessages,
            MemberAction::CreateInvitation,
        ] {
            assert!(owner.can_perform_action(action));
            assert!(admin.can_perform_action(action));
            assert!(!member.can_perform_action(action));
        }

        assert!(owner.can_perform_action(MemberAction::ManageRoles));
        assert!(!admin.can_perform_action(MemberAction::ManageRoles));
        assert!(!member.can_perform_action(MemberAction::ManageRoles));
    }
}
