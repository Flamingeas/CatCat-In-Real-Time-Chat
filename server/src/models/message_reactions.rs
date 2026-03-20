use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct Reaction {
    pub emoji: String,
    pub users: Vec<Uuid>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct ReactionPayload {
    #[validate(length(min = 1, max = 10, message = "L'emoji est invalide"))]
    pub emoji: String,
    pub channel_id: Uuid,
}


