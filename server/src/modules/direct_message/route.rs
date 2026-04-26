use actix::Addr;
use actix_web::{web, HttpResponse, Responder};
use chrono::DateTime;
use mongodb::Database;
use sqlx::PgPool;
use utoipa::{IntoParams, ToSchema};
use uuid::Uuid;
use validator::Validate;

use super::service::{DirectMessageService, ServiceError};
use crate::modules::auth::middleware::AuthenticatedUser;
use crate::modules::message::route::ReactionRequest;
use crate::utils::errors::json_error;
use crate::websocket::server::{ClientMessage, WsServer};

#[derive(Debug, serde::Deserialize, Validate, ToSchema)]
pub struct SendDirectMessageRequest {
    #[validate(length(min = 1, max = 2000))]
    #[schema(example = "Hey, how are you?")]
    pub content: String,
}

#[derive(Debug, serde::Deserialize, Validate, ToSchema)]
pub struct UpdateDirectMessageRequest {
    #[validate(length(min = 1, max = 2000))]
    #[schema(example = "Hey, how are you? (edited)")]
    pub content: String,
}

#[derive(Debug, serde::Deserialize, ToSchema)]
pub struct StartConversationRequest {
    pub recipient_id: Uuid,
}

#[derive(Debug, serde::Deserialize, IntoParams)]
pub struct GetDmMessagesQuery {
    pub limit: Option<i64>,
    pub before: Option<DateTime<chrono::Utc>>,
}

fn handle_service_error(error: ServiceError) -> HttpResponse {
    match error {
        ServiceError::NotFound(msg) => json_error(
            actix_web::http::StatusCode::NOT_FOUND,
            "DIRECT_MESSAGE_NOT_FOUND",
            msg,
        ),
        ServiceError::Forbidden(msg) => json_error(
            actix_web::http::StatusCode::FORBIDDEN,
            "PERMISSION_DENIED",
            msg,
        ),
        ServiceError::Database(_e) => json_error(
            actix_web::http::StatusCode::INTERNAL_SERVER_ERROR,
            "DATABASE_ERROR",
            "Database error",
        ),
        ServiceError::Internal(_msg) => json_error(
            actix_web::http::StatusCode::INTERNAL_SERVER_ERROR,
            "INTERNAL_ERROR",
            "Internal error",
        ),
    }
}

fn bad_request(msg: String) -> HttpResponse {
    json_error(actix_web::http::StatusCode::BAD_REQUEST, "BAD_REQUEST", msg)
}

async fn start_conversation_with_service(
    service: &DirectMessageService,
    user_id: Uuid,
    recipient_id: Uuid,
) -> HttpResponse {
    match service
        .get_or_create_conversation(user_id, recipient_id)
        .await
    {
        Ok(conv) => HttpResponse::Ok().json(conv),
        Err(e) => handle_service_error(e),
    }
}

async fn list_conversations_with_service(
    service: &DirectMessageService,
    user_id: Uuid,
) -> HttpResponse {
    match service.list_conversations(user_id).await {
        Ok(convs) => HttpResponse::Ok().json(convs),
        Err(e) => handle_service_error(e),
    }
}

async fn get_messages_with_service(
    service: &DirectMessageService,
    conversation_id: Uuid,
    user_id: Uuid,
    query: &GetDmMessagesQuery,
) -> HttpResponse {
    let limit = query.limit.unwrap_or(50).clamp(1, 100);
    match service
        .get_messages(conversation_id, user_id, limit, query.before)
        .await
    {
        Ok(msgs) => HttpResponse::Ok().json(msgs),
        Err(e) => handle_service_error(e),
    }
}

