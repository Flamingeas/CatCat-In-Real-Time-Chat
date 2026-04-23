use actix::Addr;
use actix_web::{web, HttpResponse, Responder};
use serde::Deserialize;
use serde_json::json;
use utoipa::IntoParams;
use validator::Validate;

use crate::models::server::{CreateServer, JoinServerRequest, ServerResponse, UpdateServer};
use crate::models::server_member::UpdateServerMemberRole; // Assurez-vous d'avoir ToSchema sur cette struct !
use crate::modules::auth::AuthenticatedUser;
use crate::modules::server::service::{JoinServerError, LeaveServerError, ServerService};
use crate::utils::errors::{json_error, json_message};
use crate::websocket::server::{ServerEvent, WsServer};
use uuid::Uuid;

#[utoipa::path(
    post,
    path = "/api/servers",
    tag = "Servers",
    request_body = CreateServer,
    responses(
        (status = 201, description = "Serveur créé avec succès", body = ServerResponse),
        (status = 400, description = "Erreur de validation")
    ),
    security(("jwt" = []))
)]
pub async fn create_server(
    user: AuthenticatedUser,
    service: web::Data<ServerService>,
    payload: web::Json<CreateServer>,
) -> impl Responder {
    if let Err(e) = payload.validate() {
        return json_error(actix_web::http::StatusCode::BAD_REQUEST, "VALIDATION_ERROR", e.to_string());
    }

    match service.create_server(user.user_id, &payload.name).await {
        Ok(server) => HttpResponse::Created().json(ServerResponse::from(server)),
        Err(e) => json_error(actix_web::http::StatusCode::BAD_REQUEST, "SERVER_CREATE_FAILED", e),
    }
}

#[utoipa::path(
    get,
    path = "/api/servers",
    tag = "Servers",
    responses(
        (status = 200, description = "Liste des serveurs rejoints", body = [ServerResponse])
    ),
    security(("jwt" = []))
)]
pub async fn list_servers(
    user: AuthenticatedUser,
    service: web::Data<ServerService>,
) -> impl Responder {
    match service.list_my_servers(user.user_id).await {
        Ok(servers) => {
            let resp: Vec<ServerResponse> = servers.into_iter().map(ServerResponse::from).collect();
            HttpResponse::Ok().json(resp)
        }
        Err(e) => json_error(actix_web::http::StatusCode::BAD_REQUEST, "SERVERS_LIST_FAILED", e),
    }
}

#[utoipa::path(
    put,
    path = "/api/servers/{id}",
    tag = "Servers",
    params(
        ("id" = Uuid, Path, description = "L'ID du serveur à modifier")
    ),
    request_body = UpdateServer,
    responses(
        (status = 200, description = "Serveur mis à jour", body = ServerResponse),
        (status = 403, description = "Seul le propriétaire peut modifier le serveur")
    ),
    security(("jwt" = []))
)]
pub async fn update_server(
    user: AuthenticatedUser,
    service: web::Data<ServerService>,
    ws: web::Data<Addr<WsServer>>,
    path: web::Path<uuid::Uuid>,
    payload: web::Json<UpdateServer>,
) -> impl Responder {
    if let Err(e) = payload.validate() {
        return json_error(actix_web::http::StatusCode::BAD_REQUEST, "VALIDATION_ERROR", e.to_string());
    }

    let server_id = path.into_inner();

    match service
        .update_server(user.user_id, server_id, payload.into_inner())
        .await
    {
        Ok(server) => {
            ws.do_send(ServerEvent::ServerUpdated { server_id });
            HttpResponse::Ok().json(ServerResponse::from(server))
        }
        Err(e) if e == "Forbidden" => json_error(actix_web::http::StatusCode::FORBIDDEN, "PERMISSION_DENIED", "Forbidden"),
        Err(e) => json_error(actix_web::http::StatusCode::BAD_REQUEST, "SERVER_UPDATE_FAILED", e),
    }
}

