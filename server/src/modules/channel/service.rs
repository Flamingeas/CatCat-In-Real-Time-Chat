use std::sync::{Arc, Mutex};

use async_trait::async_trait;
use uuid::Uuid;

use crate::models::channel::{Channel, UpdateChannel};
use crate::modules::channel::repository::{ChannelRepository, ChannelRepositoryTrait};

#[async_trait]
pub trait ChannelServiceTrait: Send + Sync {
    async fn create_channel(
        &self,
        server_id: Uuid,
        name: &str,
        user_id: Uuid,
    ) -> Result<Channel, String>;

    async fn list_channel(
        &self,
        server_id: Uuid,
        user_id: Uuid,
    ) -> Result<Vec<Channel>, String>;

    async fn update_channel(
        &self,
        channel_id: Uuid,
        payload: UpdateChannel,
        user_id: Uuid,
    ) -> Result<Channel, String>;

    async fn delete_channel(
        &self,
        channel_id: Uuid,
        user_id: Uuid,
    ) -> Result<Channel, String>;
}

pub struct ChannelService {
    repo: Arc<dyn ChannelRepositoryTrait>,
}

impl ChannelService {
    pub fn new(repo: Arc<dyn ChannelRepositoryTrait>) -> Self {
        Self { repo }
    }

    pub async fn create_channel(
        &self,
        server_id: Uuid,
        name: &str,
        user_id: Uuid,
    ) -> Result<Channel, String> {
        let name = name.trim();

        if name.len() < 3 || name.len() > 50 {
            return Err("Channel name must be between 3 and 50 characters.".into());
        }

        if !self.repo.user_can_manage_channels(server_id, user_id).await? {
            return Err("Forbidden".into());
        }

        self.repo.create(server_id, name).await.map_err(|e| {
            log::error!("create_channel error: {:?}", e);
            "Unable to create channel.".to_string()
        })
    }

    pub async fn list_channel(
        &self,
        server_id: Uuid,
        user_id: Uuid,
    ) -> Result<Vec<Channel>, String> {
        if !self.repo.user_is_member(server_id, user_id).await? {
            return Err("Forbidden".into());
        }

        self.repo.list_for_server(server_id).await.map_err(|e| {
            log::error!("list_channel error: {:?}", e);
            "Unable to list channels.".to_string()
        })
    }

    pub async fn update_channel(
        &self,
        channel_id: Uuid,
        payload: UpdateChannel,
        user_id: Uuid,
    ) -> Result<Channel, String> {
        if !self.repo.user_can_manage_channel(channel_id, user_id).await? {
            return Err("Forbidden".into());
        }

        self.repo.update(channel_id, payload).await.map_err(|e| {
            log::error!("update_channel error: {:?}", e);
            "Unable to update channel.".to_string()
        })
    }

    pub async fn delete_channel(
        &self,
        channel_id: Uuid,
        user_id: Uuid,
    ) -> Result<Channel, String> {
        if !self.repo.user_can_manage_channel(channel_id, user_id).await? {
            return Err("Forbidden".into());
        }

        self.repo.delete(channel_id).await.map_err(|e| {
            log::error!("delete_channel error: {:?}", e);
            "Unable to delete channel.".to_string()
        })
    }
}

#[async_trait]
impl ChannelServiceTrait for ChannelService {
    async fn create_channel(
        &self,
        server_id: Uuid,
        name: &str,
        user_id: Uuid,
    ) -> Result<Channel, String> {
        ChannelService::create_channel(self, server_id, name, user_id).await
    }

    async fn list_channel(
        &self,
        server_id: Uuid,
        user_id: Uuid,
    ) -> Result<Vec<Channel>, String> {
        ChannelService::list_channel(self, server_id, user_id).await
    }

    async fn update_channel(
        &self,
        channel_id: Uuid,
        payload: UpdateChannel,
        user_id: Uuid,
    ) -> Result<Channel, String> {
        ChannelService::update_channel(self, channel_id, payload, user_id).await
    }

