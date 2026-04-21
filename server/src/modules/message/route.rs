use actix::Addr;
use actix_web::{web, HttpResponse, Responder};
use mongodb::Database;
use sqlx::Error;
use sqlx::PgPool;
use utoipa::{IntoParams, ToSchema};
use uuid::Uuid;
use validator::Validate;

use super::service::{MessageService, ServiceError};
use crate::models::message::{CreateMessage, MessageResponse, UpdateMessage};
use crate::modules::auth::middleware::AuthenticatedUser;
use crate::websocket::server::{ClientMessage, WsServer};
use crate::websocket::session::OutgoingMessage;

#[utoipa::path(
    post,
    path = "/api/channels/{channel_id}/messages",
    tag = "Messages",
    params(
        ("channel_id" = Uuid, Path, description = "L'ID du salon où envoyer le message")
    ),
    request_body = SendMessageRequest,
    responses(
        (status = 201, description = "Message envoyé", body = MessageResponse),
        (status = 400, description = "Erreur de validation")
    ),
    security(("jwt" = []))
)]
pub async fn send_message(
    pg_pool: web::Data<PgPool>,
    mongo_db: web::Data<Database>,
    ws_server: web::Data<Addr<WsServer>>,
    user: AuthenticatedUser,
    path: web::Path<Uuid>,
    data: web::Json<SendMessageRequest>,
) -> impl Responder {
    let channel_id = path.into_inner();
    let service = MessageService::new(mongo_db.get_ref(), pg_pool.get_ref());
    send_message_with_service(
        &service,
        ws_server.get_ref(),
        user.user_id,
        channel_id,
        &data,
    )
    .await
}

#[utoipa::path(
    get,
    path = "/api/channels/{channel_id}/messages",
    tag = "Messages",
    params(
        ("channel_id" = Uuid, Path, description = "L'ID du salon"),
        GetMessagesQueryParams // <-- On passe les paramètres de recherche ici !
    ),
    responses(
        (status = 200, description = "Historique des messages récupéré", body = [MessageResponse])
    ),
    security(("jwt" = []))
)]
pub async fn get_messages(
    pg_pool: web::Data<PgPool>,
    mongo_db: web::Data<Database>,
    user: AuthenticatedUser,
    path: web::Path<Uuid>,
    query: web::Query<GetMessagesQueryParams>,
) -> impl Responder {
    let channel_id = path.into_inner();
    let service = MessageService::new(mongo_db.get_ref(), pg_pool.get_ref());
    get_messages_with_service(&service, user.user_id, channel_id, &query).await
}

#[utoipa::path(
    put,
    path = "/api/messages/{id}",
    tag = "Messages",
    params(
        ("id" = Uuid, Path, description = "L'ID du message à modifier")
    ),
    request_body = UpdateMessageRequest,
    responses(
        (status = 200, description = "Message modifié", body = MessageResponse),
        (status = 403, description = "Interdit (Ce n'est pas votre message)")
    ),
    security(("jwt" = []))
)]
pub async fn update_message(
    pg_pool: web::Data<PgPool>,
    mongo_db: web::Data<Database>,
    user: AuthenticatedUser,
    ws_server: web::Data<Addr<WsServer>>,
    path: web::Path<Uuid>,
    data: web::Json<UpdateMessageRequest>,
) -> impl Responder {
    log::info!("update_message route called");
    log::info!("User: {}", user.user_id);
    log::info!("Message ID: {}", path);
    log::info!("Data: {:?}", data);

    let message_id = path.into_inner();
    let service = MessageService::new(mongo_db.get_ref(), pg_pool.get_ref());

    log::info!("Calling update_message_with_service");

    update_message_with_service(
        &service,
        ws_server.get_ref(),
        user.user_id,
        message_id,
        &data,
    )
    .await
}