#[utoipa::path(
    post,
    path = "/api/servers/join",
    tag = "Servers",
    request_body = JoinServerRequest,
    responses(
        (status = 200, description = "Serveur rejoint", body = ServerResponse),
        (status = 404, description = "Code d'invitation introuvable"),
        (status = 409, description = "Déjà membre de ce serveur")
    ),
    security(("jwt" = []))
)]
pub async fn join_server(
    user: AuthenticatedUser,
    service: web::Data<ServerService>,
    ws: web::Data<Addr<WsServer>>,
    payload: web::Json<JoinServerRequest>,
) -> impl Responder {
    if let Err(e) = payload.validate() {
        return json_error(actix_web::http::StatusCode::BAD_REQUEST, "VALIDATION_ERROR", e.to_string());
    }

    match service
        .join_by_invitation_code(user.user_id, &payload.invitation_code)
        .await
    {
        Ok(server) => {
            let server_id = server.id;
            let username = service
                .get_username(user.user_id)
                .await
                .unwrap_or_else(|_| "unknown".to_string());

            ws.do_send(ServerEvent::MemberJoined {
                server_id,
                user_id: user.user_id,
                username,
            });

            HttpResponse::Ok().json(ServerResponse::from(server))
        }
        Err(JoinServerError::InvalidCode) => json_error(actix_web::http::StatusCode::BAD_REQUEST, "INVALID_INVITATION_CODE", "Invalid invitation code."),
        Err(JoinServerError::NotFound) => json_error(actix_web::http::StatusCode::NOT_FOUND, "SERVER_NOT_FOUND", "Server not found."),
        Err(JoinServerError::AlreadyMember) => json_error(actix_web::http::StatusCode::CONFLICT, "ALREADY_SERVER_MEMBER", "Already a member."),
        Err(JoinServerError::Forbidden { expires_at }) => HttpResponse::Forbidden().json(json!({
            "code": "SERVER_JOIN_FORBIDDEN",
            "message": "You are banned from this server.",
            "expires_at": expires_at,
        })),
        Err(JoinServerError::Db) => json_error(actix_web::http::StatusCode::INTERNAL_SERVER_ERROR, "SERVER_JOIN_FAILED", "Unable to join server."),
    }
}

#[utoipa::path(
    delete,
    path = "/api/servers/{id}/leave",
    tag = "Servers",
    params(
        ("id" = Uuid, Path, description = "L'ID du serveur à quitter")
    ),
    responses(
        (status = 200, description = "Serveur quitté avec succès"),
        (status = 409, description = "Vous n'êtes pas/plus membre")
    ),
    security(("jwt" = []))
)]
pub async fn leave_server(
    user: AuthenticatedUser,
    service: web::Data<ServerService>,
    ws: web::Data<Addr<WsServer>>,
    path: web::Path<uuid::Uuid>,
) -> impl Responder {
    let server_id = path.into_inner();

    match service.leave_server(server_id, user.user_id).await {
        Ok(_) => {
            let username = service
                .get_username(user.user_id)
                .await
                .unwrap_or_else(|_| "unknown".to_string());

            ws.do_send(ServerEvent::MemberLeft {
                server_id,
                user_id: user.user_id,
                username,
            });

            json_message(actix_web::http::StatusCode::OK, "SERVER_LEFT", "Server left successfully")
        }
        Err(LeaveServerError::NotFound) => json_error(actix_web::http::StatusCode::NOT_FOUND, "SERVER_NOT_FOUND", "Server not found."),
        Err(LeaveServerError::AlreadyLeave) => json_error(actix_web::http::StatusCode::CONFLICT, "SERVER_MEMBER_NOT_FOUND", "Already left or member not found."),
        Err(LeaveServerError::Db) => json_error(actix_web::http::StatusCode::INTERNAL_SERVER_ERROR, "SERVER_LEAVE_FAILED", "Unable to leave server."),
    }
}