async fn send_message_with_service(
    service: &DirectMessageService,
    ws_server: &Addr<WsServer>,
    conversation_id: Uuid,
    sender_id: Uuid,
    sender_username: String,
    data: &SendDirectMessageRequest,
) -> HttpResponse {
    if let Err(e) = data.validate() {
        return bad_request(e.to_string());
    }

    let content = data.content.trim().to_string();

    match service
        .send_message(conversation_id, sender_id, sender_username.clone(), content)
        .await
    {
        Ok((dm, recipient_id)) => {
            ws_server.do_send(ClientMessage::BroadcastDirectMessage {
                conversation_id,
                message_id: dm.message_id,
                sender_id,
                sender_username,
                recipient_id,
                content: dm.content.clone(),
                created_at: dm.created_at.to_rfc3339(),
            });
            HttpResponse::Created().json(dm)
        }
        Err(e) => handle_service_error(e),
    }
}

async fn update_message_with_service(
    service: &DirectMessageService,
    ws_server: &Addr<WsServer>,
    message_id: Uuid,
    user_id: Uuid,
    data: &UpdateDirectMessageRequest,
) -> HttpResponse {
    if let Err(e) = data.validate() {
        return bad_request(e.to_string());
    }
    let content = data.content.trim().to_string();
    match service.update_message(message_id, user_id, content).await {
        Ok((dm, recipient_id)) => {
            let updated_at = dm.updated_at.unwrap_or(dm.created_at).to_rfc3339();
            ws_server.do_send(ClientMessage::BroadcastDirectMessageUpdated {
                conversation_id: dm.conversation_id,
                message_id: dm.message_id,
                sender_id: user_id,
                recipient_id,
                content: dm.content.clone(),
                updated_at,
            });
            HttpResponse::Ok().json(dm)
        }
        Err(e) => handle_service_error(e),
    }
}

async fn delete_message_with_service(
    service: &DirectMessageService,
    ws_server: &Addr<WsServer>,
    message_id: Uuid,
    user_id: Uuid,
) -> HttpResponse {
    match service.delete_message(message_id, user_id).await {
        Ok((conversation_id, recipient_id)) => {
            ws_server.do_send(ClientMessage::BroadcastDirectMessageDeleted {
                conversation_id,
                message_id,
                sender_id: user_id,
                recipient_id,
            });
            HttpResponse::NoContent().finish()
        }
        Err(e) => handle_service_error(e),
    }
}

fn validate_reaction_request(data: &ReactionRequest) -> Result<String, String> {
    let emoji = data.emoji.trim();
    if emoji.is_empty() || emoji.chars().count() > 16 {
        return Err("Emoji reaction is not valid".to_string());
    }

    Ok(emoji.to_string())
}

async fn add_reaction_with_service(
    service: &DirectMessageService,
    ws_server: &Addr<WsServer>,
    user_id: Uuid,
    message_id: Uuid,
    data: &ReactionRequest,
) -> HttpResponse {
    let emoji = match validate_reaction_request(data) {
        Ok(emoji) => emoji,
        Err(error_message) => return bad_request(error_message),
    };

    match service
        .add_reaction(message_id, user_id, emoji.clone())
        .await
    {
        Ok((conversation_id, recipient_id)) => {
            ws_server.do_send(ClientMessage::BroadcastDirectMessageReactionAdded {
                conversation_id,
                message_id,
                user_id,
                recipient_id,
                emoji,
            });
            HttpResponse::NoContent().finish()
        }
        Err(e) => handle_service_error(e),
    }
}

async fn remove_reaction_with_service(
    service: &DirectMessageService,
    ws_server: &Addr<WsServer>,
    user_id: Uuid,
    message_id: Uuid,
    data: &ReactionRequest,
) -> HttpResponse {
    let emoji = match validate_reaction_request(data) {
        Ok(emoji) => emoji,
        Err(error_message) => return bad_request(error_message),
    };

    match service
        .remove_reaction(message_id, user_id, emoji.clone())
        .await
    {
        Ok((conversation_id, recipient_id)) => {
            ws_server.do_send(ClientMessage::BroadcastDirectMessageReactionRemoved {
                conversation_id,
                message_id,
                user_id,
                recipient_id,
                emoji,
            });
            HttpResponse::NoContent().finish()
        }
        Err(e) => handle_service_error(e),
    }
}

