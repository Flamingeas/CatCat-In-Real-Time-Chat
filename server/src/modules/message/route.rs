use actix::Addr;
use actix_web::{web, HttpResponse, Responder};
use mongodb::Database;
use sqlx::PgPool;
use uuid::Uuid;
use validator::Validate;
use sqlx::Error;

use crate::models::message::{CreateMessage, UpdateMessage};
use crate::modules::auth::middleware::AuthenticatedUser;
use crate::websocket::server::{ClientMessage, WsServer};
use super::service::{MessageService, ServiceError};

pub async fn send_message(
    pg_pool: web::Data<PgPool>,
    mongo_db: web::Data<Database>,
    ws_server: web::Data<Addr<WsServer>>,
    user: AuthenticatedUser,
    path: web::Path<Uuid>,
    data: web::Json<SendMessageRequest>,
) -> impl Responder {
    let channel_id = path.into_inner();

    if let Err(e) = data.validate() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": e.to_string()
        }));
    }

    let service = MessageService::new(mongo_db.get_ref(), pg_pool.get_ref());

    let payload = CreateMessage {
        content: data.content.trim().to_string(),
        channel_id,
    };

    match service.send_message(user.user_id, payload).await {
        Ok(message) => {
            ws_server.do_send(ClientMessage::BroadcastNewMessage {
                server_id: message.server_id,
                channel_id: message.channel_id,
                message_id: message.message_id,
                user_id: message.user_id,
                username: message.username.clone(),
                content: message.content.clone(),
                created_at: message.created_at.to_rfc3339(),
            });

            HttpResponse::Created().json(message)
        }
        Err(e) => handle_service_error(e),
    }
}

pub async fn get_messages(
    pg_pool: web::Data<PgPool>,
    mongo_db: web::Data<Database>,
    user: AuthenticatedUser,
    path: web::Path<Uuid>,
    query: web::Query<GetMessagesQueryParams>,
) -> impl Responder {
    let channel_id = path.into_inner();
    let limit = query.limit.unwrap_or(50).clamp(1, 100);

    let service = MessageService::new(mongo_db.get_ref(), pg_pool.get_ref());

    match service
        .get_messages(user.user_id, channel_id, Some(limit), query.before)
        .await
    {
        Ok(messages) => HttpResponse::Ok().json(messages),
        Err(e) => handle_service_error(e),
    }
}

pub async fn update_message(
    pg_pool: web::Data<PgPool>,
    mongo_db: web::Data<Database>,
    user: AuthenticatedUser,
    path: web::Path<Uuid>,
    data: web::Json<UpdateMessageRequest>,
) -> impl Responder {
    let message_id = path.into_inner();

    if let Err(e) = data.validate() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": e.to_string()
        }));
    }

    let service = MessageService::new(mongo_db.get_ref(), pg_pool.get_ref());

    let payload = UpdateMessage {
        content: data.content.trim().to_string(),
    };

    match service.update_message(user.user_id, message_id, payload).await {
        Ok(message) => HttpResponse::Ok().json(message),
        Err(e) => handle_service_error(e),
    }
}

pub async fn delete_message(
    pg_pool: web::Data<PgPool>,
    mongo_db: web::Data<Database>,
    ws_server: web::Data<Addr<WsServer>>,
    user: AuthenticatedUser,
    path: web::Path<Uuid>,
) -> impl Responder {
    let message_id = path.into_inner();
    let service = MessageService::new(mongo_db.get_ref(), pg_pool.get_ref());

    match service.delete_message(user.user_id, message_id).await {
        Ok((server_id, channel_id, message_id)) => {
            ws_server.do_send(ClientMessage::BroadcastMessageDeleted {
                server_id,
                channel_id,
                message_id,
            });

            HttpResponse::NoContent().finish()
        }
        Err(e) => handle_service_error(e),
    }
}

#[derive(Debug, serde::Deserialize, Validate)]
pub struct SendMessageRequest {
    #[validate(length(min = 1, max = 2000))]
    pub content: String,
}

#[derive(Debug, serde::Deserialize, Validate)]
pub struct UpdateMessageRequest {
    #[validate(length(min = 1, max = 2000))]
    pub content: String,
}

#[derive(Debug, serde::Deserialize)]
pub struct GetMessagesQueryParams {
    pub limit: Option<i64>,
    pub before: Option<chrono::DateTime<chrono::Utc>>,
}