#[utoipa::path(
    get,
    path = "/api/servers/{id}/members",
    tag = "Server Members",
    params(
        ("id" = Uuid, Path, description = "L'ID du serveur")
    ),
    responses(
        (status = 200, description = "Liste des membres"), // Mettre la structure ServerMemberDetailedResponse ici si vous l'avez !
        (status = 403, description = "Pas membre du serveur")
    ),
    security(("jwt" = []))
)]
pub async fn list_members(
    user: AuthenticatedUser,
    service: web::Data<ServerService>,
    path: web::Path<uuid::Uuid>,
) -> impl Responder {
    let server_id = path.into_inner();

    match service.list_members(user.user_id, server_id).await {
        Ok(members) => HttpResponse::Ok().json(members),
        Err(e) if e == "Forbidden" => json_error(actix_web::http::StatusCode::FORBIDDEN, "PERMISSION_DENIED", "Forbidden"),
        Err(e) => json_error(actix_web::http::StatusCode::BAD_REQUEST, "MEMBERS_LIST_FAILED", e),
    }
}

#[derive(Debug, Deserialize, IntoParams)]
pub struct MemberPath {
    pub id: uuid::Uuid,
    pub user_id: uuid::Uuid,
}

#[utoipa::path(
    patch,
    path = "/api/servers/{id}/members/{user_id}/role",
    tag = "Server Members",
    params(MemberPath),
    request_body = UpdateServerMemberRole,
    responses(
        (status = 200, description = "Rôle mis à jour avec succès"),
        (status = 400, description = "Erreur de requête"),
        (status = 403, description = "Non autorisé")
    ),
    security(("jwt" = []))
)]
pub async fn set_member_role(
    user: AuthenticatedUser,
    service: web::Data<ServerService>,
    ws: web::Data<Addr<WsServer>>,
    path: web::Path<MemberPath>,
    payload: web::Json<UpdateServerMemberRole>,
) -> impl Responder {
    if payload.role.as_str() == "owner" {
        return json_error(actix_web::http::StatusCode::BAD_REQUEST, "USE_TRANSFER_OWNER_ENDPOINT", "Use /transfer-owner endpoint");
    }

    let server_id = path.id;
    let target_user_id = path.user_id;

    match service
        .set_role(
            user.user_id,
            server_id,
            target_user_id,
            payload.role.clone(),
        )
        .await
    {
        Ok(_) => {
            let username = service
                .get_username(target_user_id)
                .await
                .unwrap_or_else(|_| "unknown".to_string());
            ws.do_send(ServerEvent::MemberRoleUpdated {
                server_id,
                user_id: target_user_id,
                username,
                role: payload.role.as_str().to_string(),
            });
            json_message(actix_web::http::StatusCode::OK, "SERVER_MEMBER_ROLE_UPDATED", "Role updated")
        }
        Err(e) if e == "Forbidden" => json_error(actix_web::http::StatusCode::FORBIDDEN, "PERMISSION_DENIED", "Forbidden"),
        Err(e) => json_error(actix_web::http::StatusCode::BAD_REQUEST, "SERVER_MEMBER_ROLE_UPDATE_FAILED", e),
    }
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct TransferOwnerPayload {
    pub new_owner_id: uuid::Uuid,
}

#[utoipa::path(
    post,
    path = "/api/servers/{id}/transfer-owner",
    tag = "Servers",
    params(("id" = Uuid, Path, description = "L'ID du serveur")),
    request_body = TransferOwnerPayload,
    responses(
        (status = 200, description = "Propriétaire transféré", body = ServerResponse),
        (status = 403, description = "Non autorisé")
    ),
    security(("jwt" = []))
)]
pub async fn transfer_owner(
    user: AuthenticatedUser,
    service: web::Data<ServerService>,
    ws: web::Data<Addr<WsServer>>,
    path: web::Path<uuid::Uuid>,
    payload: web::Json<TransferOwnerPayload>,
) -> impl Responder {
    let server_id = path.into_inner();
    let old_owner_id = match service.get_server_owner_id(server_id).await {
        Ok(id) => id,
        Err(e) => return json_error(actix_web::http::StatusCode::BAD_REQUEST, "SERVER_OWNER_LOOKUP_FAILED", e),
    };

    match service
        .transfer_owner(user.user_id, server_id, payload.new_owner_id)
        .await
    {
        Ok(server) => {
            let new_owner_username = service
                .get_username(payload.new_owner_id)
                .await
                .unwrap_or_else(|_| "unknown".into());
            ws.do_send(ServerEvent::MemberRoleUpdated {
                server_id,
                user_id: payload.new_owner_id,
                username: new_owner_username,
                role: "owner".into(),
            });

            let old_owner_username = service
                .get_username(old_owner_id)
                .await
                .unwrap_or_else(|_| "unknown".into());
            ws.do_send(ServerEvent::MemberRoleUpdated {
                server_id,
                user_id: old_owner_id,
                username: old_owner_username,
                role: "member".into(),
            });

            HttpResponse::Ok().json(ServerResponse::from(server))
        }
        Err(e) => json_error(actix_web::http::StatusCode::FORBIDDEN, "SERVER_OWNER_TRANSFER_FAILED", e),
    }
}