// Public route handlers
#[utoipa::path(
    post,
    path = "/api/dm/conversations",
    tag = "Direct Messages",
    request_body = StartConversationRequest,
    responses(
        (status = 200, description = "Conversation retrieved or created"),
        (status = 404, description = "Recipient not found"),
        (status = 403, description = "Cannot start a conversation with yourself"),
    ),
    security(("jwt" = []))
)]
pub async fn start_conversation(
    pg: web::Data<PgPool>,
    mongo: web::Data<Database>,
    user: AuthenticatedUser,
    body: web::Json<StartConversationRequest>,
) -> impl Responder {
    let svc = DirectMessageService::new(mongo.get_ref(), pg.get_ref());
    start_conversation_with_service(&svc, user.user_id, body.recipient_id).await
}

#[utoipa::path(
    get,
    path = "/api/dm/conversations",
    tag = "Direct Messages",
    responses(
        (status = 200, description = "List of conversations"),
    ),
    security(("jwt" = []))
)]
pub async fn list_conversations(
    pg: web::Data<PgPool>,
    mongo: web::Data<Database>,
    user: AuthenticatedUser,
) -> impl Responder {
    let svc = DirectMessageService::new(mongo.get_ref(), pg.get_ref());
    list_conversations_with_service(&svc, user.user_id).await
}

#[utoipa::path(
    get,
    path = "/api/dm/conversations/{conversation_id}/messages",
    tag = "Direct Messages",
    params(
        ("conversation_id" = Uuid, Path, description = "Conversation ID"),
        GetDmMessagesQuery
    ),
    responses(
        (status = 200, description = "Message history"),
        (status = 403, description = "Not a participant"),
        (status = 404, description = "Conversation not found"),
    ),
    security(("jwt" = []))
)]
pub async fn get_messages(
    pg: web::Data<PgPool>,
    mongo: web::Data<Database>,
    user: AuthenticatedUser,
    path: web::Path<Uuid>,
    query: web::Query<GetDmMessagesQuery>,
) -> impl Responder {
    let conversation_id = path.into_inner();
    let svc = DirectMessageService::new(mongo.get_ref(), pg.get_ref());
    get_messages_with_service(&svc, conversation_id, user.user_id, &query).await
}

#[utoipa::path(
    post,
    path = "/api/dm/conversations/{conversation_id}/messages",
    tag = "Direct Messages",
    params(
        ("conversation_id" = Uuid, Path, description = "Conversation ID")
    ),
    request_body = SendDirectMessageRequest,
    responses(
        (status = 201, description = "Message sent"),
        (status = 400, description = "Validation error"),
        (status = 403, description = "Not a participant"),
        (status = 404, description = "Conversation not found"),
    ),
    security(("jwt" = []))
)]
pub async fn send_message(
    pg: web::Data<PgPool>,
    mongo: web::Data<Database>,
    ws_server: web::Data<Addr<WsServer>>,
    user: AuthenticatedUser,
    path: web::Path<Uuid>,
    body: web::Json<SendDirectMessageRequest>,
) -> impl Responder {
    let conversation_id = path.into_inner();
    let sender_username = user.username.clone().unwrap_or_default();
    let svc = DirectMessageService::new(mongo.get_ref(), pg.get_ref());
    send_message_with_service(
        &svc,
        ws_server.get_ref(),
        conversation_id,
        user.user_id,
        sender_username,
        &body,
    )
    .await
}

#[utoipa::path(
    put,
    path = "/api/dm/messages/{message_id}",
    tag = "Direct Messages",
    params(
        ("message_id" = Uuid, Path, description = "Message ID")
    ),
    request_body = UpdateDirectMessageRequest,
    responses(
        (status = 200, description = "Message updated"),
        (status = 400, description = "Validation error"),
        (status = 403, description = "Not your message"),
        (status = 404, description = "Message not found"),
    ),
    security(("jwt" = []))
)]
pub async fn update_message(
    pg: web::Data<PgPool>,
    mongo: web::Data<Database>,
    ws_server: web::Data<Addr<WsServer>>,
    user: AuthenticatedUser,
    path: web::Path<Uuid>,
    body: web::Json<UpdateDirectMessageRequest>,
) -> impl Responder {
    let message_id = path.into_inner();
    let svc = DirectMessageService::new(mongo.get_ref(), pg.get_ref());
    update_message_with_service(&svc, ws_server.get_ref(), message_id, user.user_id, &body).await
}

