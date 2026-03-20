use std::sync::Arc;

use actix::Actor;
use actix_cors::Cors;
use actix_web::{middleware::Logger, web, App, HttpServer};
use dotenv::dotenv;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

mod config;
mod models;
mod modules;
mod utils;
mod websocket;

use config::{AppState, DatabaseConfig, EnvConfig};
use crate::modules::auth::service::AuthService;
use crate::modules::auth::AuthMiddleware;
use crate::modules::channel::repository::{ChannelRepository, ChannelRepositoryTrait};
use crate::modules::channel::service::{ChannelService, ChannelServiceTrait};
use crate::modules::server::repository::ServerRepository;
use crate::modules::server::service::ServerService;
use crate::modules::user::repository::UserRepository;
use crate::websocket::server::WsServer;

use utoipa::openapi::security::{HttpAuthScheme, HttpBuilder, SecurityScheme};
use utoipa::Modify;

struct SecurityAddon;

impl Modify for SecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        if let Some(components) = openapi.components.as_mut() {
            components.add_security_scheme(
                "jwt",
                SecurityScheme::Http(
                    HttpBuilder::new()
                        .scheme(HttpAuthScheme::Bearer)
                        .bearer_format("JWT")
                        .build(),
                ),
            );
        }
    }
}

// --- DÉCLARATION DU SWAGGER ---
#[derive(OpenApi)]
#[openapi(
    paths(
        // Routes d'authentification
        crate::modules::auth::route::login,
        crate::modules::auth::route::signup,
        crate::modules::user::route::get_me,
        crate::modules::user::route::get_user,
        crate::modules::user::route::list_users,
        crate::modules::user::route::update_me,
        crate::modules::user::route::delete_me,
        
        // Routes des salons
        crate::modules::channel::route::create_channel,
        crate::modules::channel::route::channel_list,
        crate::modules::channel::route::channel_update,
        crate::modules::channel::route::channel_delete,

        // Les routes Messages
        crate::modules::message::route::send_message,
        crate::modules::message::route::get_messages,
        crate::modules::message::route::update_message,
        crate::modules::message::route::delete_message,
        crate::modules::message::route::add_reaction,
        crate::modules::message::route::remove_reaction,

        // Serveurs :
        crate::modules::server::route::create_server,
        crate::modules::server::route::list_servers,
        crate::modules::server::route::update_server,
        crate::modules::server::route::join_server,
        crate::modules::server::route::leave_server,
        crate::modules::server::route::list_members,
    ),
    components(
        schemas(
            // Modèles de requêtes et de réponses
            crate::modules::auth::route::LoginRequest, 
            crate::models::user::CreateUser,
            crate::models::user::UpdateUser,
            crate::models::user::UserResponse,
            crate::models::user::UserPublicResponse,
            crate::models::channel::CreateChannel,
            crate::models::channel::UpdateChannel,
            crate::models::channel::ChannelResponse,
            crate::models::channel::ChannelDetailedResponse,
            crate::models::channel::Channel,
            crate::modules::message::route::SendMessageRequest,
            crate::modules::message::route::UpdateMessageRequest,
            crate::models::message::MessageResponse,
            crate::models::message_reactions::ReactionPayload,
            crate::models::message_reactions::Reaction,
            crate::models::server::CreateServer,
            crate::models::server::UpdateServer,
            crate::models::server::ServerResponse,
            crate::models::server::ServerDetailedResponse,
            crate::models::server::JoinServerRequest,
            crate::models::server::Server,
        )
    ),
    tags(
        (name = "Authentication", description = "Gestion des comptes utilisateurs"),
        (name = "Channels", description = "Gestion des salons textuels"),
        (name = "Messages", description = "Envoi et historique des messages (MongoDB)"),
        (name = "Servers", description = "Gestion des serveurs"),
        (name = "Server Members", description = "Gestion des rôles et des utilisateurs"),
    ),
    modifiers(&SecurityAddon),
)]
struct ApiDoc;

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
    let auth_service =
        web::Data::new(AuthService::new(user_repo, env_config.jwt_secret.clone()));

    let ws_server = WsServer::new().start();

    let env_config_data = env_config.clone();

    let server_repo = ServerRepository::new(app_state.db.pg.clone());
    let server_service = web::Data::new(ServerService::new(server_repo));

    let channel_repo: Arc<dyn ChannelRepositoryTrait> =
        Arc::new(ChannelRepository::new(app_state.db.pg.clone()));

    let channel_service: web::Data<Arc<dyn ChannelServiceTrait>> =
        web::Data::new(Arc::new(ChannelService::new(channel_repo)));

    let pg_pool = app_state.db.pg.clone();
    let mongo_db = app_state.db.mongo.clone();

    // Génération de la documentation OpenAPI
    let openapi = ApiDoc::openapi();

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
            
            // --- NOUVEAU : On ajoute la route visuelle du Swagger ---
            .service(
                SwaggerUi::new("/swagger-ui/{_:.*}")
                    .url("/api-docs/openapi.json", openapi.clone()),
            )

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