#[utoipa::path(
    delete,
    path = "/api/messages/{id}",
    tag = "Messages",
    params(
        ("id" = Uuid, Path, description = "L'ID du message à supprimer")
    ),
    responses(
        (status = 204, description = "Message supprimé"),
        (status = 403, description = "Interdit (Pas les droits)")
    ),
    security(("jwt" = []))
)]
pub async fn delete_message(
    pg_pool: web::Data<PgPool>,
    mongo_db: web::Data<Database>,
    ws_server: web::Data<Addr<WsServer>>,
    user: AuthenticatedUser,
    path: web::Path<Uuid>,
) -> impl Responder {
    let message_id = path.into_inner();
    let service = MessageService::new(mongo_db.get_ref(), pg_pool.get_ref());
    delete_message_with_service(&service, ws_server.get_ref(), user.user_id, message_id).await
}

#[derive(Debug, serde::Deserialize, Validate, ToSchema)] // <-- Ajout ToSchema
pub struct SendMessageRequest {
    #[validate(length(min = 1, max = 2000))]
    #[schema(example = "Salut tout le monde !")]
    pub content: String,
}

#[derive(Debug, serde::Deserialize, Validate, ToSchema)] // <-- Ajout ToSchema
pub struct UpdateMessageRequest {
    #[validate(length(min = 1, max = 2000))]
    #[schema(example = "J'ai corrigé ma faute de frappe")]
    pub content: String,
}

#[derive(Debug, serde::Deserialize, ToSchema)]
pub struct ReactionRequest {
    #[schema(example = "😺")]
    pub emoji: String,
}

#[derive(Debug, serde::Deserialize, IntoParams)] // <-- Ajout de IntoParams pour les query
pub struct GetMessagesQueryParams {
    pub limit: Option<i64>,
    pub before: Option<chrono::DateTime<chrono::Utc>>,
}

fn validate_send_message_request(data: &SendMessageRequest) -> Result<(), String> {
    data.validate().map_err(|e| e.to_string())
}

fn validate_update_message_request(data: &UpdateMessageRequest) -> Result<(), String> {
    data.validate().map_err(|e| e.to_string())
}

fn build_create_message_payload(channel_id: Uuid, data: &SendMessageRequest) -> CreateMessage {
    CreateMessage {
        content: data.content.trim().to_string(),
        channel_id,
    }
}

fn build_update_message_payload(data: &UpdateMessageRequest) -> UpdateMessage {
    UpdateMessage {
        content: data.content.trim().to_string(),
    }
}

fn normalize_limit(limit: Option<i64>) -> i64 {
    limit.unwrap_or(50).clamp(1, 100)
}

fn bad_request_response(error_message: String) -> HttpResponse {
    HttpResponse::BadRequest().json(serde_json::json!({
        "error": error_message
    }))
}

fn created_message_response(message: MessageResponse) -> HttpResponse {
    HttpResponse::Created().json(message)
}

fn ok_message_response(message: MessageResponse) -> HttpResponse {
    HttpResponse::Ok().json(message)
}

fn ok_messages_response(messages: Vec<MessageResponse>) -> HttpResponse {
    HttpResponse::Ok().json(messages)
}

fn no_content_response() -> HttpResponse {
    HttpResponse::NoContent().finish()
}
fn build_new_message_event(message: &MessageResponse) -> ClientMessage {
    ClientMessage::BroadcastNewMessage {
        server_id: message.server_id,
        channel_id: message.channel_id,
        message_id: message.message_id,
        user_id: message.user_id,
        username: message.username.clone(),
        content: message.content.clone(),
        created_at: message.created_at.to_rfc3339(),
    }
}

fn build_deleted_message_event(
    server_id: Uuid,
    channel_id: Uuid,
    message_id: Uuid,
) -> ClientMessage {
    ClientMessage::BroadcastMessageDeleted {
        server_id,
        channel_id,
        message_id,
    }
}