#[utoipa::path(
    delete,
    path = "/api/servers/{id}/members/{user_id}",
    tag = "Server Members",
    params(MemberPath),
    responses(
        (status = 200, description = "Membre expulsé"),
        (status = 403, description = "Non autorisé")
    ),
    security(("jwt" = []))
)]
pub async fn kick_member(
    user: AuthenticatedUser,
    service: web::Data<ServerService>,
    ws: web::Data<Addr<WsServer>>,
    path: web::Path<MemberPath>,
) -> impl Responder {
    let server_id = path.id;
    let target_user_id = path.user_id;

    match service
        .kick_member(user.user_id, server_id, target_user_id)
        .await
    {
        Ok(_) => {
            let username = service
                .get_username(target_user_id)
                .await
                .unwrap_or_else(|_| "unknown".to_string());
            ws.do_send(ServerEvent::MemberKicked {
                server_id,
                user_id: target_user_id,
                username,
            });
            json_message(actix_web::http::StatusCode::OK, "SERVER_MEMBER_KICKED", "Member removed")
        }
        Err(e) if e == "Forbidden" => json_error(actix_web::http::StatusCode::FORBIDDEN, "PERMISSION_DENIED", "Forbidden"),
        Err(e) => json_error(actix_web::http::StatusCode::BAD_REQUEST, "SERVER_MEMBER_KICK_FAILED", e),
    }
}

#[utoipa::path(
    post,
    path = "/api/servers/{id}/bans/{user_id}",
    tag = "Member Ban",
    params(MemberPath),
    responses(
        (status = 200, description = "Membre banni"),
        (status = 403, description = "Non autorisé")
    ),
    security(("jwt" = []))
)]
pub async fn ban_member(
    user: AuthenticatedUser,
    service: web::Data<ServerService>,
    ws: web::Data<Addr<WsServer>>,
    path: web::Path<MemberPath>,
) -> impl Responder {
    let server_id = path.id;
    let target_user_id = path.user_id;

    match service
        .ban_member(user.user_id, server_id, target_user_id)
        .await
    {
        Ok(_) => {
            let username = service
                .get_username(target_user_id)
                .await
                .unwrap_or_else(|_| "unknown".to_string());

            ws.do_send(ServerEvent::MemberBanned {
                server_id,
                user_id: target_user_id,
                username,
            });

            json_message(actix_web::http::StatusCode::OK, "SERVER_MEMBER_BANNED", "Member banned")
        }
        Err(e) if e == "Forbidden" => json_error(actix_web::http::StatusCode::FORBIDDEN, "PERMISSION_DENIED", "Forbidden"),
        Err(e) => json_error(actix_web::http::StatusCode::BAD_REQUEST, "SERVER_MEMBER_BAN_FAILED", e),
    }
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct TemporaryBanPayload {
    pub duration_minutes: u32,
}
#[utoipa::path(
    post,
    path = "/api/servers/{id}/bans-temporary/{user_id}",
    tag = "Member Ban",
    params(MemberPath),
    request_body = TemporaryBanPayload,
    responses(
        (status = 200, description = "Membre banni temporairement"),
        (status = 403, description = "Non autorisé")
    ),
    security(("jwt" = []))
)]
pub async fn ban_temporary_member(
    user: AuthenticatedUser,
    service: web::Data<ServerService>,
    ws: web::Data<Addr<WsServer>>,
    path: web::Path<MemberPath>,
    payload: web::Json<TemporaryBanPayload>,
) -> impl Responder {
    let server_id = path.id;
    let target_user_id = path.user_id;
    if payload.duration_minutes == 0 {
        return json_error(actix_web::http::StatusCode::BAD_REQUEST, "INVALID_BAN_DURATION", "duration_minutes must be greater than 0");
    }
    match service
        .ban_temporary_member(
            user.user_id,
            server_id,
            target_user_id,
            payload.duration_minutes,
        )
        .await
    {
        Ok(expires_at) => {
            let username = service
                .get_username(target_user_id)
                .await
                .unwrap_or_else(|_| "unknown".to_string());

            ws.do_send(ServerEvent::MemberBannedTemporary {
                server_id,
                user_id: target_user_id,
                username,
                until: Some(expires_at),
            });

            HttpResponse::Ok().json(json!({
                "code": "SERVER_MEMBER_TEMPORARILY_BANNED",
                "message": "Member banned temporarily",
                "expires_at": expires_at,
            }))
        }
        Err(e) if e == "Forbidden" => json_error(actix_web::http::StatusCode::FORBIDDEN, "PERMISSION_DENIED", "Forbidden"),
        Err(e) => json_error(actix_web::http::StatusCode::BAD_REQUEST, "SERVER_MEMBER_TEMP_BAN_FAILED", e),
    }
}

