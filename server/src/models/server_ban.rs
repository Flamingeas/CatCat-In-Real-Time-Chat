use chrono::NaiveDateTime;
use serde::Serialize;
use uuid::Uuid;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ServerBanResponse {
    pub user_id: Uuid,
    pub username: String,
    pub reason: Option<String>,
    pub created_at: NaiveDateTime,
    pub expires_at: Option<NaiveDateTime>,
}