fn build_reaction_event(
    added: bool,
    channel_id: Uuid,
    message_id: Uuid,
    user_id: Uuid,
    emoji: String,
) -> ClientMessage {
    if added {
        ClientMessage::BroadcastMessageReactionAdded {
            channel_id,
            message_id,
            user_id,
            emoji,
        }
    } else {
        ClientMessage::BroadcastMessageReactionRemoved {
            channel_id,
            message_id,
            user_id,
            emoji,
        }
    }
}

async fn send_message_with_service(
    service: &MessageService,
    ws_server: &Addr<WsServer>,
    user_id: Uuid,
    channel_id: Uuid,
    data: &SendMessageRequest,
) -> HttpResponse {
    if let Err(error_message) = validate_send_message_request(data) {
        return bad_request_response(error_message);
    }

    let payload = build_create_message_payload(channel_id, data);

    match service.send_message(user_id, payload).await {
        Ok(message) => {
            ws_server.do_send(build_new_message_event(&message));
            created_message_response(message)
        }
        Err(e) => handle_service_error(e),
    }
}

async fn get_messages_with_service(
    service: &MessageService,
    user_id: Uuid,
    channel_id: Uuid,
    query: &GetMessagesQueryParams,
) -> HttpResponse {
    let limit = normalize_limit(query.limit);

    match service
        .get_messages(user_id, channel_id, Some(limit), query.before)
        .await
    {
        Ok(messages) => ok_messages_response(messages),
        Err(e) => handle_service_error(e),
    }
}

fn build_updated_message_event(message: &MessageResponse) -> ClientMessage {
    ClientMessage::BroadcastMessageUpdated {
        server_id: message.server_id,
        channel_id: message.channel_id,
        message_id: message.message_id,
        content: message.content.clone(),
        updated_at: message
            .updated_at
            .unwrap_or(message.created_at)
            .to_rfc3339()
            .parse()
            .unwrap(),
    }
}
async fn update_message_with_service(
    service: &MessageService,
    ws_server: &Addr<WsServer>,
    user_id: Uuid,
    message_id: Uuid,
    data: &UpdateMessageRequest,
) -> HttpResponse {
    log::info!("update_message_with_service START");
    log::info!("user_id: {}", user_id);
    log::info!("message_id: {}", message_id);
    log::info!("data.content: {}", data.content);

    log::info!("About to validate");

    if let Err(error_message) = validate_update_message_request(data) {
        log::error!("Validation failed: {} !!", error_message);
        return bad_request_response(error_message);
    }
    log::info!("Validation passed");
    log::info!("About to build payload");

    let payload = build_update_message_payload(data);
    log::info!("Payload built");
    log::info!("About to call service.update_message");

    match service.update_message(user_id, message_id, payload).await {
        Ok(message) => {
            log::info!("Service returned success");
            ws_server.do_send(build_updated_message_event(&message));
            ok_message_response(message)
        }
        Err(e) => {
            log::error!("Service error: {:?}", e);
            handle_service_error(e)
        }
    }
}

