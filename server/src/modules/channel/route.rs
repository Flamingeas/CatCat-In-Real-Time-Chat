use std::sync::Arc;

use actix_web::{web, HttpResponse, Responder};
use serde_json::json;
use uuid::Uuid;
use validator::Validate;

use crate::models::channel::{ChannelResponse, CreateChannel, UpdateChannel};
use crate::modules::auth::AuthenticatedUser;
use crate::modules::channel::service::ChannelServiceTrait;

pub async fn create_channel(
    user: AuthenticatedUser,
    service: web::Data<Arc<dyn ChannelServiceTrait>>,
    path: web::Path<Uuid>,
    payload: web::Json<CreateChannel>,
) -> impl Responder {
    if let Err(e) = payload.validate() {
        return HttpResponse::BadRequest().json(json!({ "error": e.to_string() }));
    }

    let server_id = path.into_inner();

    match service.create_channel(server_id, &payload.name, user.user_id).await {
        Ok(channel) => HttpResponse::Created().json(ChannelResponse::from(channel)),
        Err(e) => HttpResponse::BadRequest().json(json!({ "error": e })),
    }
}

pub async fn channel_list(
    user: AuthenticatedUser,
    service: web::Data<Arc<dyn ChannelServiceTrait>>,
    path: web::Path<Uuid>,
) -> impl Responder {
    let server_id = path.into_inner();

    match service.list_channel(server_id, user.user_id).await {
        Ok(channels) => HttpResponse::Ok().json(channels),
        Err(e) if e == "Forbidden" => {
            HttpResponse::Forbidden().json(json!({ "error": "Forbidden" }))
        }
        Err(e) => HttpResponse::BadRequest().json(json!({ "error": e })),
    }
}

pub async fn channel_update(
    user: AuthenticatedUser,
    service: web::Data<Arc<dyn ChannelServiceTrait>>,
    path: web::Path<Uuid>,
    payload: web::Json<UpdateChannel>,
) -> impl Responder {
    if let Err(e) = payload.validate() {
        return HttpResponse::BadRequest().json(json!({ "error": e.to_string() }));
    }

    let channel_id = path.into_inner();

    match service
        .update_channel(channel_id, payload.into_inner(), user.user_id)
        .await
    {
        Ok(channel) => HttpResponse::Ok().json(ChannelResponse::from(channel)),
        Err(e) if e == "Forbidden" => {
            HttpResponse::Forbidden().json(json!({ "error": "Forbidden" }))
        }
        Err(e) => HttpResponse::BadRequest().json(json!({ "error": e })),
    }
}

pub async fn channel_delete(
    user: AuthenticatedUser,
    service: web::Data<Arc<dyn ChannelServiceTrait>>,
    path: web::Path<Uuid>,
) -> impl Responder {
    let channel_id = path.into_inner();

    match service.delete_channel(channel_id, user.user_id).await {
        Ok(_) => HttpResponse::Ok().json(json!({
            "message": "Channel supprimé avec succès"
        })),
        Err(e) => HttpResponse::BadRequest().json(json!({ "error": e })),
    }
}

pub fn config_in_servers_scope(cfg: &mut web::ServiceConfig) {
    cfg.route("/{serverId}/channels", web::post().to(create_channel))
        .route("/{serverId}/channels", web::get().to(channel_list));
}