#[utoipa::path(
    delete,
    path = "/api/dm/messages/{message_id}",
    tag = "Direct Messages",
    params(
        ("message_id" = Uuid, Path, description = "Message ID")
    ),
    responses(
        (status = 204, description = "Message deleted"),
        (status = 403, description = "Not your message"),
        (status = 404, description = "Message not found"),
    ),
    security(("jwt" = []))
)]
pub async fn delete_message(
    pg: web::Data<PgPool>,
    mongo: web::Data<Database>,
    ws_server: web::Data<Addr<WsServer>>,
    user: AuthenticatedUser,
    path: web::Path<Uuid>,
) -> impl Responder {
    let message_id = path.into_inner();
    let svc = DirectMessageService::new(mongo.get_ref(), pg.get_ref());
    delete_message_with_service(&svc, ws_server.get_ref(), message_id, user.user_id).await
}

pub async fn add_reaction(
    pg: web::Data<PgPool>,
    mongo: web::Data<Database>,
    ws_server: web::Data<Addr<WsServer>>,
    user: AuthenticatedUser,
    path: web::Path<Uuid>,
    body: web::Json<ReactionRequest>,
) -> impl Responder {
    let message_id = path.into_inner();
    let svc = DirectMessageService::new(mongo.get_ref(), pg.get_ref());
    add_reaction_with_service(&svc, ws_server.get_ref(), user.user_id, message_id, &body).await
}

pub async fn remove_reaction(
    pg: web::Data<PgPool>,
    mongo: web::Data<Database>,
    ws_server: web::Data<Addr<WsServer>>,
    user: AuthenticatedUser,
    path: web::Path<Uuid>,
    body: web::Json<ReactionRequest>,
) -> impl Responder {
    let message_id = path.into_inner();
    let svc = DirectMessageService::new(mongo.get_ref(), pg.get_ref());
    remove_reaction_with_service(&svc, ws_server.get_ref(), user.user_id, message_id, &body).await
}

