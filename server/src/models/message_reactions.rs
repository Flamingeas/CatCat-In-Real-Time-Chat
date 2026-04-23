use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct Reaction {
    pub emoji: String,
    pub users: Vec<String>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct ReactionPayload {
    #[validate(length(min = 1, max = 10))]
    pub emoji: String,
    pub channel_id: Uuid,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reaction_payload_validation_accepts_emoji_up_to_ten_chars() {
        let payload = ReactionPayload {
            emoji: "🙂".to_string(),
            channel_id: Uuid::new_v4(),
        };

        assert!(payload.validate().is_ok());
    }

    #[test]
    fn reaction_payload_validation_rejects_empty_emoji() {
        let payload = ReactionPayload {
            emoji: String::new(),
            channel_id: Uuid::new_v4(),
        };

        assert!(payload.validate().is_err());
    }

    #[test]
    fn reaction_payload_validation_rejects_too_long_emoji_payload() {
        let payload = ReactionPayload {
            emoji: "abcdefghijk".to_string(),
            channel_id: Uuid::new_v4(),
        };

        assert!(payload.validate().is_err());
    }

    #[test]
    fn reaction_serializes_users_and_emoji() {
        let reaction = Reaction {
            emoji: "fire".to_string(),
            users: vec!["alice".to_string(), "bob".to_string()],
        };

        let json = serde_json::to_value(reaction).unwrap();

        assert_eq!(json["emoji"], "fire");
        assert_eq!(json["users"][0], "alice");
        assert_eq!(json["users"][1], "bob");
    }
}
