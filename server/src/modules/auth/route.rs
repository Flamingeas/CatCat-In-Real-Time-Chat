use crate::models::user::CreateUser;
use crate::modules::auth::service::AuthService;
use crate::utils::errors::json_error;
use actix_web::{web, HttpResponse, Responder};
use serde::Deserialize;
use utoipa::ToSchema;

#[derive(Deserialize, ToSchema)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[utoipa::path(
    post,
    path = "/auth/signup",
    tag = "Authentication",
    request_body = CreateUser, 
    responses(
        (status = 201, description = "Utilisateur créé"),
        (status = 400, description = "Erreur de validation ou email existant")
    )
)]

pub async fn signup(
    service: web::Data<AuthService>,
    data: web::Json<CreateUser>,
) -> impl Responder {
    match service.signup(data.into_inner()).await {
        Ok((user, token)) => HttpResponse::Created().json(serde_json::json!({
            "user": user,
            "token": token
        })),
        Err(e) => json_error(actix_web::http::StatusCode::BAD_REQUEST, "AUTH_SIGNUP_FAILED", e),
    }
}

#[utoipa::path(
    post,
    path = "/auth/login",
    tag = "Authentication",
    request_body = LoginRequest,
    responses(
        (status = 200, description = "Connexion réussie (Renvoie le Token JWT)"),
        (status = 401, description = "Identifiants invalides")
    )
)]