pub fn config(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/dm")
            .route("/conversations", web::post().to(start_conversation))
            .route("/conversations", web::get().to(list_conversations))
            .route(
                "/conversations/{conversation_id}/messages",
                web::get().to(get_messages),
            )
            .route(
                "/conversations/{conversation_id}/messages",
                web::post().to(send_message),
            )
            .route("/messages/{message_id}", web::put().to(update_message))
            .route("/messages/{message_id}", web::delete().to(delete_message))
            .route(
                "/messages/{message_id}/reactions",
                web::post().to(add_reaction),
            )
            .route(
                "/messages/{message_id}/reactions",
                web::delete().to(remove_reaction),
            ),
    );
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::body::to_bytes;
    use actix_web::http::StatusCode;
    use actix_web::App;
    use serde_json::Value;
    use validator::Validate;

    async fn json_body(response: HttpResponse) -> Value {
        let body = to_bytes(response.into_body()).await.unwrap();
        serde_json::from_slice(&body).unwrap()
    }

    #[actix_web::test]
    async fn service_errors_map_to_expected_status_codes_and_payloads() {
        let cases = vec![
            (
                ServiceError::NotFound("missing".to_string()),
                StatusCode::NOT_FOUND,
                "DIRECT_MESSAGE_NOT_FOUND",
            ),
            (
                ServiceError::Forbidden("nope".to_string()),
                StatusCode::FORBIDDEN,
                "PERMISSION_DENIED",
            ),
            (
                ServiceError::Database(sqlx::Error::RowNotFound),
                StatusCode::INTERNAL_SERVER_ERROR,
                "DATABASE_ERROR",
            ),
            (
                ServiceError::Internal("boom".to_string()),
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL_ERROR",
            ),
        ];

        for (error, status, code) in cases {
            let response = handle_service_error(error);
            assert_eq!(response.status(), status);
            let body = json_body(response).await;
            assert_eq!(body["code"], code);
        }
    }

    #[actix_web::test]
    async fn bad_request_returns_json_error() {
        let response = bad_request("invalid".to_string());
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);

        let body = json_body(response).await;
        assert_eq!(body["code"], "BAD_REQUEST");
        assert_eq!(body["message"], "invalid");
    }

    #[test]
    fn direct_message_request_validation_accepts_boundaries() {
        assert!(SendDirectMessageRequest {
            content: "a".to_string()
        }
        .validate()
        .is_ok());
        assert!(SendDirectMessageRequest {
            content: "a".repeat(2000)
        }
        .validate()
        .is_ok());
        assert!(UpdateDirectMessageRequest {
            content: "b".to_string()
        }
        .validate()
        .is_ok());
        assert!(UpdateDirectMessageRequest {
            content: "b".repeat(2000)
        }
        .validate()
        .is_ok());
    }

    #[test]
    fn direct_message_request_validation_rejects_empty_and_too_long_content() {
        assert!(SendDirectMessageRequest {
            content: String::new()
        }
        .validate()
        .is_err());
        assert!(SendDirectMessageRequest {
            content: "a".repeat(2001)
        }
        .validate()
        .is_err());
        assert!(UpdateDirectMessageRequest {
            content: String::new()
        }
        .validate()
        .is_err());
        assert!(UpdateDirectMessageRequest {
            content: "b".repeat(2001)
        }
        .validate()
        .is_err());
    }

    #[test]
    fn validate_reaction_request_trims_and_limits_emoji() {
        assert_eq!(
            validate_reaction_request(&ReactionRequest {
                emoji: "  :cat:  ".to_string()
            })
            .unwrap(),
            ":cat:"
        );
        assert!(validate_reaction_request(&ReactionRequest {
            emoji: " ".to_string()
        })
        .is_err());
        assert!(validate_reaction_request(&ReactionRequest {
            emoji: "x".repeat(17)
        })
        .is_err());
    }

    #[test]
    fn get_dm_messages_query_holds_limit_and_before_values() {
        let before = chrono::Utc::now();
        let query = GetDmMessagesQuery {
            limit: Some(250),
            before: Some(before),
        };

        assert_eq!(query.limit, Some(250));
        assert_eq!(query.before, Some(before));
        assert_eq!(query.limit.unwrap_or(50).clamp(1, 100), 100);

        let defaulted = GetDmMessagesQuery {
            limit: None,
            before: None,
        };
        assert_eq!(defaulted.limit.unwrap_or(50).clamp(1, 100), 50);
    }

    #[actix_web::test]
    async fn config_registers_dm_routes() {
        let app = actix_web::test::init_service(App::new().configure(config)).await;

        let conversation_id = Uuid::new_v4();
        let message_id = Uuid::new_v4();
        for (method, path) in [
            ("POST", "/dm/conversations".to_string()),
            ("GET", "/dm/conversations".to_string()),
            (
                "GET",
                format!("/dm/conversations/{conversation_id}/messages"),
            ),
            (
                "POST",
                format!("/dm/conversations/{conversation_id}/messages"),
            ),
            ("PUT", format!("/dm/messages/{message_id}")),
            ("DELETE", format!("/dm/messages/{message_id}")),
            ("POST", format!("/dm/messages/{message_id}/reactions")),
            ("DELETE", format!("/dm/messages/{message_id}/reactions")),
        ] {
            let method = actix_web::http::Method::from_bytes(method.as_bytes()).unwrap();
            let req = actix_web::test::TestRequest::with_uri(&path)
                .method(method)
                .to_request();
            let response = actix_web::test::call_service(&app, req).await;
            assert_ne!(response.status(), StatusCode::NOT_FOUND);
        }
    }
}