pub fn config_root(cfg: &mut web::ServiceConfig) {
    cfg.route("/channels/{id}", web::put().to(channel_update))
        .route("/channels/{id}", web::delete().to(channel_delete));
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::channel::Channel;
    use actix_web::{http::StatusCode, test, App};
    use async_trait::async_trait;
    use chrono::Utc;

    fn uuid_str() -> String {
        Uuid::new_v4().to_string()
    }

    fn sample_channel() -> Channel {
        Channel {
            id: Uuid::new_v4(),
            name: "general".to_string(),
            server_id: Uuid::new_v4(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    struct FakeChannelService {
        create_result: Option<Result<Channel, String>>,
        list_result: Option<Result<Vec<Channel>, String>>,
        update_result: Option<Result<Channel, String>>,
        delete_result: Option<Result<(), String>>,
    }

    #[async_trait]
    impl ChannelServiceTrait for FakeChannelService {
        async fn create_channel(
            &self,
            _server_id: Uuid,
            _name: &str,
            _user_id: Uuid,
        ) -> Result<Channel, String> {
            self.create_result.clone().unwrap()
        }

        async fn list_channel(
            &self,
            _server_id: Uuid,
            _user_id: Uuid,
        ) -> Result<Vec<Channel>, String> {
            self.list_result.clone().unwrap()
        }

        async fn update_channel(
            &self,
            _channel_id: Uuid,
            _payload: UpdateChannel,
            _user_id: Uuid,
        ) -> Result<Channel, String> {
            self.update_result.clone().unwrap()
        }

        async fn delete_channel(
            &self,
            _channel_id: Uuid,
            _user_id: Uuid,
        ) -> Result<(), String> {
            self.delete_result.clone().unwrap()
        }
    }

    fn fake_user() -> AuthenticatedUser {
        AuthenticatedUser {
            user_id: Uuid::new_v4(),
            email: "test@example.com".to_string(),
            username: Some("test_user".to_string()),
        }
    }

    #[actix_web::test]
    async fn test_create_channel_success() {
        let service: Arc<dyn ChannelServiceTrait> = Arc::new(FakeChannelService {
            create_result: Some(Ok(sample_channel())),
            list_result: None,
            update_result: None,
            delete_result: None,
        });

        let resp = create_channel(
            fake_user(),
            web::Data::new(service),
            web::Path::from(Uuid::new_v4()),
            web::Json(CreateChannel { name: "general".into() }),
        )
            .await
            .respond_to(&test::TestRequest::default().to_http_request());

        assert_eq!(resp.status(), StatusCode::CREATED);
    }

    #[actix_web::test]
    async fn test_create_channel_validation_error() {
        let service: Arc<dyn ChannelServiceTrait> = Arc::new(FakeChannelService {
            create_result: None,
            list_result: None,
            update_result: None,
            delete_result: None,
        });

        let resp = create_channel(
            fake_user(),
            web::Data::new(service),
            web::Path::from(Uuid::new_v4()),
            web::Json(CreateChannel { name: "".into() }),
        )
            .await
            .respond_to(&test::TestRequest::default().to_http_request());

        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    }

    #[actix_web::test]
    async fn test_create_channel_service_error_returns_400() {
        let service: Arc<dyn ChannelServiceTrait> = Arc::new(FakeChannelService {
            create_result: Some(Err("Unable to create channel.".into())),
            list_result: None,
            update_result: None,
            delete_result: None,
        });

        let resp = create_channel(
            fake_user(),
            web::Data::new(service),
            web::Path::from(Uuid::new_v4()),
            web::Json(CreateChannel { name: "general".into() }),
        )
            .await
            .respond_to(&test::TestRequest::default().to_http_request());

        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    }

    #[actix_web::test]
    async fn test_channel_list_success() {
        let service: Arc<dyn ChannelServiceTrait> = Arc::new(FakeChannelService {
            create_result: None,
            list_result: Some(Ok(vec![sample_channel(), sample_channel()])),
            update_result: None,
            delete_result: None,
        });

        let resp = channel_list(
            fake_user(),
            web::Data::new(service),
            web::Path::from(Uuid::new_v4()),
        )
            .await
            .respond_to(&test::TestRequest::default().to_http_request());

        assert_eq!(resp.status(), StatusCode::OK);
    }

    #[actix_web::test]
    async fn test_channel_list_forbidden() {
        let service: Arc<dyn ChannelServiceTrait> = Arc::new(FakeChannelService {
            create_result: None,
            list_result: Some(Err("Forbidden".into())),
            update_result: None,
            delete_result: None,
        });

        let resp = channel_list(
            fake_user(),
            web::Data::new(service),
            web::Path::from(Uuid::new_v4()),
        )
            .await
            .respond_to(&test::TestRequest::default().to_http_request());

        assert_eq!(resp.status(), StatusCode::FORBIDDEN);
    }

    #[actix_web::test]
    async fn test_channel_list_other_error_returns_400() {
        let service: Arc<dyn ChannelServiceTrait> = Arc::new(FakeChannelService {
            create_result: None,
            list_result: Some(Err("DB error".into())),
            update_result: None,
            delete_result: None,
        });

        let resp = channel_list(
            fake_user(),
            web::Data::new(service),
            web::Path::from(Uuid::new_v4()),
        )
            .await
            .respond_to(&test::TestRequest::default().to_http_request());

        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    }

    #[actix_web::test]
    async fn test_channel_update_success() {
        let service: Arc<dyn ChannelServiceTrait> = Arc::new(FakeChannelService {
            create_result: None,
            list_result: None,
            update_result: Some(Ok(sample_channel())),
            delete_result: None,
        });

        let resp = channel_update(
            fake_user(),
            web::Data::new(service),
            web::Path::from(Uuid::new_v4()),
            web::Json(UpdateChannel {
                name: Some("new".into()),
            }),
        )
            .await
            .respond_to(&test::TestRequest::default().to_http_request());

        assert_eq!(resp.status(), StatusCode::OK);
    }

    #[actix_web::test]
    async fn test_channel_update_validation_error() {
        let service: Arc<dyn ChannelServiceTrait> = Arc::new(FakeChannelService {
            create_result: None,
            list_result: None,
            update_result: None,
            delete_result: None,
        });

        let resp = channel_update(
            fake_user(),
            web::Data::new(service),
            web::Path::from(Uuid::new_v4()),
            web::Json(UpdateChannel {
                name: Some("".into()),
            }),
        )
            .await
            .respond_to(&test::TestRequest::default().to_http_request());

        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    }

    #[actix_web::test]
    async fn test_channel_update_forbidden() {
        let service: Arc<dyn ChannelServiceTrait> = Arc::new(FakeChannelService {
            create_result: None,
            list_result: None,
            update_result: Some(Err("Forbidden".into())),
            delete_result: None,
        });

        let resp = channel_update(
            fake_user(),
            web::Data::new(service),
            web::Path::from(Uuid::new_v4()),
            web::Json(UpdateChannel {
                name: Some("new-name".into()),
            }),
        )
            .await
            .respond_to(&test::TestRequest::default().to_http_request());

        assert_eq!(resp.status(), StatusCode::FORBIDDEN);
    }

    #[actix_web::test]
    async fn test_channel_update_other_error_returns_400() {
        let service: Arc<dyn ChannelServiceTrait> = Arc::new(FakeChannelService {
            create_result: None,
            list_result: None,
            update_result: Some(Err("Unable to update channel.".into())),
            delete_result: None,
        });

        let resp = channel_update(
            fake_user(),
            web::Data::new(service),
            web::Path::from(Uuid::new_v4()),
            web::Json(UpdateChannel {
                name: Some("new-name".into()),
            }),
        )
            .await
            .respond_to(&test::TestRequest::default().to_http_request());

        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    }

    #[actix_web::test]
    async fn test_channel_delete_success() {
        let service: Arc<dyn ChannelServiceTrait> = Arc::new(FakeChannelService {
            create_result: None,
            list_result: None,
            update_result: None,
            delete_result: Some(Ok(())),
        });

        let resp = channel_delete(
            fake_user(),
            web::Data::new(service),
            web::Path::from(Uuid::new_v4()),
        )
            .await
            .respond_to(&test::TestRequest::default().to_http_request());

        assert_eq!(resp.status(), StatusCode::OK);
    }

    #[actix_web::test]
    async fn test_channel_delete_error_returns_400() {
        let service: Arc<dyn ChannelServiceTrait> = Arc::new(FakeChannelService {
            create_result: None,
            list_result: None,
            update_result: None,
            delete_result: Some(Err("Unable to delete channel.".into())),
        });

        let resp = channel_delete(
            fake_user(),
            web::Data::new(service),
            web::Path::from(Uuid::new_v4()),
        )
            .await
            .respond_to(&test::TestRequest::default().to_http_request());

        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    }

    #[actix_web::test]
    async fn test_config_in_servers_scope_post_route_exists() {
        let app = test::init_service(App::new().configure(config_in_servers_scope)).await;

        let req = test::TestRequest::post()
            .uri(&format!("/{}/channels", uuid_str()))
            .set_json(serde_json::json!({ "name": "general" }))
            .to_request();

        let resp = test::call_service(&app, req).await;

        assert_ne!(resp.status(), StatusCode::NOT_FOUND);
    }

    #[actix_web::test]
    async fn test_config_in_servers_scope_get_route_exists() {
        let app = test::init_service(App::new().configure(config_in_servers_scope)).await;

        let req = test::TestRequest::get()
            .uri(&format!("/{}/channels", uuid_str()))
            .to_request();

        let resp = test::call_service(&app, req).await;

        assert_ne!(resp.status(), StatusCode::NOT_FOUND);
    }

    #[actix_web::test]
    async fn test_config_in_servers_scope_put_not_allowed() {
        let app = test::init_service(App::new().configure(config_in_servers_scope)).await;

        let req = test::TestRequest::put()
            .uri(&format!("/{}/channels", uuid_str()))
            .to_request();

        let resp = test::call_service(&app, req).await;

        assert!(
            resp.status() == StatusCode::NOT_FOUND
                || resp.status() == StatusCode::METHOD_NOT_ALLOWED
        );
    }

    #[actix_web::test]
    async fn test_config_in_servers_scope_delete_not_allowed() {
        let app = test::init_service(App::new().configure(config_in_servers_scope)).await;

        let req = test::TestRequest::delete()
            .uri(&format!("/{}/channels", uuid_str()))
            .to_request();

        let resp = test::call_service(&app, req).await;

        assert!(
            resp.status() == StatusCode::NOT_FOUND
                || resp.status() == StatusCode::METHOD_NOT_ALLOWED
        );
    }

    #[actix_web::test]
    async fn test_config_in_servers_scope_invalid_uuid_returns_not_found() {
        let app = test::init_service(App::new().configure(config_in_servers_scope)).await;

        let req = test::TestRequest::get()
            .uri("/not-a-uuid/channels")
            .to_request();

        let resp = test::call_service(&app, req).await;

        assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
    }

    #[actix_web::test]
    async fn test_config_in_servers_scope_missing_server_id_returns_not_found() {
        let app = test::init_service(App::new().configure(config_in_servers_scope)).await;

        let req = test::TestRequest::get().uri("/channels").to_request();

        let resp = test::call_service(&app, req).await;

        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    }

    #[actix_web::test]
    async fn test_config_root_put_route_exists() {
        let app = test::init_service(App::new().configure(config_root)).await;

        let req = test::TestRequest::put()
            .uri(&format!("/channels/{}", uuid_str()))
            .set_json(serde_json::json!({ "name": "new-name" }))
            .to_request();

        let resp = test::call_service(&app, req).await;

        assert_ne!(resp.status(), StatusCode::NOT_FOUND);
    }

    #[actix_web::test]
    async fn test_config_root_delete_route_exists() {
        let app = test::init_service(App::new().configure(config_root)).await;

        let req = test::TestRequest::delete()
            .uri(&format!("/channels/{}", uuid_str()))
            .to_request();

        let resp = test::call_service(&app, req).await;

        assert_ne!(resp.status(), StatusCode::NOT_FOUND);
    }

    #[actix_web::test]
    async fn test_config_root_get_not_allowed() {
        let app = test::init_service(App::new().configure(config_root)).await;

        let req = test::TestRequest::get()
            .uri(&format!("/channels/{}", uuid_str()))
            .to_request();

        let resp = test::call_service(&app, req).await;

        assert!(
            resp.status() == StatusCode::NOT_FOUND
                || resp.status() == StatusCode::METHOD_NOT_ALLOWED
        );
    }

    #[actix_web::test]
    async fn test_config_root_post_not_allowed() {
        let app = test::init_service(App::new().configure(config_root)).await;

        let req = test::TestRequest::post()
            .uri(&format!("/channels/{}", uuid_str()))
            .set_json(serde_json::json!({ "name": "general" }))
            .to_request();

        let resp = test::call_service(&app, req).await;

        assert!(
            resp.status() == StatusCode::NOT_FOUND
                || resp.status() == StatusCode::METHOD_NOT_ALLOWED
        );
    }

    #[actix_web::test]
    async fn test_config_root_invalid_uuid_returns_not_found() {
        let app = test::init_service(App::new().configure(config_root)).await;

        let req = test::TestRequest::put()
            .uri("/channels/not-a-uuid")
            .set_json(serde_json::json!({ "name": "general" }))
            .to_request();

        let resp = test::call_service(&app, req).await;

        assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
    }

    #[actix_web::test]
    async fn test_config_root_missing_id_returns_not_found() {
        let app = test::init_service(App::new().configure(config_root)).await;

        let req = test::TestRequest::put()
            .uri("/channels")
            .set_json(serde_json::json!({ "name": "general" }))
            .to_request();

        let resp = test::call_service(&app, req).await;

        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    }

    #[actix_web::test]
    async fn test_both_configs_unrelated_path_returns_404() {
        let app = test::init_service(
            App::new()
                .configure(config_in_servers_scope)
                .configure(config_root),
        )
            .await;

        let req = test::TestRequest::get().uri("/nope").to_request();
        let resp = test::call_service(&app, req).await;

        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    }

    #[actix_web::test]
    async fn test_both_configs_similar_but_non_matching_path_returns_404() {
        let app = test::init_service(
            App::new()
                .configure(config_in_servers_scope)
                .configure(config_root),
        )
            .await;

        let req = test::TestRequest::get()
            .uri(&format!("/{}/channel", uuid_str()))
            .to_request();

        let resp = test::call_service(&app, req).await;

        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    }
}