    async fn delete_channel(&self, channel_id: Uuid, user_id: Uuid) -> Result<Channel, String> {
        ChannelService::delete_channel(self, channel_id, user_id).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn sample_channel() -> Channel {
        Channel {
            id: Uuid::new_v4(),
            name: "general".to_string(),
            server_id: Uuid::new_v4(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    struct FakeChannelRepository {
        can_manage_channels_result: Result<bool, String>,
        create_result: Result<Channel, String>,
        is_member_result: Result<bool, String>,
        list_result: Result<Vec<Channel>, String>,
        can_manage_channel_result: Result<bool, String>,
        update_result: Result<Channel, String>,
        delete_result: Result<(), String>,
        last_create_name: Mutex<Option<String>>,
    }

    impl FakeChannelRepository {
        fn new() -> Self {
            Self {
                can_manage_channels_result: Ok(true),
                create_result: Ok(sample_channel()),
                is_member_result: Ok(true),
                list_result: Ok(vec![sample_channel()]),
                can_manage_channel_result: Ok(true),
                update_result: Ok(sample_channel()),
                delete_result: Ok(()),
                last_create_name: Mutex::new(None),
            }
        }
    }

    #[async_trait]
    impl ChannelRepositoryTrait for FakeChannelRepository {
        async fn create(&self, _server_id: Uuid, name: &str) -> Result<Channel, String> {
            *self.last_create_name.lock().unwrap() = Some(name.to_string());
            self.create_result.clone()
        }

        async fn list_for_server(&self, _server_id: Uuid) -> Result<Vec<Channel>, String> {
            self.list_result.clone()
        }

        async fn update(
            &self,
            _channel_id: Uuid,
            _payload: UpdateChannel,
        ) -> Result<Channel, String> {
            self.update_result.clone()
        }

        async fn delete(&self, _channel_id: Uuid) -> Result<(), String> {
            self.delete_result.clone()
        }

        async fn user_is_member(&self, _server_id: Uuid, _user_id: Uuid) -> Result<bool, String> {
            self.is_member_result.clone()
        }

        async fn user_can_manage_channels(
            &self,
            _server_id: Uuid,
            _user_id: Uuid,
        ) -> Result<bool, String> {
            self.can_manage_channels_result.clone()
        }

        async fn user_can_manage_channel(
            &self,
            _channel_id: Uuid,
            _user_id: Uuid,
        ) -> Result<bool, String> {
            self.can_manage_channel_result.clone()
        }
    }

    #[actix_web::test]
    async fn test_create_channel_rejects_short_name() {
        let repo: Arc<dyn ChannelRepositoryTrait> = Arc::new(FakeChannelRepository::new());
        let service = ChannelService::new(repo);

        let err = service
            .create_channel(Uuid::new_v4(), "ab", Uuid::new_v4())
            .await
            .unwrap_err();

        assert_eq!(err, "Channel name must be between 3 and 50 characters.");
    }

    #[actix_web::test]
    async fn test_create_channel_rejects_long_name() {
        let repo: Arc<dyn ChannelRepositoryTrait> = Arc::new(FakeChannelRepository::new());
        let service = ChannelService::new(repo);

        let err = service
            .create_channel(Uuid::new_v4(), &"a".repeat(51), Uuid::new_v4())
            .await
            .unwrap_err();

        assert_eq!(err, "Channel name must be between 3 and 50 characters.");
    }

    #[actix_web::test]
    async fn test_create_channel_trims_name_before_repo_call() {
        let repo = Arc::new(FakeChannelRepository::new());
        let service = ChannelService::new(repo.clone());

        let result = service
            .create_channel(Uuid::new_v4(), "  general  ", Uuid::new_v4())
            .await;

        assert!(result.is_ok());
        assert_eq!(
            repo.last_create_name.lock().unwrap().as_deref(),
            Some("general")
        );
    }

    #[actix_web::test]
    async fn test_create_channel_returns_forbidden_when_user_cannot_manage() {
        let repo: Arc<dyn ChannelRepositoryTrait> = Arc::new(FakeChannelRepository {
            can_manage_channels_result: Ok(false),
            ..FakeChannelRepository::new()
        });
        let service = ChannelService::new(repo);

        let err = service
            .create_channel(Uuid::new_v4(), "general", Uuid::new_v4())
            .await
            .unwrap_err();

        assert_eq!(err, "Forbidden");
    }

    #[actix_web::test]
    async fn test_create_channel_propagates_permission_check_error() {
        let repo: Arc<dyn ChannelRepositoryTrait> = Arc::new(FakeChannelRepository {
            can_manage_channels_result: Err("DB error".into()),
            ..FakeChannelRepository::new()
        });
        let service = ChannelService::new(repo);

        let err = service
            .create_channel(Uuid::new_v4(), "general", Uuid::new_v4())
            .await
            .unwrap_err();

        assert_eq!(err, "DB error");
    }

    #[actix_web::test]
    async fn test_create_channel_maps_repo_create_error() {
        let repo: Arc<dyn ChannelRepositoryTrait> = Arc::new(FakeChannelRepository {
            create_result: Err("insert failed".into()),
            ..FakeChannelRepository::new()
        });
        let service = ChannelService::new(repo);

        let err = service
            .create_channel(Uuid::new_v4(), "general", Uuid::new_v4())
            .await
            .unwrap_err();

        assert_eq!(err, "Unable to create channel.");
    }

    #[actix_web::test]
    async fn test_list_channel_success() {
        let expected = vec![sample_channel(), sample_channel()];
        let repo: Arc<dyn ChannelRepositoryTrait> = Arc::new(FakeChannelRepository {
            list_result: Ok(expected.clone()),
            ..FakeChannelRepository::new()
        });
        let service = ChannelService::new(repo);

        let result = service
            .list_channel(Uuid::new_v4(), Uuid::new_v4())
            .await
            .unwrap();

        assert_eq!(result.len(), 2);
        assert_eq!(result[0].name, expected[0].name);
        assert_eq!(result[1].name, expected[1].name);
    }

    #[actix_web::test]
    async fn test_list_channel_returns_forbidden_when_not_member() {
        let repo: Arc<dyn ChannelRepositoryTrait> = Arc::new(FakeChannelRepository {
            is_member_result: Ok(false),
            ..FakeChannelRepository::new()
        });
        let service = ChannelService::new(repo);

        let err = service
            .list_channel(Uuid::new_v4(), Uuid::new_v4())
            .await
            .unwrap_err();

        assert_eq!(err, "Forbidden");
    }

    #[actix_web::test]
    async fn test_list_channel_propagates_membership_check_error() {
        let repo: Arc<dyn ChannelRepositoryTrait> = Arc::new(FakeChannelRepository {
            is_member_result: Err("DB error".into()),
            ..FakeChannelRepository::new()
        });
        let service = ChannelService::new(repo);

        let err = service
            .list_channel(Uuid::new_v4(), Uuid::new_v4())
            .await
            .unwrap_err();

        assert_eq!(err, "DB error");
    }

    #[actix_web::test]
    async fn test_list_channel_maps_repo_error() {
        let repo: Arc<dyn ChannelRepositoryTrait> = Arc::new(FakeChannelRepository {
            list_result: Err("select failed".into()),
            ..FakeChannelRepository::new()
        });
        let service = ChannelService::new(repo);

        let err = service
            .list_channel(Uuid::new_v4(), Uuid::new_v4())
            .await
            .unwrap_err();

        assert_eq!(err, "Unable to list channels.");
    }

    #[actix_web::test]
    async fn test_update_channel_success() {
        let expected = sample_channel();
        let repo: Arc<dyn ChannelRepositoryTrait> = Arc::new(FakeChannelRepository {
            update_result: Ok(expected.clone()),
            ..FakeChannelRepository::new()
        });
        let service = ChannelService::new(repo);

        let result = service
            .update_channel(
                Uuid::new_v4(),
                UpdateChannel {
                    name: Some("new-name".into()),
                },
                Uuid::new_v4(),
            )
            .await
            .unwrap();

        assert_eq!(result.id, expected.id);
        assert_eq!(result.name, expected.name);
    }

    #[actix_web::test]
    async fn test_update_channel_returns_forbidden_when_user_cannot_manage() {
        let repo: Arc<dyn ChannelRepositoryTrait> = Arc::new(FakeChannelRepository {
            can_manage_channel_result: Ok(false),
            ..FakeChannelRepository::new()
        });
        let service = ChannelService::new(repo);

        let err = service
            .update_channel(
                Uuid::new_v4(),
                UpdateChannel {
                    name: Some("new-name".into()),
                },
                Uuid::new_v4(),
            )
            .await
            .unwrap_err();

        assert_eq!(err, "Forbidden");
    }

    #[actix_web::test]
    async fn test_update_channel_propagates_permission_check_error() {
        let repo: Arc<dyn ChannelRepositoryTrait> = Arc::new(FakeChannelRepository {
            can_manage_channel_result: Err("DB error".into()),
            ..FakeChannelRepository::new()
        });
        let service = ChannelService::new(repo);

        let err = service
            .update_channel(
                Uuid::new_v4(),
                UpdateChannel {
                    name: Some("new-name".into()),
                },
                Uuid::new_v4(),
            )
            .await
            .unwrap_err();

        assert_eq!(err, "DB error");
    }

    #[actix_web::test]
    async fn test_update_channel_maps_repo_error() {
        let repo: Arc<dyn ChannelRepositoryTrait> = Arc::new(FakeChannelRepository {
            update_result: Err("update failed".into()),
            ..FakeChannelRepository::new()
        });
        let service = ChannelService::new(repo);

        let err = service
            .update_channel(
                Uuid::new_v4(),
                UpdateChannel {
                    name: Some("new-name".into()),
                },
                Uuid::new_v4(),
            )
            .await
            .unwrap_err();

        assert_eq!(err, "Unable to update channel.");
    }

    #[actix_web::test]
    async fn test_delete_channel_success() {
        let repo: Arc<dyn ChannelRepositoryTrait> = Arc::new(FakeChannelRepository::new());
        let service = ChannelService::new(repo);

        let result = service
            .delete_channel(Uuid::new_v4(), Uuid::new_v4())
            .await;

        assert!(result.is_ok());
    }

    #[actix_web::test]
    async fn test_delete_channel_returns_forbidden_when_user_cannot_manage() {
        let repo: Arc<dyn ChannelRepositoryTrait> = Arc::new(FakeChannelRepository {
            can_manage_channel_result: Ok(false),
            ..FakeChannelRepository::new()
        });
        let service = ChannelService::new(repo);

        let err = service
            .delete_channel(Uuid::new_v4(), Uuid::new_v4())
            .await
            .unwrap_err();

        assert_eq!(err, "Forbidden");
    }

    #[actix_web::test]
    async fn test_delete_channel_propagates_permission_check_error() {
        let repo: Arc<dyn ChannelRepositoryTrait> = Arc::new(FakeChannelRepository {
            can_manage_channel_result: Err("DB error".into()),
            ..FakeChannelRepository::new()
        });
        let service = ChannelService::new(repo);

        let err = service
            .delete_channel(Uuid::new_v4(), Uuid::new_v4())
            .await
            .unwrap_err();

        assert_eq!(err, "DB error");
    }

    #[actix_web::test]
    async fn test_delete_channel_maps_repo_error() {
        let repo: Arc<dyn ChannelRepositoryTrait> = Arc::new(FakeChannelRepository {
            delete_result: Err("delete failed".into()),
            ..FakeChannelRepository::new()
        });
        let service = ChannelService::new(repo);

        let err = service
            .delete_channel(Uuid::new_v4(), Uuid::new_v4())
            .await
            .unwrap_err();

        assert_eq!(err, "Unable to delete channel.");
    }

    #[actix_web::test]
    async fn test_trait_create_channel_delegates_to_service_impl() {
        let service: Arc<dyn ChannelServiceTrait> =
            Arc::new(ChannelService::new(Arc::new(FakeChannelRepository::new())));

        let result = service
            .create_channel(Uuid::new_v4(), "general", Uuid::new_v4())
            .await;

        assert!(result.is_ok());
    }
}
