use std::env;

#[derive(Debug, Clone)]
pub struct EnvConfig {
    pub database_url: String,
    pub mongodb_uri: String,
    pub mongodb_db_name: String,
    pub jwt_secret: String,
    pub server_host: String,
    pub server_port: u16,
    pub cors_origins: Vec<String>,
}

impl EnvConfig {
    pub fn load() -> Result<Self, String> {
        #[cfg(not(test))]
        {
            dotenv::dotenv().ok();
        }

        let database_url = env::var("DATABASE_URL")
            .map_err(|_| "DATABASE_URL must be set".to_string())?;

        let mongodb_uri =
            env::var("MONGODB_URI").unwrap_or_else(|_| "mongodb://localhost:27017".to_string());

        let mongodb_db_name = env::var("MONGODB_DB_NAME").unwrap_or_else(|_| "catcat".to_string());

        let jwt_secret = env::var("JWT_SECRET").map_err(|_| "JWT_SECRET must be set".to_string())?;

        if jwt_secret.len() < 32 {
            return Err("JWT_SECRET must be at least 32 characters long".to_string());
        }

        let server_host = env::var("SERVER_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());

        let server_port = match env::var("SERVER_PORT") {
            Ok(value) => value
                .parse::<u16>()
                .map_err(|_| "SERVER_PORT must be a valid port number".to_string())?,
            Err(_) => 8080,
        };

        let cors_origins = env::var("CORS_ORIGINS")
            .unwrap_or_else(|_| "http://localhost:3000".to_string())
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        Ok(Self {
            database_url,
            mongodb_uri,
            mongodb_db_name,
            jwt_secret,
            server_host,
            server_port,
            cors_origins,
        })
    }

    pub fn server_address(&self) -> String {
        format!("{}:{}", self.server_host, self.server_port)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Mutex, OnceLock};

    fn env_mutex() -> &'static Mutex<()> {
        static M: OnceLock<Mutex<()>> = OnceLock::new();
        M.get_or_init(|| Mutex::new(()))
    }

    fn clear_env() {
        std::env::remove_var("DATABASE_URL");
        std::env::remove_var("MONGODB_URI");
        std::env::remove_var("MONGODB_DB_NAME");
        std::env::remove_var("JWT_SECRET");
        std::env::remove_var("SERVER_HOST");
        std::env::remove_var("SERVER_PORT");
        std::env::remove_var("CORS_ORIGINS");
    }

    #[test]
    fn test_server_address() {
        let _g = env_mutex().lock().unwrap();

        let config = EnvConfig {
            database_url: "".to_string(),
            mongodb_uri: "".to_string(),
            mongodb_db_name: "".to_string(),
            jwt_secret: "a".repeat(32),
            server_host: "127.0.0.1".to_string(),
            server_port: 8080,
            cors_origins: vec![],
        };
        assert_eq!(config.server_address(), "127.0.0.1:8080");
    }

    #[test]
    fn test_load_success() {
        let _g = env_mutex().lock().unwrap();
        clear_env();

        std::env::set_var("DATABASE_URL", "postgres://test");
        std::env::set_var("MONGODB_URI", "mongodb://localhost:27017");
        std::env::set_var("MONGODB_DB_NAME", "testdb");
        std::env::set_var("JWT_SECRET", "a".repeat(32));
        std::env::set_var("SERVER_HOST", "0.0.0.0");
        std::env::set_var("SERVER_PORT", "9000");
        std::env::set_var("CORS_ORIGINS", "http://a.com,http://b.com");

        let config = EnvConfig::load().unwrap();

        assert_eq!(config.database_url, "postgres://test");
        assert_eq!(config.mongodb_uri, "mongodb://localhost:27017");
        assert_eq!(config.mongodb_db_name, "testdb");
        assert_eq!(config.jwt_secret.len(), 32);
        assert_eq!(config.server_host, "0.0.0.0");
        assert_eq!(config.server_port, 9000);
        assert_eq!(config.server_address(), "0.0.0.0:9000");
        assert_eq!(config.cors_origins, vec!["http://a.com", "http://b.com"]);
    }

    #[test]
    fn test_load_fails_without_database_url() {
        let _g = env_mutex().lock().unwrap();
        clear_env();

        std::env::set_var("JWT_SECRET", "a".repeat(32));

        let err = EnvConfig::load().unwrap_err();
        assert_eq!(err, "DATABASE_URL must be set");
    }

    #[test]
    fn test_load_fails_without_jwt_secret() {
        let _g = env_mutex().lock().unwrap();
        clear_env();

        std::env::set_var("DATABASE_URL", "postgres://test");

        let err = EnvConfig::load().unwrap_err();
        assert_eq!(err, "JWT_SECRET must be set");
    }

    #[test]
    fn test_load_fails_with_short_jwt_secret() {
        let _g = env_mutex().lock().unwrap();
        clear_env();

        std::env::set_var("DATABASE_URL", "postgres://test");
        std::env::set_var("JWT_SECRET", "short");

        let err = EnvConfig::load().unwrap_err();
        assert_eq!(err, "JWT_SECRET must be at least 32 characters long");
    }

    #[test]
    fn test_defaults_are_applied() {
        let _g = env_mutex().lock().unwrap();
        clear_env();

        std::env::set_var("DATABASE_URL", "postgres://test");
        std::env::set_var("JWT_SECRET", "a".repeat(32));

        let config = EnvConfig::load().unwrap();

        assert_eq!(config.mongodb_uri, "mongodb://localhost:27017");
        assert_eq!(config.mongodb_db_name, "catcat");
        assert_eq!(config.server_host, "127.0.0.1");
        assert_eq!(config.server_port, 8080);
        assert_eq!(config.cors_origins, vec!["http://localhost:3000"]);
    }

    #[test]
    fn test_server_port_invalid_fails() {
        let _g = env_mutex().lock().unwrap();
        clear_env();

        std::env::set_var("DATABASE_URL", "postgres://test");
        std::env::set_var("JWT_SECRET", "a".repeat(32));
        std::env::set_var("SERVER_PORT", "not_a_number");

        let err = EnvConfig::load().unwrap_err();
        assert_eq!(err, "SERVER_PORT must be a valid port number");
    }

    #[test]
    fn test_cors_origins_trims_and_filters_empty() {
        let _g = env_mutex().lock().unwrap();
        clear_env();

        std::env::set_var("DATABASE_URL", "postgres://test");
        std::env::set_var("JWT_SECRET", "a".repeat(32));
        std::env::set_var("CORS_ORIGINS", "  http://a.com , ,http://b.com,   ");

        let config = EnvConfig::load().unwrap();

        assert_eq!(config.cors_origins, vec!["http://a.com", "http://b.com"]);
    }
}