pub async fn login(
    service: web::Data<AuthService>,
    data: web::Json<LoginRequest>,
) -> impl Responder {
    let request = data.into_inner();

    match service.login(request.email, request.password).await {
        Ok((user, token)) => HttpResponse::Ok().json(serde_json::json!({
            "user": user,
            "token": token
        })),
        Err(e) => json_error(actix_web::http::StatusCode::UNAUTHORIZED, "AUTH_LOGIN_FAILED", e),
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
            .route("/logout", web::post().to(logout)),
    );
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::{http::StatusCode, test, web, App};
    use chrono::Utc;
    use std::collections::HashMap;
    use std::sync::{Arc, Mutex};
    use uuid::Uuid;

    use crate::models::user::User;
    use crate::modules::auth::service::{AuthService, UserRepo};

    #[derive(Default)]
    struct MockUserRepo {
        by_email: Mutex<HashMap<String, User>>,
        by_username: Mutex<HashMap<String, User>>,
        create_should_fail: Mutex<bool>,
        find_by_email_should_fail: Mutex<bool>,
    }

    impl MockUserRepo {
        fn insert_user(&self, user: User) {
            self.by_email
                .lock()
                .unwrap()
                .insert(user.email.to_lowercase(), user.clone());
            self.by_username
                .lock()
                .unwrap()
                .insert(user.username.clone(), user);
        }

        fn set_create_fail(&self, value: bool) {
            *self.create_should_fail.lock().unwrap() = value;
        }

        fn set_find_by_email_fail(&self, value: bool) {
            *self.find_by_email_should_fail.lock().unwrap() = value;
        }
    }

    #[async_trait::async_trait]
    impl UserRepo for MockUserRepo {
        async fn find_by_email(&self, email: &str) -> Result<Option<User>, String> {
            if *self.find_by_email_should_fail.lock().unwrap() {
                return Err("forced find_by_email failure".to_string());
            }

            Ok(self
                .by_email
                .lock()
                .unwrap()
                .get(&email.to_lowercase())
                .cloned())
        }

        async fn find_by_username(&self, username: &str) -> Result<Option<User>, String> {
            Ok(self.by_username.lock().unwrap().get(username).cloned())
        }

        async fn create(
            &self,
            username: &str,
            email: &str,
            password_hash: &str,
        ) -> Result<User, String> {
            if *self.create_should_fail.lock().unwrap() {
                return Err("forced create failure".to_string());
            }

            let user = User {
                id: Uuid::new_v4(),
                username: username.to_string(),
                email: email.to_string(),
                password_hash: password_hash.to_string(),
                created_at: Utc::now(),
                updated_at: Utc::now(),
            };

            self.insert_user(user.clone());
            Ok(user)
        }
    }

    fn build_auth_service(mock: Arc<MockUserRepo>) -> AuthService {
        AuthService::new_with_repo(mock, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa".to_string())
    }

    #[actix_web::test]
    async fn test_logout_returns_ok() {
        let resp = logout().await;
        assert_eq!(resp.status(), StatusCode::OK);
    }

    #[actix_web::test]
    async fn test_login_request_deserialize() {
        let json = r#"{"email":"test@example.com","password":"secret"}"#;
        let req: LoginRequest = serde_json::from_str(json).unwrap();

        assert_eq!(req.email, "test@example.com");
        assert_eq!(req.password, "secret");
    }

    #[actix_web::test]
    async fn test_signup_returns_created_with_user_and_token() {
        let mock = Arc::new(MockUserRepo::default());
        let service = build_auth_service(mock);

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(service))
                .configure(config),
        )
        .await;

        let req = test::TestRequest::post()
            .uri("/auth/signup")
            .set_json(serde_json::json!({
                "username": "tester",
                "email": "test@example.com",
                "password": "password123"
            }))
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), StatusCode::CREATED);

        let body: serde_json::Value = test::read_body_json(resp).await;
        assert_eq!(body["user"]["username"], "tester");
        assert_eq!(body["user"]["email"], "test@example.com");
        assert!(body["token"].as_str().is_some());
        assert!(!body["token"].as_str().unwrap().is_empty());
    }

    #[actix_web::test]
    async fn test_signup_returns_bad_request_when_service_fails() {
        let mock = Arc::new(MockUserRepo::default());
        mock.set_create_fail(true);

        let service = build_auth_service(mock);

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(service))
                .configure(config),
        )
        .await;

        let req = test::TestRequest::post()
            .uri("/auth/signup")
            .set_json(serde_json::json!({
                "username": "tester",
                "email": "test@example.com",
                "password": "password123"
            }))
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);

        let body: serde_json::Value = test::read_body_json(resp).await;
        assert!(body["error"].as_str().is_some());
    }

    #[actix_web::test]
    async fn test_signup_returns_bad_request_when_payload_is_invalid() {
        let mock = Arc::new(MockUserRepo::default());
        let service = build_auth_service(mock);

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(service))
                .configure(config),
        )
        .await;

        let req = test::TestRequest::post()
            .uri("/auth/signup")
            .set_json(serde_json::json!({
                "username": "te"
            }))
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    }

    #[actix_web::test]
    async fn test_login_returns_ok_with_user_and_token() {
        let mock = Arc::new(MockUserRepo::default());

        let password_hash = bcrypt::hash("password123", 4).unwrap();
        let user = User {
            id: Uuid::new_v4(),
            username: "tester".to_string(),
            email: "test@example.com".to_string(),
            password_hash,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        mock.insert_user(user);

        let service = build_auth_service(mock);

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(service))
                .configure(config),
        )
        .await;

        let req = test::TestRequest::post()
            .uri("/auth/login")
            .set_json(serde_json::json!({
                "email": "test@example.com",
                "password": "password123"
            }))
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), StatusCode::OK);

        let body: serde_json::Value = test::read_body_json(resp).await;
        assert_eq!(body["user"]["username"], "tester");
        assert_eq!(body["user"]["email"], "test@example.com");
        assert!(body["token"].as_str().is_some());
        assert!(!body["token"].as_str().unwrap().is_empty());
    }

    #[actix_web::test]
    async fn test_login_returns_unauthorized_when_credentials_are_invalid() {
        let mock = Arc::new(MockUserRepo::default());
        let service = build_auth_service(mock);

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(service))
                .configure(config),
        )
        .await;

        let req = test::TestRequest::post()
            .uri("/auth/login")
            .set_json(serde_json::json!({
                "email": "missing@example.com",
                "password": "password123"
            }))
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);

        let body: serde_json::Value = test::read_body_json(resp).await;
        assert_eq!(body["error"], "Invalid credentials");
    }

    #[actix_web::test]
    async fn test_login_returns_unauthorized_when_repo_fails() {
        let mock = Arc::new(MockUserRepo::default());
        mock.set_find_by_email_fail(true);

        let service = build_auth_service(mock);

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(service))
                .configure(config),
        )
        .await;

        let req = test::TestRequest::post()
            .uri("/auth/login")
            .set_json(serde_json::json!({
                "email": "test@example.com",
                "password": "password123"
            }))
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);

        let body: serde_json::Value = test::read_body_json(resp).await;
        assert!(body["error"].as_str().unwrap().contains("Database error:"));
    }

    #[actix_web::test]
    async fn test_login_returns_bad_request_when_payload_is_invalid() {
        let mock = Arc::new(MockUserRepo::default());
        let service = build_auth_service(mock);

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(service))
                .configure(config),
        )
        .await;

        let req = test::TestRequest::post()
            .uri("/auth/login")
            .set_json(serde_json::json!({
                "email": "test@example.com"
            }))
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    }

    #[actix_web::test]
    async fn test_config_registers_logout_route() {
        let mock = Arc::new(MockUserRepo::default());
        let service = build_auth_service(mock);

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(service))
                .configure(config),
        )
        .await;

        let req = test::TestRequest::post().uri("/auth/logout").to_request();
        let resp = test::call_service(&app, req).await;

        assert_eq!(resp.status(), StatusCode::OK);
    }
}
