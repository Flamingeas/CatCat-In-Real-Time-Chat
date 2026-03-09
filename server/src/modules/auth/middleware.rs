use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    Error, HttpMessage,
};
use chrono::Utc;
use futures_util::future::LocalBoxFuture;
use std::future::{ready, Ready};
use std::pin::Pin;
use uuid::Uuid;

use crate::utils::jwt::verify_token;

pub struct AuthMiddleware {
    jwt_secret: String,
}
impl AuthMiddleware {
    pub fn new(jwt_secret: String) -> Self {
        Self { jwt_secret }
    }
}
impl<S, B> Transform<S, ServiceRequest> for AuthMiddleware
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Transform = AuthMiddlewareService<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(AuthMiddlewareService {
            service,
            jwt_secret: self.jwt_secret.clone(),
        }))
    }
}

pub struct AuthMiddlewareService<S> {
    service: S,
    jwt_secret: String,
}

impl<S, B> Service<ServiceRequest> for AuthMiddlewareService<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let token = match req
            .headers()
            .get(actix_web::http::header::AUTHORIZATION)
            .and_then(|h| h.to_str().ok())
        {
            Some(value) => {
                if let Some(t) = value.strip_prefix("Bearer ") {
                    t.to_string()
                } else {
                    return Box::pin(async move {
                        Err(actix_web::error::ErrorUnauthorized(
                            "Invalid authorization header format. Use: Bearer <token>",
                        ))
                    });
                }
            }
            None => {
                return Box::pin(async move {
                    Err(actix_web::error::ErrorUnauthorized(
                        "Missing authorization header",
                    ))
                });
            }
        };
        let jwt_secret = self.jwt_secret.clone();
        let claims = match verify_token(&token, &jwt_secret) {
            Ok(c) => c,
            Err(err) => {
                log::warn!("Invalid token from {:?}: {}", req.peer_addr(), err);
                return Box::pin(async move {
                    Err(actix_web::error::ErrorUnauthorized("Invalid or expired token"))
                });
            }
        };
        let now = Utc::now().timestamp();
        if claims.exp < now {
            log::warn!("Expired token from {:?}", req.peer_addr());
            return Box::pin(async move {
                Err(actix_web::error::ErrorUnauthorized("Token has expired"))
            });
        }
        let user_id = match Uuid::parse_str(&claims.sub) {
            Ok(id) => id,
            Err(_) => {
                return Box::pin(async move {
                    Err(actix_web::error::ErrorInternalServerError(
                        "Invalid user ID in token",
                    ))
                });
            }
        };

        req.extensions_mut().insert(AuthenticatedUser {
            user_id,
            email: claims.email.clone(),
            username: claims.username.clone()
        });
        #[cfg(debug_assertions)]
        log::debug!("Authenticated user {} from {:?}", user_id, req.peer_addr());
        let fut = self.service.call(req);
        Box::pin(async move {
            let res = fut.await?;
            Ok(res)
        })
    }
}
#[derive(Clone)]
pub struct AuthenticatedUser {
    pub user_id: Uuid,
    pub email: String,
    pub username: Option<String>,
}

impl actix_web::FromRequest for AuthenticatedUser {
    type Error = Error;
    type Future = Pin<Box<dyn std::future::Future<Output = Result<Self, Self::Error>>>>;

    fn from_request(req: &actix_web::HttpRequest, _payload: &mut actix_web::dev::Payload) -> Self::Future {
        let req = req.clone();
        Box::pin(async move {
            req.extensions()
                .get::<AuthenticatedUser>()
                .cloned()
                .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not found in request."))
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_service::Service;
    use actix_web::{http::StatusCode, test, web, App, HttpResponse};
    use crate::utils::jwt::generate_token;

    async fn test_route(user: AuthenticatedUser) -> HttpResponse {
        HttpResponse::Ok().json(serde_json::json!({
            "user_id": user.user_id.to_string(),
            "email": user.email,
        }))
    }

    #[actix_web::test]
    async fn test_middleware_with_valid_token() {
        let user_id = Uuid::new_v4();
        let email = "test@example.com";
        let secret = "BonBon1234";
        let token = generate_token(user_id, email, Some("testuser"), secret, 3600).unwrap();

        let app = test::init_service(
            App::new().service(
                web::resource("/test")
                    .wrap(AuthMiddleware::new(secret.to_string()))
                    .route(web::get().to(test_route)),
            ),
        )
            .await;

        let req = test::TestRequest::get()
            .uri("/test")
            .insert_header(("Authorization", format!("Bearer {}", token)))
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), StatusCode::OK);
    }

    #[actix_web::test]
    async fn test_middleware_without_token() {
        let secret = "test_secret";

        let mut app = test::init_service(
            App::new().service(
                web::resource("/test")
                    .wrap(AuthMiddleware::new(secret.to_string()))
                    .route(web::get().to(test_route)),
            ),
        )
            .await;

        let req = test::TestRequest::get().uri("/test").to_request();

        let res = app.call(req).await;
        assert!(res.is_err());

        let err = res.err().unwrap();
        assert_eq!(err.as_response_error().status_code(), StatusCode::UNAUTHORIZED);
        assert_eq!(err.to_string(), "Missing authorization header");
    }

    #[actix_web::test]
    async fn test_middleware_with_invalid_token() {
        let secret = "test_secret";

        let mut app = test::init_service(
            App::new().service(
                web::resource("/test")
                    .wrap(AuthMiddleware::new(secret.to_string()))
                    .route(web::get().to(test_route)),
            ),
        )
            .await;

        let req = test::TestRequest::get()
            .uri("/test")
            .insert_header(("Authorization", "Bearer invalid_token_123"))
            .to_request();

        let res = app.call(req).await;
        assert!(res.is_err());

        let err = res.err().unwrap();
        assert_eq!(err.as_response_error().status_code(), StatusCode::UNAUTHORIZED);
        assert_eq!(err.to_string(), "Invalid or expired token");
    }
}
