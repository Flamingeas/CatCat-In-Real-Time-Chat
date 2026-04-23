use mongodb::{Client as MongoClient, Database as MongoDatabase};
use sqlx::postgres::{PgPool, PgPoolOptions};
use std::time::Duration;

pub struct DatabaseConfig {
    pub pg: PgPool,
    pub mongo: MongoDatabase,
}

impl DatabaseConfig {
    pub async fn new(
        database_url: &str,
        mongodb_uri: &str,
        mongodb_db_name: &str,
    ) -> Result<Self, anyhow::Error> {
        let pg = PgPoolOptions::new()
            .max_connections(5)
            .min_connections(2)
            .acquire_timeout(Duration::from_secs(30))
            .connect(database_url)
            .await?;

        let client = MongoClient::with_uri_str(mongodb_uri).await?;
        let mongo = client.database(mongodb_db_name);

        Ok(Self { pg, mongo })
    }

    pub async fn setup_mongodb_indexes(&self) -> Result<(), anyhow::Error> {
        Ok(())
    }
}
#[cfg(test)]
mod tests {
    use super::*;

    #[actix_web::test]
    async fn test_new_with_invalid_pg_url_returns_err() {
        let res = DatabaseConfig::new(
            "postgres://invalid:invalid@127.0.0.1:1/invalid_db",
            "mongodb://localhost:27017",
            "test",
        )
        .await;

        assert!(res.is_err());
    }
}