#[utoipa::path(
    get,
    path = "/api/servers/{id}/bans",
    tag = "Server Bans",
    params(("id" = Uuid, Path, description = "L'ID du serveur")),
    responses(
        (status = 200, description = "Liste des membres bannis"),
        (status = 403, description = "Non autorisé")
    ),
    security(("jwt" = []))
)]
pub async fn ban_list(
    user: AuthenticatedUser,
    service: web::Data<ServerService>,
    path: web::Path<uuid::Uuid>,
) -> impl Responder {
    let server_id = path.into_inner();

    match service.list_bans(user.user_id, server_id).await {
        Ok(bans) => HttpResponse::Ok().json(bans),
        Err(e) if e == "Forbidden" => json_error(actix_web::http::StatusCode::FORBIDDEN, "PERMISSION_DENIED", "Forbidden"),
        Err(e) => json_error(actix_web::http::StatusCode::BAD_REQUEST, "SERVER_BANS_LIST_FAILED", e),
    }
}

#[utoipa::path(
    delete,
    path = "/api/servers/{id}/bans/{user_id}",
    tag = "Server Bans",
    params(MemberPath),
    responses(
        (status = 200, description = "Membre débanni"),
        (status = 403, description = "Non autorisé")
    ),
    security(("jwt" = []))
)]
pub async fn unban_member(
    user: AuthenticatedUser,
    service: web::Data<ServerService>,
    ws: web::Data<Addr<WsServer>>,
    path: web::Path<MemberPath>,
) -> impl Responder {
    let server_id = path.id;
    let target_user_id = path.user_id;

    match service
        .unban_member(user.user_id, server_id, target_user_id)
        .await
    {
        Ok(_) => {
            let username = service
                .get_username(target_user_id)
                .await
                .unwrap_or_else(|_| "unknown".to_string());

            ws.do_send(ServerEvent::MemberUnbanned {
                server_id,
                user_id: target_user_id,
                username,
            });

            json_message(actix_web::http::StatusCode::OK, "SERVER_MEMBER_UNBANNED", "Member unbanned")
        }
        Err(e) if e == "Forbidden" => json_error(actix_web::http::StatusCode::FORBIDDEN, "PERMISSION_DENIED", "Forbidden"),
        Err(e) => json_error(actix_web::http::StatusCode::BAD_REQUEST, "SERVER_MEMBER_UNBAN_FAILED", e),
    }
}

