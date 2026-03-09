use actix::Actor;
use actix_cors::Cors;
use actix_web::{middleware::Logger, web, App, HttpServer};
use dotenv::dotenv;

mod config;
mod models;
mod modules;
mod utils;
mod websocket;

use config::{AppState, DatabaseConfig, EnvConfig};
use crate::modules::auth::service::AuthService;
use crate::modules::auth::AuthMiddleware;
use crate::modules::channel::repository::ChannelRepository;
use crate::modules::channel::service::ChannelService;
use crate::modules::server::repository::ServerRepository;
use crate::modules::server::service::ServerService;
use crate::modules::user::repository::UserRepository;
use crate::websocket::server::WsServer;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv().ok();
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));

    let env_config = EnvConfig::load().expect("Configuration issues.");

    let db_config = DatabaseConfig::new(
        &env_config.database_url,
        &env_config.mongodb_uri,
        &env_config.mongodb_db_name,
    )
        .await
        .expect("DB connection failed.");

    let app_state = web::Data::new(AppState { db: db_config });

    let user_repo = UserRepository::new(app_state.db.pg.clone());
    let auth_service = web::Data::new(AuthService::new(user_repo, env_config.jwt_secret.clone()));

    let ws_server = WsServer::new().start();

    let env_config_data = env_config.clone();

    let server_repo = ServerRepository::new(app_state.db.pg.clone());
    let server_service = web::Data::new(ServerService::new(server_repo));

    let channel_repo = ChannelRepository::new(app_state.db.pg.clone());
    let channel_service = web::Data::new(ChannelService::new(channel_repo));

    let pg_pool = app_state.db.pg.clone();
    let mongo_db = app_state.db.mongo.clone();

    HttpServer::new(move || {
        let env_config = env_config_data.clone();

        let cors = Cors::default()
            .allowed_origin_fn(move |origin, _| {
                env_config
                    .cors_origins
                    .iter()
                    .any(|allowed| origin.as_bytes() == allowed.as_bytes())
            })
            .allowed_methods(vec!["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
            .allowed_headers(vec![
                actix_web::http::header::AUTHORIZATION,
                actix_web::http::header::ACCEPT,
                actix_web::http::header::CONTENT_TYPE,
            ])
            .max_age(3600);

        App::new()
            .wrap(Logger::default())
            .wrap(cors)
            .app_data(app_state.clone())
            .app_data(auth_service.clone())
            .app_data(server_service.clone())
            .app_data(channel_service.clone())
            .app_data(web::Data::new(env_config.jwt_secret.clone()))
            .app_data(web::Data::new(ws_server.clone()))
            .app_data(web::Data::new(pg_pool.clone()))
            .app_data(web::Data::new(mongo_db.clone()))
            .route("/ws", web::get().to(websocket::routes::ws_index))
            .configure(modules::auth::route::config)
            .service(
                web::scope("/api")
                    .wrap(AuthMiddleware::new(env_config.jwt_secret.clone()))
                    .service(web::scope("/users").configure(modules::user::route::config))
                    .service(
                        web::scope("/servers")
                            .configure(modules::server::route::config)
                            .configure(modules::channel::route::config_in_servers_scope),
                    )
                    .configure(modules::channel::route::config_root)
                    .configure(modules::message::route::config),
            )
    })
        .bind(env_config.server_address())?
        .run()
        .await
}
