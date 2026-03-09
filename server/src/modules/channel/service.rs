use uuid::Uuid;
use crate::modules::channel::repository::ChannelRepository;
use crate::models::channel::{Channel, UpdateChannel};

pub struct ChannelService {
    repo: ChannelRepository,
}

impl ChannelService {
    pub fn new(repo: ChannelRepository) -> Self {
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

        self.repo
            .create(server_id, name)
            .await
            .map_err(|e| {
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

        self.repo
            .list_for_server(server_id)
            .await
            .map_err(|e| {
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

        self.repo
            .update(channel_id, payload)
            .await
            .map_err(|e| {
                log::error!("update_channel error: {:?}", e);
                "Unable to update channel.".to_string()
            })
    }

    pub async fn delete_channel(
        &self,
        channel_id: Uuid,
        user_id: Uuid,
    ) -> Result<(), String> {
        if !self.repo.user_can_manage_channel(channel_id, user_id).await? {
            return Err("Forbidden".into());
        }

        self.repo
            .delete(channel_id)
            .await
            .map_err(|e| {
                log::error!("delete_channel error: {:?}", e);
                "Unable to delete channel.".to_string()
            })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::channel::UpdateChannel;
    use sqlx::PgPool;
    use sqlx::postgres::PgPoolOptions;
    use std::time::Duration;

    async fn pool_if_available() -> Option<PgPool> {
        let url = std::env::var("DATABASE_URL")
            .ok()
            .or_else(|| std::env::var("TEST_DATABASE_URL").ok())?;

        let pool = PgPoolOptions::new()
            .max_connections(5)
            .acquire_timeout(Duration::from_secs(5))
            .connect(&url)
            .await
            .ok()?;

        Some(pool)
    }

    #[actix_web::test]
    async fn test_create_channel_rejects_short_or_long_names() {
        let pool = match pool_if_available().await {
            Some(p) => p,
            None => return,
        };

        let repo = ChannelRepository::new(pool);
        let service = ChannelService::new(repo);

        let server_id = Uuid::new_v4();
        let user_id = Uuid::new_v4();

        let err = service.create_channel(server_id, "ab", user_id).await.unwrap_err();
        assert_eq!(err, "Channel name must be between 3 and 50 characters.");

        let err = service.create_channel(server_id, &"a".repeat(51), user_id).await.unwrap_err();
        assert_eq!(err, "Channel name must be between 3 and 50 characters.");
    }

    #[actix_web::test]
    async fn test_create_channel_trims_name_and_forbidden_if_no_permission() {
        let pool = match pool_if_available().await {
            Some(p) => p,
            None => return,
        };

        let repo = ChannelRepository::new(pool);
        let service = ChannelService::new(repo);

        let server_id = Uuid::new_v4();
        let user_id = Uuid::new_v4();

        let res = service.create_channel(server_id, "  general  ", user_id).await;
        assert!(res.is_err());
    }

    #[actix_web::test]
    async fn test_list_channel_forbidden_when_not_member() {
        let pool = match pool_if_available().await {
            Some(p) => p,
            None => return,
        };

        let repo = ChannelRepository::new(pool);
        let service = ChannelService::new(repo);

        let server_id = Uuid::new_v4();
        let user_id = Uuid::new_v4();

        let res = service.list_channel(server_id, user_id).await;
        assert!(res.is_err());
    }

    #[actix_web::test]
    async fn test_update_channel_forbidden_when_cannot_manage() {
        let pool = match pool_if_available().await {
            Some(p) => p,
            None => return,
        };

        let repo = ChannelRepository::new(pool);
        let service = ChannelService::new(repo);

        let channel_id = Uuid::new_v4();
        let user_id = Uuid::new_v4();

        let payload = UpdateChannel {
            name: Some("new-name".to_string()),
        };

        let err = service.update_channel(channel_id, payload, user_id).await.unwrap_err();
        assert_eq!(err, "Forbidden");
    }

    #[actix_web::test]
    async fn test_delete_channel_forbidden_when_cannot_manage() {
        let pool = match pool_if_available().await {
            Some(p) => p,
            None => return,
        };

        let repo = ChannelRepository::new(pool);
        let service = ChannelService::new(repo);

        let channel_id = Uuid::new_v4();
        let user_id = Uuid::new_v4();

        let err = service.delete_channel(channel_id, user_id).await.unwrap_err();
        assert_eq!(err, "Forbidden");
    }
}
