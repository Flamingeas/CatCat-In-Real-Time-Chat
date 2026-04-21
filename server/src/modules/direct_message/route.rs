use actix::Addr;
use actix_web::{HttpResponse, Responder, web};
use chrono::DateTime;
use mongodb::Database;
use sqlx::PgPool;
use utoipa::{IntoParams, ToSchema};
use uuid::Uuid;
use validator::Validate;

use super::service::{DirectMessageService, ServiceError};
use crate::modules::auth::middleware::AuthenticatedUser;
use crate::modules::message::route::ReactionRequest;
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

fn bad_request(msg: String) -> HttpResponse {
    HttpResponse::BadRequest().json(serde_json::json!({ "error": msg }))
}

async fn start_conversation_with_service(
    service: &DirectMessageService<'_>,
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
    service: &DirectMessageService<'_>,
    user_id: Uuid,
) -> HttpResponse {
    match service.list_conversations(user_id).await {
        Ok(convs) => HttpResponse::Ok().json(convs),
        Err(e) => handle_service_error(e),
    }
}

async fn get_messages_with_service(
    service: &DirectMessageService<'_>,
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
    service: &DirectMessageService<'_>,
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
    service: &DirectMessageService<'_>,
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
    service: &DirectMessageService<'_>,
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
    service: &DirectMessageService<'_>,
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
    service: &DirectMessageService<'_>,
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
