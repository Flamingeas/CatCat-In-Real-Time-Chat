use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct Reaction {
    pub emoji: String,
    pub users: Vec<Uuid>,
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
        let alice_id = Uuid::new_v4();
        let bob_id = Uuid::new_v4();
        let reaction = Reaction {
            emoji: "fire".to_string(),
            users: vec![alice_id, bob_id],
        };

        let json = serde_json::to_value(reaction).unwrap();

        assert_eq!(json["emoji"], "fire");
        assert_eq!(json["users"][0], alice_id.to_string());
        assert_eq!(json["users"][1], bob_id.to_string());
    }

    #[test]
    fn reaction_deserializes_users_stored_as_bson_uuid_binaries() {
        use mongodb::bson::spec::BinarySubtype;
        use mongodb::bson::{doc, Binary};

        let user_id = Uuid::new_v4();
        let document = doc! {
            "emoji": ":cat:",
            "users": [Binary {
                subtype: BinarySubtype::Generic,
                bytes: user_id.as_bytes().to_vec(),
            }]
        };
        let reaction: Reaction = mongodb::bson::from_document(document).unwrap();
        assert_eq!(reaction.emoji, ":cat:");
        assert_eq!(reaction.users, vec![user_id]);

        let document = doc! {
            "emoji": ":cat:",
            "users": [user_id.to_string()]
        };
        let reaction: Reaction = mongodb::bson::from_document(document).unwrap();
        assert_eq!(reaction.users, vec![user_id]);
    }
}