fn handle_service_error(error: ServiceError) -> HttpResponse {
    match error {
        ServiceError::NotFound(msg) => {
            HttpResponse::NotFound().json(serde_json::json!({ "error": msg }))
        }
        ServiceError::Forbidden(msg) => {
            HttpResponse::Forbidden().json(serde_json::json!({ "error": msg }))
        }
        ServiceError::Database(_e) => HttpResponse::InternalServerError()
            .json(serde_json::json!({ "error": "Database error" })),
        ServiceError::Internal(_msg) => HttpResponse::InternalServerError()
            .json(serde_json::json!({ "error": "Internal error" })),
    }
}

pub fn config(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/channels")
            .route("/{channel_id}/messages", web::post().to(send_message))
            .route("/{channel_id}/messages", web::get().to(get_messages)),
    );

    cfg.service(
        web::scope("/messages")
            .route("/{id}", web::put().to(update_message))
            .route("/{id}", web::delete().to(delete_message)),
    );
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::{body, http::StatusCode, test, App};
    use serde_json::Value;

    fn uuid_str() -> String {
        Uuid::new_v4().to_string()
    }

    #[test]
    async fn test_send_message_request_validation() {
        let ok = SendMessageRequest {
            content: "hello".to_string(),
        };
        assert!(ok.validate().is_ok());

        let bad = SendMessageRequest {
            content: "".to_string(),
        };
        assert!(bad.validate().is_err());

        let bad = SendMessageRequest {
            content: "a".repeat(2001),
        };
        assert!(bad.validate().is_err());
    }

    #[test]
    async fn test_update_message_request_validation() {
        let ok = UpdateMessageRequest {
            content: "hello".to_string(),
        };
        assert!(ok.validate().is_ok());

        let bad = UpdateMessageRequest {
            content: "".to_string(),
        };
        assert!(bad.validate().is_err());

        let bad = UpdateMessageRequest {
            content: "a".repeat(2001),
        };
        assert!(bad.validate().is_err());
    }

    #[actix_web::test]
    async fn test_handle_service_error_status_codes_and_json_shape() {
        let resp = handle_service_error(ServiceError::NotFound("x".to_string()));
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
        let bytes = body::to_bytes(resp.into_body()).await.unwrap();
        let v: Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(v["error"], "x");

        let resp = handle_service_error(ServiceError::Forbidden("no".to_string()));
        assert_eq!(resp.status(), StatusCode::FORBIDDEN);
        let bytes = body::to_bytes(resp.into_body()).await.unwrap();
        let v: Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(v["error"], "no");

        let resp = handle_service_error(
            ServiceError::Database(Error::RowNotFound)
        );
        assert_eq!(resp.status(), StatusCode::INTERNAL_SERVER_ERROR);
        let bytes = body::to_bytes(resp.into_body()).await.unwrap();
        let v: Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(v["error"], "Database error");

        let resp = handle_service_error(ServiceError::Internal("oops".to_string()));
        assert_eq!(resp.status(), StatusCode::INTERNAL_SERVER_ERROR);
        let bytes = body::to_bytes(resp.into_body()).await.unwrap();
        let v: Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(v["error"], "Internal error");
    }

    #[actix_web::test]
    async fn test_config_registers_routes_not_404() {
        let app = test::init_service(App::new().configure(config)).await;

        let req = test::TestRequest::post()
            .uri(&format!("/channels/{}/messages", uuid_str()))
            .set_json(serde_json::json!({ "content": "hello" }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_ne!(resp.status(), StatusCode::NOT_FOUND);

        let req = test::TestRequest::get()
            .uri(&format!("/channels/{}/messages", uuid_str()))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_ne!(resp.status(), StatusCode::NOT_FOUND);

        let req = test::TestRequest::put()
            .uri(&format!("/messages/{}", uuid_str()))
            .set_json(serde_json::json!({ "content": "hello" }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_ne!(resp.status(), StatusCode::NOT_FOUND);

        let req = test::TestRequest::delete()
            .uri(&format!("/messages/{}", uuid_str()))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_ne!(resp.status(), StatusCode::NOT_FOUND);
    }

    #[actix_web::test]
    async fn test_unrelated_path_is_404() {
        let app = test::init_service(App::new().configure(config)).await;

        let req = test::TestRequest::get().uri("/nope").to_request();
        let resp = test::call_service(&app, req).await;

        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    }
}
