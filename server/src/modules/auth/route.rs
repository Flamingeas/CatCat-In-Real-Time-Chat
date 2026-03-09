use actix_web::{web, HttpResponse, Responder};
use serde::Deserialize;
use crate::modules::auth::service::AuthService;
use crate::models::user::CreateUser;

#[derive(Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

pub async fn signup(
    service: web::Data<AuthService>,
    data: web::Json<CreateUser>,
) -> impl Responder {
    match service.signup(data.into_inner()).await {
        Ok((user, token)) => {
            HttpResponse::Created().json(serde_json::json!({
                "user": user,
                "token": token
            }))
        }
        Err(e) => {
            HttpResponse::BadRequest().json(serde_json::json!({
                "error": e
            }))
        }
    }
}

pub async fn login(
    service: web::Data<AuthService>,
    data: web::Json<LoginRequest>,
) -> impl Responder {
    let request = data.into_inner();

    match service.login(request.email, request.password).await {
        Ok((user, token)) => {
            HttpResponse::Ok().json(serde_json::json!({
                "user": user,
                "token": token
            }))
        }
        Err(e) => {
            HttpResponse::Unauthorized().json(serde_json::json!({
                "error": e
            }))
        }
    }
}

pub async fn logout() -> HttpResponse {
    HttpResponse::Ok().finish()
}

pub fn config(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/auth")
            .route("/signup", web::post().to(signup))
            .route("/login", web::post().to(login))
            .route("/logout", web::post().to(logout))
    );
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::{test, App, http::StatusCode};

    #[actix_web::test]
    async fn test_logout_returns_ok() {
        let resp = logout().await;
        assert_eq!(resp.status(), StatusCode::OK);
    }

    #[test]
    async fn test_login_request_deserialize() {
        let json = r#"{"email":"test@example.com","password":"secret"}"#;
        let req: LoginRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.email, "test@example.com");
        assert_eq!(req.password, "secret");
    }

    #[actix_web::test]
    async fn test_config_registers_routes_logout_works() {
        let app = test::init_service(App::new().configure(config)).await;

        let req = test::TestRequest::post().uri("/auth/logout").to_request();
        let resp = test::call_service(&app, req).await;

        assert_eq!(resp.status(), StatusCode::OK);
    }

    #[actix_web::test]
    async fn test_config_registers_routes_login_exists_even_without_service_data() {
        let app = test::init_service(App::new().configure(config)).await;

        let req = test::TestRequest::post()
            .uri("/auth/login")
            .set_json(serde_json::json!({
                "email": "test@example.com",
                "password": "secret"
            }))
            .to_request();

        let resp = test::call_service(&app, req).await;

        assert_eq!(resp.status(), StatusCode::INTERNAL_SERVER_ERROR);
    }

    #[actix_web::test]
    async fn test_config_registers_routes_signup_exists_even_without_service_data() {
        let app = test::init_service(App::new().configure(config)).await;

        let req = test::TestRequest::post()
            .uri("/auth/signup")
            .set_json(serde_json::json!({
                "username": "tester",
                "email": "test@example.com",
                "password": "password123"
            }))
            .to_request();

        let resp = test::call_service(&app, req).await;

        assert_eq!(resp.status(), StatusCode::INTERNAL_SERVER_ERROR);
    }
}
