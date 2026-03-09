pub mod repository;
pub mod route;
pub mod service;

pub fn configure(cfg: &mut actix_web::web::ServiceConfig) {
    route::config(cfg);
}
