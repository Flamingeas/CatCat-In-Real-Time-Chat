use serde::Serialize;
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ServerBanResponse {
    pub user_id: Uuid,
    pub username: String,
    pub reason: Option<String>,
    pub created_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
}