#[utoipa::path(
    delete,
    path = "/api/servers/{id}",
    tag = "Servers",
    params(("id" = Uuid, Path, description = "L'ID du serveur à supprimer")),
    responses(
        (status = 200, description = "Serveur supprimé avec succès")
    ),
    security(("jwt" = []))
)]
pub async fn delete_server(
    user: AuthenticatedUser,
    service: web::Data<ServerService>,
    ws: web::Data<Addr<WsServer>>,
    path: web::Path<uuid::Uuid>,
) -> impl Responder {
    let server_id = path.into_inner();

    match service.delete_server(server_id, user.user_id).await {
        Ok(_) => {
            ws.do_send(ServerEvent::ServerDeleted { server_id });
            json_message(actix_web::http::StatusCode::OK, "SERVER_DELETED", "Server deleted successfully")
        }
        Err(e) => json_error(actix_web::http::StatusCode::BAD_REQUEST, "SERVER_DELETE_FAILED", e),
    }
}

pub fn config(cfg: &mut web::ServiceConfig) {
    cfg.route("", web::post().to(create_server))
        .route("", web::get().to(list_servers))
        .route("/join", web::post().to(join_server))
        .route("/{id}/leave", web::delete().to(leave_server))
        .route("/{id}/members", web::get().to(list_members))
        .route(
            "/{id}/members/{user_id}/role",
            web::patch().to(set_member_role),
        )
        .route("/{id}/members/{user_id}", web::delete().to(kick_member))
        .route("/{id}/transfer-owner", web::post().to(transfer_owner))
        .route("/{id}", web::put().to(update_server))
        .route("/{id}", web::delete().to(delete_server))
        .route("/{id}/bans/{user_id}", web::post().to(ban_member))
        .route(
            "/{id}/bans-temporary/{user_id}",
            web::post().to(ban_temporary_member),
        )
        .route("/{id}/bans", web::get().to(ban_list))
        .route("/{id}/bans/{user_id}", web::delete().to(unban_member));
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::{http::StatusCode, test, web, App};

    fn build_app() -> App<
        impl actix_web::dev::ServiceFactory<
            actix_web::dev::ServiceRequest,
            Config = (),
            Response = actix_web::dev::ServiceResponse,
            Error = actix_web::Error,
            InitError = (),
        >,
    > {
        App::new().service(web::scope("/servers").configure(config))
    }

    fn assert_method_not_allowed_or_not_found(status: StatusCode) {
        assert!(status == StatusCode::METHOD_NOT_ALLOWED || status == StatusCode::NOT_FOUND);
    }

    #[actix_web::test]
    async fn test_routes_exist_and_unrelated_is_404() {
        let app = test::init_service(build_app()).await;

        let req = test::TestRequest::get()
            .uri("/servers/nope-nope")
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    }

    #[actix_web::test]
    async fn test_wrong_method_on_dynamic_paths_is_not_success() {
        let app = test::init_service(build_app()).await;

        let sid = uuid::Uuid::new_v4();
        let uid = uuid::Uuid::new_v4();

        let req = test::TestRequest::post()
            .uri(&format!("/servers/{}/leave", sid))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_method_not_allowed_or_not_found(resp.status());

        let req = test::TestRequest::post()
            .uri(&format!("/servers/{}/members", sid))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_method_not_allowed_or_not_found(resp.status());

        let req = test::TestRequest::get()
            .uri(&format!("/servers/{}/members/{}/role", sid, uid))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_method_not_allowed_or_not_found(resp.status());

        let req = test::TestRequest::get()
            .uri(&format!("/servers/{}/members/{}", sid, uid))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_method_not_allowed_or_not_found(resp.status());

        let req = test::TestRequest::get()
            .uri(&format!("/servers/{}/transfer-owner", sid))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_method_not_allowed_or_not_found(resp.status());

        let req = test::TestRequest::post()
            .uri(&format!("/servers/{}", sid))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_method_not_allowed_or_not_found(resp.status());
    }

    #[actix_web::test]
    async fn test_join_wrong_method_is_not_success() {
        let app = test::init_service(build_app()).await;
        let req = test::TestRequest::get().uri("/servers/join").to_request();
        let resp = test::call_service(&app, req).await;

        assert_method_not_allowed_or_not_found(resp.status());
    }

    #[actix_web::test]
    async fn test_root_servers_wrong_method_is_not_success() {
        let app = test::init_service(build_app()).await;

        let req = test::TestRequest::delete().uri("/servers").to_request();
        let resp = test::call_service(&app, req).await;

        assert_method_not_allowed_or_not_found(resp.status());
    }
}