async fn delete_message_with_service(
    service: &MessageService,
    ws_server: &Addr<WsServer>,
    user_id: Uuid,
    message_id: Uuid,
) -> HttpResponse {
    match service.delete_message(user_id, message_id).await {
        Ok((server_id, channel_id, message_id)) => {
            ws_server.do_send(build_deleted_message_event(
                server_id, channel_id, message_id,
            ));
            no_content_response()
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
    service: &MessageService,
    ws_server: &Addr<WsServer>,
    user_id: Uuid,
    message_id: Uuid,
    data: &ReactionRequest,
) -> HttpResponse {
    let emoji = match validate_reaction_request(data) {
        Ok(emoji) => emoji,
        Err(error_message) => return bad_request_response(error_message),
    };

    match service
        .add_reaction(user_id, message_id, emoji.clone())
        .await
    {
        Ok((_server_id, channel_id, message_id)) => {
            ws_server.do_send(build_reaction_event(
                true, channel_id, message_id, user_id, emoji,
            ));
            no_content_response()
        }
        Err(e) => handle_service_error(e),
    }
}

async fn remove_reaction_with_service(
    service: &MessageService,
    ws_server: &Addr<WsServer>,
    user_id: Uuid,
    message_id: Uuid,
    data: &ReactionRequest,
) -> HttpResponse {
    let emoji = match validate_reaction_request(data) {
        Ok(emoji) => emoji,
        Err(error_message) => return bad_request_response(error_message),
    };

    match service
        .remove_reaction(user_id, message_id, emoji.clone())
        .await
    {
        Ok((_server_id, channel_id, message_id)) => {
            ws_server.do_send(build_reaction_event(
                false, channel_id, message_id, user_id, emoji,
            ));
            no_content_response()
        }
        Err(e) => handle_service_error(e),
    }
}

pub async fn add_reaction(
    pg_pool: web::Data<PgPool>,
    mongo_db: web::Data<Database>,
    ws_server: web::Data<Addr<WsServer>>,
    user: AuthenticatedUser,
    path: web::Path<Uuid>,
    data: web::Json<ReactionRequest>,
) -> impl Responder {
    let message_id = path.into_inner();
    let service = MessageService::new(mongo_db.get_ref(), pg_pool.get_ref());
    add_reaction_with_service(
        &service,
        ws_server.get_ref(),
        user.user_id,
        message_id,
        &data,
    )
    .await
}

pub async fn remove_reaction(
    pg_pool: web::Data<PgPool>,
    mongo_db: web::Data<Database>,
    ws_server: web::Data<Addr<WsServer>>,
    user: AuthenticatedUser,
    path: web::Path<Uuid>,
    data: web::Json<ReactionRequest>,
) -> impl Responder {
    let message_id = path.into_inner();
    let service = MessageService::new(mongo_db.get_ref(), pg_pool.get_ref());
    remove_reaction_with_service(
        &service,
        ws_server.get_ref(),
        user.user_id,
        message_id,
        &data,
    )
    .await
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
            .route("/{id}", web::delete().to(delete_message))
            .route("/{id}/reactions", web::post().to(add_reaction))
            .route("/{id}/reactions", web::delete().to(remove_reaction)),
    );
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::{body, http::StatusCode, test, App};
    use chrono::{TimeZone, Utc};
    use serde_json::Value;

    fn uuid_str() -> String {
        Uuid::new_v4().to_string()
    }

    fn sample_response() -> MessageResponse {
        MessageResponse {
            message_id: Uuid::new_v4(),
            content: "hello".to_string(),
            user_id: Uuid::new_v4(),
            username: "tester".to_string(),
            channel_id: Uuid::new_v4(),
            server_id: Uuid::new_v4(),
            created_at: Utc.with_ymd_and_hms(2026, 3, 1, 10, 30, 0).unwrap(),
            updated_at: None,
            is_edited: false,
            is_deleted: false,
        }
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
    async fn test_send_message_request_validation_boundaries() {
        let min_ok = SendMessageRequest {
            content: "a".to_string(),
        };
        assert!(min_ok.validate().is_ok());

        let max_ok = SendMessageRequest {
            content: "a".repeat(2000),
        };
        assert!(max_ok.validate().is_ok());
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

    #[test]
    async fn test_update_message_request_validation_boundaries() {
        let min_ok = UpdateMessageRequest {
            content: "a".to_string(),
        };
        assert!(min_ok.validate().is_ok());

        let max_ok = UpdateMessageRequest {
            content: "a".repeat(2000),
        };
        assert!(max_ok.validate().is_ok());
    }

    #[test]
    async fn test_validate_send_message_request_returns_err_string() {
        let bad = SendMessageRequest {
            content: "".to_string(),
        };

        let result = validate_send_message_request(&bad);

        assert!(result.is_err());
        assert!(!result.unwrap_err().is_empty());
    }

    #[test]
    async fn test_validate_send_message_request_returns_ok() {
        let ok = SendMessageRequest {
            content: "hello".to_string(),
        };

        assert!(validate_send_message_request(&ok).is_ok());
    }

    #[test]
    async fn test_validate_update_message_request_returns_err_string() {
        let bad = UpdateMessageRequest {
            content: "".to_string(),
        };

        let result = validate_update_message_request(&bad);

        assert!(result.is_err());
        assert!(!result.unwrap_err().is_empty());
    }

    #[test]
    async fn test_validate_update_message_request_returns_ok() {
        let ok = UpdateMessageRequest {
            content: "hello".to_string(),
        };

        assert!(validate_update_message_request(&ok).is_ok());
    }

    #[test]
    async fn test_build_create_message_payload_trims_content() {
        let channel_id = Uuid::new_v4();
        let req = SendMessageRequest {
            content: "  hello world  ".to_string(),
        };

        let payload = build_create_message_payload(channel_id, &req);

        assert_eq!(payload.channel_id, channel_id);
        assert_eq!(payload.content, "hello world");
    }

    #[test]
    async fn test_build_create_message_payload_keeps_inner_spaces() {
        let channel_id = Uuid::new_v4();
        let req = SendMessageRequest {
            content: "  hello   world  ".to_string(),
        };

        let payload = build_create_message_payload(channel_id, &req);

        assert_eq!(payload.content, "hello   world");
    }

    #[test]
    async fn test_build_create_message_payload_keeps_already_trimmed_content() {
        let channel_id = Uuid::new_v4();
        let req = SendMessageRequest {
            content: "hello".to_string(),
        };

        let payload = build_create_message_payload(channel_id, &req);

        assert_eq!(payload.channel_id, channel_id);
        assert_eq!(payload.content, "hello");
    }

    #[test]
    async fn test_build_create_message_payload_trims_only_spaces_to_empty() {
        let channel_id = Uuid::new_v4();
        let req = SendMessageRequest {
            content: "   ".to_string(),
        };

        let payload = build_create_message_payload(channel_id, &req);

        assert_eq!(payload.channel_id, channel_id);
        assert_eq!(payload.content, "");
    }

    #[test]
    async fn test_build_update_message_payload_trims_content() {
        let req = UpdateMessageRequest {
            content: "  updated content  ".to_string(),
        };

        let payload = build_update_message_payload(&req);

        assert_eq!(payload.content, "updated content");
    }

    #[test]
    async fn test_build_update_message_payload_keeps_inner_spaces() {
        let req = UpdateMessageRequest {
            content: "  updated   content  ".to_string(),
        };

        let payload = build_update_message_payload(&req);

        assert_eq!(payload.content, "updated   content");
    }

    #[test]
    async fn test_build_update_message_payload_keeps_already_trimmed_content() {
        let req = UpdateMessageRequest {
            content: "hello".to_string(),
        };

        let payload = build_update_message_payload(&req);

        assert_eq!(payload.content, "hello");
    }

    #[test]
    async fn test_build_update_message_payload_trims_only_spaces_to_empty() {
        let req = UpdateMessageRequest {
            content: "   ".to_string(),
        };

        let payload = build_update_message_payload(&req);

        assert_eq!(payload.content, "");
    }

    #[test]
    async fn test_get_messages_query_params_can_hold_values() {
        let q = GetMessagesQueryParams {
            limit: Some(25),
            before: None,
        };

        assert_eq!(q.limit, Some(25));
        assert!(q.before.is_none());
    }

    #[test]
    async fn test_get_messages_query_params_can_hold_before_value() {
        let before = Utc.with_ymd_and_hms(2026, 3, 1, 10, 30, 0).unwrap();
        let q = GetMessagesQueryParams {
            limit: Some(25),
            before: Some(before),
        };

        assert_eq!(q.limit, Some(25));
        assert_eq!(q.before, Some(before));
    }

    #[test]
    async fn test_normalize_limit_uses_default_when_none() {
        assert_eq!(normalize_limit(None), 50);
    }

    #[test]
    async fn test_normalize_limit_clamps_low_values() {
        assert_eq!(normalize_limit(Some(0)), 1);
        assert_eq!(normalize_limit(Some(-1)), 1);
        assert_eq!(normalize_limit(Some(-999)), 1);
    }

    #[test]
    async fn test_normalize_limit_keeps_valid_values() {
        assert_eq!(normalize_limit(Some(1)), 1);
        assert_eq!(normalize_limit(Some(25)), 25);
        assert_eq!(normalize_limit(Some(50)), 50);
        assert_eq!(normalize_limit(Some(100)), 100);
    }

    #[test]
    async fn test_normalize_limit_clamps_high_values() {
        assert_eq!(normalize_limit(Some(101)), 100);
        assert_eq!(normalize_limit(Some(999)), 100);
    }

    #[test]
    async fn test_normalize_limit_with_i64_min() {
        assert_eq!(normalize_limit(Some(i64::MIN)), 1);
    }

    #[test]
    async fn test_normalize_limit_with_i64_max() {
        assert_eq!(normalize_limit(Some(i64::MAX)), 100);
    }

    #[actix_web::test]
    async fn test_bad_request_response_status_and_body() {
        let resp = bad_request_response("bad input".to_string());
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);

        let bytes = body::to_bytes(resp.into_body()).await.unwrap();
        let v: Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(v["error"], "bad input");
    }

    #[actix_web::test]
    async fn test_created_message_response_status_and_body() {
        let message = sample_response();
        let expected_message_id = message.message_id;

        let resp = created_message_response(message);
        assert_eq!(resp.status(), StatusCode::CREATED);

        let bytes = body::to_bytes(resp.into_body()).await.unwrap();
        let v: Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(v["message_id"], expected_message_id.to_string());
    }

    #[actix_web::test]
    async fn test_ok_message_response_status_and_body() {
        let message = sample_response();
        let expected_message_id = message.message_id;

        let resp = ok_message_response(message);
        assert_eq!(resp.status(), StatusCode::OK);

        let bytes = body::to_bytes(resp.into_body()).await.unwrap();
        let v: Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(v["message_id"], expected_message_id.to_string());
    }

    #[actix_web::test]
    async fn test_ok_messages_response_status_and_body() {
        let message = sample_response();
        let expected_message_id = message.message_id;

        let resp = ok_messages_response(vec![message]);
        assert_eq!(resp.status(), StatusCode::OK);

        let bytes = body::to_bytes(resp.into_body()).await.unwrap();
        let v: Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(v[0]["message_id"], expected_message_id.to_string());
    }

    #[actix_web::test]
    async fn test_no_content_response_status() {
        let resp = no_content_response();
        assert_eq!(resp.status(), StatusCode::NO_CONTENT);
    }

    #[test]
    async fn test_build_new_message_event() {
        let message = sample_response();

        match build_new_message_event(&message) {
            ClientMessage::BroadcastNewMessage {
                server_id,
                channel_id,
                message_id,
                user_id,
                username,
                content,
                created_at,
            } => {
                assert_eq!(server_id, message.server_id);
                assert_eq!(channel_id, message.channel_id);
                assert_eq!(message_id, message.message_id);
                assert_eq!(user_id, message.user_id);
                assert_eq!(username, message.username);
                assert_eq!(content, message.content);
                assert_eq!(created_at, message.created_at.to_rfc3339());
            }
            _ => panic!("Expected BroadcastNewMessage"),
        }
    }

    #[test]
    async fn test_build_deleted_message_event() {
        let server_id = Uuid::new_v4();
        let channel_id = Uuid::new_v4();
        let message_id = Uuid::new_v4();

        match build_deleted_message_event(server_id, channel_id, message_id) {
            ClientMessage::BroadcastMessageDeleted {
                server_id: s,
                channel_id: c,
                message_id: m,
            } => {
                assert_eq!(s, server_id);
                assert_eq!(c, channel_id);
                assert_eq!(m, message_id);
            }
            _ => panic!("Expected BroadcastMessageDeleted"),
        }
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

        let resp = handle_service_error(ServiceError::Database(Error::RowNotFound));
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
    async fn test_handle_service_error_json_content_type() {
        let resp = handle_service_error(ServiceError::NotFound("x".to_string()));
        let content_type = resp
            .headers()
            .get(actix_web::http::header::CONTENT_TYPE)
            .unwrap()
            .to_str()
            .unwrap();

        assert!(content_type.contains("application/json"));
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
    async fn test_channels_messages_patch_not_allowed() {
        let app = test::init_service(App::new().configure(config)).await;

        let req = test::TestRequest::patch()
            .uri(&format!("/channels/{}/messages", uuid_str()))
            .to_request();

        let resp = test::call_service(&app, req).await;

        assert!(
            resp.status() == StatusCode::NOT_FOUND
                || resp.status() == StatusCode::METHOD_NOT_ALLOWED
        );
    }

    #[actix_web::test]
    async fn test_messages_post_not_allowed() {
        let app = test::init_service(App::new().configure(config)).await;

        let req = test::TestRequest::post()
            .uri(&format!("/messages/{}", uuid_str()))
            .set_json(serde_json::json!({ "content": "hello" }))
            .to_request();

        let resp = test::call_service(&app, req).await;

        assert!(
            resp.status() == StatusCode::NOT_FOUND
                || resp.status() == StatusCode::METHOD_NOT_ALLOWED
        );
    }

    #[actix_web::test]
    async fn test_messages_get_not_allowed() {
        let app = test::init_service(App::new().configure(config)).await;

        let req = test::TestRequest::get()
            .uri(&format!("/messages/{}", uuid_str()))
            .to_request();

        let resp = test::call_service(&app, req).await;

        assert!(
            resp.status() == StatusCode::NOT_FOUND
                || resp.status() == StatusCode::METHOD_NOT_ALLOWED
        );
    }

    #[actix_web::test]
    async fn test_channels_messages_delete_not_allowed() {
        let app = test::init_service(App::new().configure(config)).await;

        let req = test::TestRequest::delete()
            .uri(&format!("/channels/{}/messages", uuid_str()))
            .to_request();

        let resp = test::call_service(&app, req).await;

        assert!(
            resp.status() == StatusCode::NOT_FOUND
                || resp.status() == StatusCode::METHOD_NOT_ALLOWED
        );
    }

    #[actix_web::test]
    async fn test_channels_messages_put_not_allowed() {
        let app = test::init_service(App::new().configure(config)).await;

        let req = test::TestRequest::put()
            .uri(&format!("/channels/{}/messages", uuid_str()))
            .set_json(serde_json::json!({ "content": "hello" }))
            .to_request();

        let resp = test::call_service(&app, req).await;

        assert!(
            resp.status() == StatusCode::NOT_FOUND
                || resp.status() == StatusCode::METHOD_NOT_ALLOWED
        );
    }

    #[actix_web::test]
    async fn test_messages_patch_not_allowed() {
        let app = test::init_service(App::new().configure(config)).await;

        let req = test::TestRequest::patch()
            .uri(&format!("/messages/{}", uuid_str()))
            .to_request();

        let resp = test::call_service(&app, req).await;

        assert!(
            resp.status() == StatusCode::NOT_FOUND
                || resp.status() == StatusCode::METHOD_NOT_ALLOWED
        );
    }

    #[actix_web::test]
    async fn test_channels_messages_options_not_allowed_or_not_found() {
        let app = test::init_service(App::new().configure(config)).await;

        let req = test::TestRequest::default()
            .method(actix_web::http::Method::OPTIONS)
            .uri(&format!("/channels/{}/messages", uuid_str()))
            .to_request();

        let resp = test::call_service(&app, req).await;

        assert!(
            resp.status() == StatusCode::NOT_FOUND
                || resp.status() == StatusCode::METHOD_NOT_ALLOWED
                || resp.status() == StatusCode::OK
        );
    }

    #[actix_web::test]
    async fn test_messages_options_not_allowed_or_not_found() {
        let app = test::init_service(App::new().configure(config)).await;

        let req = test::TestRequest::default()
            .method(actix_web::http::Method::OPTIONS)
            .uri(&format!("/messages/{}", uuid_str()))
            .to_request();

        let resp = test::call_service(&app, req).await;

        assert!(
            resp.status() == StatusCode::NOT_FOUND
                || resp.status() == StatusCode::METHOD_NOT_ALLOWED
                || resp.status() == StatusCode::OK
        );
    }

    #[actix_web::test]
    async fn test_channels_messages_invalid_uuid_returns_internal_server_error() {
        let app = test::init_service(App::new().configure(config)).await;

        let req = test::TestRequest::get()
            .uri("/channels/not-a-uuid/messages")
            .to_request();

        let resp = test::call_service(&app, req).await;

        assert_eq!(resp.status(), StatusCode::INTERNAL_SERVER_ERROR);
    }

    #[actix_web::test]
    async fn test_messages_invalid_uuid_returns_internal_server_error() {
        let app = test::init_service(App::new().configure(config)).await;

        let req = test::TestRequest::delete()
            .uri("/messages/not-a-uuid")
            .to_request();

        let resp = test::call_service(&app, req).await;

        assert_eq!(resp.status(), StatusCode::INTERNAL_SERVER_ERROR);
    }

    #[actix_web::test]
    async fn test_channels_messages_missing_channel_id_returns_not_found() {
        let app = test::init_service(App::new().configure(config)).await;

        let req = test::TestRequest::get()
            .uri("/channels/messages")
            .to_request();

        let resp = test::call_service(&app, req).await;

        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    }

    #[actix_web::test]
    async fn test_messages_missing_id_returns_not_found() {
        let app = test::init_service(App::new().configure(config)).await;

        let req = test::TestRequest::put()
            .uri("/messages")
            .set_json(serde_json::json!({ "content": "hello" }))
            .to_request();

        let resp = test::call_service(&app, req).await;

        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    }

    #[actix_web::test]
    async fn test_unrelated_path_is_404() {
        let app = test::init_service(App::new().configure(config)).await;

        let req = test::TestRequest::get().uri("/nope").to_request();
        let resp = test::call_service(&app, req).await;

        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    }

    #[actix_web::test]
    async fn test_channels_scope_root_is_404() {
        let app = test::init_service(App::new().configure(config)).await;

        let req = test::TestRequest::get().uri("/channels").to_request();
        let resp = test::call_service(&app, req).await;

        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    }

    #[actix_web::test]
    async fn test_messages_scope_root_is_404() {
        let app = test::init_service(App::new().configure(config)).await;

        let req = test::TestRequest::get().uri("/messages").to_request();
        let resp = test::call_service(&app, req).await;

        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    }

    #[actix_web::test]
    async fn test_channels_messages_trailing_slash_not_found() {
        let app = test::init_service(App::new().configure(config)).await;

        let req = test::TestRequest::get()
            .uri(&format!("/channels/{}/messages/", uuid_str()))
            .to_request();

        let resp = test::call_service(&app, req).await;

        assert!(
            resp.status() == StatusCode::NOT_FOUND
                || resp.status() == StatusCode::METHOD_NOT_ALLOWED
                || resp.status() == StatusCode::INTERNAL_SERVER_ERROR
        );
    }

    #[actix_web::test]
    async fn test_messages_trailing_slash_not_found() {
        let app = test::init_service(App::new().configure(config)).await;

        let req = test::TestRequest::delete()
            .uri(&format!("/messages/{}/", uuid_str()))
            .to_request();

        let resp = test::call_service(&app, req).await;

        assert!(
            resp.status() == StatusCode::NOT_FOUND
                || resp.status() == StatusCode::METHOD_NOT_ALLOWED
                || resp.status() == StatusCode::INTERNAL_SERVER_ERROR
        );
    }
}
