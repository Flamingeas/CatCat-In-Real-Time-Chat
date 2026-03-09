use actix_web::{web, Error, HttpRequest, HttpResponse};
use actix_web_actors::ws;

use crate::websocket::server::WsServer;
use crate::websocket::session::WsSession;

pub async fn ws_index(
    req: HttpRequest,
    stream: web::Payload,
    jwt_secret: web::Data<String>,
    server: web::Data<actix::Addr<WsServer>>,
) -> Result<HttpResponse, Error> {
    let session = WsSession::new(jwt_secret.get_ref().clone(), server.get_ref().clone());
    ws::start(session, &req, stream)
}
#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::{test, App, http::StatusCode};

    fn app() -> App<
        impl actix_web::dev::ServiceFactory<
            actix_web::dev::ServiceRequest,
            Config = (),
            Response = actix_web::dev::ServiceResponse,
            Error = actix_web::Error,
            InitError = (),
        >,
    > {
        App::new()
            .app_data(web::Data::new(String::from("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")))
            .route("/ws", web::get().to(ws_index))
    }

    #[actix_web::test]
    async fn test_ws_route_exists_not_404() {
        let app = test::init_service(app()).await;

        let req = test::TestRequest::get().uri("/ws").to_request();
        let resp = test::call_service(&app, req).await;
        assert_ne!(resp.status(), StatusCode::NOT_FOUND);
    }

    #[actix_web::test]
    async fn test_ws_wrong_method_returns_405_or_404_depends() {
        let app = test::init_service(app()).await;

        let req = test::TestRequest::post().uri("/ws").to_request();
        let resp = test::call_service(&app, req).await;
        assert!(resp.status() == StatusCode::METHOD_NOT_ALLOWED || resp.status() == StatusCode::NOT_FOUND);
    }

    #[actix_web::test]
    async fn test_unrelated_path_is_404() {
        let app = test::init_service(app()).await;

        let req = test::TestRequest::get().uri("/nope").to_request();
        let resp = test::call_service(&app, req).await;

        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    }
}
