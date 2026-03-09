use actix_web::{web, HttpResponse, Responder};
use serde_json::json;
use validator::Validate;
use uuid::Uuid;

use crate::modules::auth::AuthenticatedUser;
use crate::modules::channel::service::ChannelService;
use crate::models::channel::{CreateChannel, ChannelResponse, UpdateChannel};

pub async fn create_channel(
    user: AuthenticatedUser,
    service: web::Data<ChannelService>,
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
    service: web::Data<ChannelService>,
    path: web::Path<Uuid>,
) -> impl Responder {
    let server_id = path.into_inner();

    match service.list_channel(server_id, user.user_id).await {
        Ok(channels) => HttpResponse::Ok().json(channels),
        Err(e) if e == "Forbidden" => HttpResponse::Forbidden().json(json!({ "error": "Forbidden" })),
        Err(e) => HttpResponse::BadRequest().json(json!({ "error": e })),
    }
}

pub async fn channel_update(
    user: AuthenticatedUser,
    service: web::Data<ChannelService>,
    path: web::Path<Uuid>,
    payload: web::Json<UpdateChannel>,
) -> impl Responder {
    if let Err(e) = payload.validate() {
        return HttpResponse::BadRequest().json(json!({ "error": e.to_string() }));
    }

    let channel_id = path.into_inner();

    match service.update_channel(channel_id, payload.into_inner(), user.user_id).await {
        Ok(channel) => HttpResponse::Ok().json(ChannelResponse::from(channel)),
        Err(e) if e == "Forbidden" => HttpResponse::Forbidden().json(json!({ "error": "Forbidden" })),
        Err(e) => HttpResponse::BadRequest().json(json!({ "error": e })),
    }
}

pub async fn channel_delete(
    user: AuthenticatedUser,
    service: web::Data<ChannelService>,
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
    use actix_web::{http::StatusCode, test, App};

    fn uuid_str() -> String {
        Uuid::new_v4().to_string()
    }

    #[actix_web::test]
    async fn test_config_in_servers_scope_route_exists_post_returns_not_404() {
        let app = test::init_service(App::new().configure(config_in_servers_scope)).await;

        let req = test::TestRequest::post()
            .uri(&format!("/{}/channels", uuid_str()))
            .set_json(serde_json::json!({ "name": "general" }))
            .to_request();

        let resp = test::call_service(&app, req).await;

        assert_ne!(resp.status(), StatusCode::NOT_FOUND);
    }

    #[actix_web::test]
    async fn test_config_in_servers_scope_route_exists_get_returns_not_404() {
        let app = test::init_service(App::new().configure(config_in_servers_scope)).await;

        let req = test::TestRequest::get()
            .uri(&format!("/{}/channels", uuid_str()))
            .to_request();

        let resp = test::call_service(&app, req).await;

        assert_ne!(resp.status(), StatusCode::NOT_FOUND);
    }

    #[actix_web::test]
    async fn test_config_in_servers_scope_wrong_method_returns_404_or_405() {
        let app = test::init_service(App::new().configure(config_in_servers_scope)).await;

        let req = test::TestRequest::put()
            .uri(&format!("/{}/channels", uuid_str()))
            .to_request();

        let resp = test::call_service(&app, req).await;

        assert!(resp.status() == StatusCode::NOT_FOUND || resp.status() == StatusCode::METHOD_NOT_ALLOWED);
    }

    #[actix_web::test]
    async fn test_config_root_route_exists_put_returns_not_404() {
        let app = test::init_service(App::new().configure(config_root)).await;

        let req = test::TestRequest::put()
            .uri(&format!("/channels/{}", uuid_str()))
            .set_json(serde_json::json!({ "name": "new-name" }))
            .to_request();

        let resp = test::call_service(&app, req).await;

        assert_ne!(resp.status(), StatusCode::NOT_FOUND);
    }

    #[actix_web::test]
    async fn test_config_root_route_exists_delete_returns_not_404() {
        let app = test::init_service(App::new().configure(config_root)).await;

        let req = test::TestRequest::delete()
            .uri(&format!("/channels/{}", uuid_str()))
            .to_request();

        let resp = test::call_service(&app, req).await;

        assert_ne!(resp.status(), StatusCode::NOT_FOUND);
    }

    #[actix_web::test]
    async fn test_config_root_wrong_method_returns_404_or_405() {
        let app = test::init_service(App::new().configure(config_root)).await;

        let req = test::TestRequest::get()
            .uri(&format!("/channels/{}", uuid_str()))
            .to_request();

        let resp = test::call_service(&app, req).await;

        assert!(resp.status() == StatusCode::NOT_FOUND || resp.status() == StatusCode::METHOD_NOT_ALLOWED);
    }

    #[actix_web::test]
    async fn test_unrelated_path_is_404() {
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
}
