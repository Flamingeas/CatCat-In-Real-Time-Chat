use actix_web::{web, HttpResponse, Responder};
use serde::Deserialize;
use sqlx::PgPool;
use utoipa::IntoParams;
use uuid::Uuid;
use validator::Validate;

use crate::models::user::{UpdateUser, UserPublicResponse, UserResponse};
use crate::modules::auth::middleware::AuthenticatedUser;
use crate::modules::user::repository::UserRepository;

use super::service::{ServiceError, UserService};

fn user_service(pool: &web::Data<PgPool>) -> UserService {
    let repo = UserRepository::new(pool.get_ref().clone());
    UserService::new(repo)
}

#[utoipa::path(
    get,
    path = "/api/users/me", // <-- CORRIGÉ ICI
    tag = "Users",
    security(
        ("jwt" = [])
    ),
    responses(
        (status = 200, description = "Profil récupéré avec succès", body = UserResponse),
        (status = 401, description = "Non authentifié")
    )
)]
pub async fn get_me(pool: web::Data<PgPool>, user: AuthenticatedUser) -> impl Responder {
    log::debug!("GET /me - User ID: {}", user.user_id);

    let service = user_service(&pool);
    match service.get_profile(user.user_id).await {
        Ok(profile) => HttpResponse::Ok().json(profile),
        Err(e) => handle_service_error(e),
    }
}

#[utoipa::path(
    get,
    path = "/api/users/{id}", // <-- CORRIGÉ ICI
    tag = "Users",
    security(
        ("jwt" = [])
    ),
    params(
        ("id" = Uuid, Path, description = "ID de l'utilisateur")
    ),
    responses(
        (status = 200, description = "Profil public récupéré avec succès", body = UserPublicResponse),
        (status = 404, description = "Utilisateur introuvable")
    )
)]
pub async fn get_user(pool: web::Data<PgPool>, path: web::Path<Uuid>) -> impl Responder {
    let user_id = path.into_inner();
    log::debug!("GET /users/{}", user_id);

    let service = user_service(&pool);
    match service.get_public_profile(user_id).await {
        Ok(profile) => HttpResponse::Ok().json(profile),
        Err(e) => handle_service_error(e),
    }
}

#[utoipa::path(
    get,
    path = "/api/users", // <-- CORRIGÉ ICI
    tag = "Users",
    security(
        ("jwt" = [])
    ),
    params(
        PaginationQuery
    ),
    responses(
        (status = 200, description = "Liste des utilisateurs récupérée", body = [UserPublicResponse]),
        (status = 401, description = "Non authentifié")
    )
)]
pub async fn list_users(
    pool: web::Data<PgPool>,
    query: web::Query<PaginationQuery>,
) -> impl Responder {
    log::debug!(
        "GET /users - page: {}, per_page: {}",
        query.page,
        query.per_page
    );

    let service = user_service(&pool);
    match service.list_users(query.page, query.per_page).await {
        Ok(response) => HttpResponse::Ok().json(response),
        Err(e) => handle_service_error(e),
    }
}

#[utoipa::path(
    put,
    path = "/api/users/me", // <-- CORRIGÉ ICI
    tag = "Users",
    security(
        ("jwt" = [])
    ),
    request_body = UpdateUser,
    responses(
        (status = 200, description = "Profil mis à jour avec succès", body = UserResponse),
        (status = 400, description = "Erreur de validation des données"),
        (status = 401, description = "Non authentifié")
    )
)]
pub async fn update_me(
    pool: web::Data<PgPool>,
    user: AuthenticatedUser,
    data: web::Json<UpdateUser>,
) -> impl Responder {
    log::debug!("PUT /me - User ID: {}", user.user_id);

    if let Err(e) = data.validate() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Validation failed",
            "details": e.to_string()
        }));
    }

    let service = user_service(&pool);
    match service
        .update_profile(user.user_id, data.into_inner())
        .await
    {
        Ok(profile) => HttpResponse::Ok().json(profile),
        Err(e) => handle_service_error(e),
    }
}

#[utoipa::path(
    delete,
    path = "/api/users/me", // <-- CORRIGÉ ICI
    tag = "Users",
    security(
        ("jwt" = [])
    ),
    responses(
        (status = 204, description = "Compte supprimé avec succès"),
        (status = 401, description = "Non authentifié")
    )
)]
pub async fn delete_me(pool: web::Data<PgPool>, user: AuthenticatedUser) -> impl Responder {
    log::debug!("DELETE /me - User ID: {}", user.user_id);

    let service = user_service(&pool);
    match service.delete_user(user.user_id).await {
        Ok(_) => HttpResponse::NoContent().finish(),
        Err(e) => handle_service_error(e),
    }
}

#[derive(Debug, Deserialize, IntoParams)]
pub struct PaginationQuery {
    #[serde(default = "default_page")]
    pub page: i64,
    #[serde(default = "default_per_page")]
    pub per_page: i64,
}

fn default_page() -> i64 {
    1
}

fn default_per_page() -> i64 {
    20
}

fn handle_service_error(error: ServiceError) -> HttpResponse {
    match error {
        ServiceError::NotFound(msg) => {
            HttpResponse::NotFound().json(serde_json::json!({ "error": msg }))
        }
        ServiceError::Conflict(msg) => {
            HttpResponse::Conflict().json(serde_json::json!({ "error": msg }))
        }
        ServiceError::Database(e) => {
            log::error!("Database error: {}", e);
            HttpResponse::InternalServerError()
                .json(serde_json::json!({ "error": "Internal server error" }))
        }
        ServiceError::Internal(msg) => {
            log::error!("Internal error: {}", msg);
            HttpResponse::InternalServerError()
                .json(serde_json::json!({ "error": "Internal server error" }))
        }
    }
}

pub fn config(cfg: &mut web::ServiceConfig) {
    cfg.route("/me", web::get().to(get_me))
        .route("/me", web::put().to(update_me))
        .route("/me", web::delete().to(delete_me))
        .route("", web::get().to(list_users))
        .route("/{id}", web::get().to(get_user));
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::{http::StatusCode, test, web, App};

    #[test]
    async fn test_default_pagination() {
        let query = PaginationQuery {
            page: default_page(),
            per_page: default_per_page(),
        };
        assert_eq!(query.page, 1);
        assert_eq!(query.per_page, 20);
    }

    #[actix_web::test]
    async fn test_config_registers_list_and_get_user_routes_not_404() {
        let pool = PgPool::connect_lazy("postgres://postgres:postgres@127.0.0.1:1/invalid_db")
            .expect("connect_lazy failed");

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .service(web::scope("/users").configure(config)),
        )
        .await;

        let req = test::TestRequest::get().uri("/users").to_request();
        let resp = test::call_service(&app, req).await;
        assert_ne!(resp.status(), StatusCode::NOT_FOUND);

        let id = Uuid::new_v4();
        let req = test::TestRequest::get()
            .uri(&format!("/users/{}", id))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_ne!(resp.status(), StatusCode::NOT_FOUND);
    }
}
