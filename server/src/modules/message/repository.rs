use futures::stream::TryStreamExt;
use mongodb::{
    bson::{doc, Binary},
    bson::spec::BinarySubtype,
    Database,
};
use uuid::Uuid;

use crate::models::message::{CreateMessage, Message, UpdateMessage};

fn uuid_bin0(id: Uuid) -> Binary {
    Binary {
        subtype: BinarySubtype::Generic,
        bytes: id.as_bytes().to_vec(),
    }
}

pub struct MessageRepository<'a> {
    db: &'a Database,
}

impl<'a> MessageRepository<'a> {
    pub fn new(db: &'a Database) -> Self {
        Self { db }
    }

    fn collection(&self) -> mongodb::Collection<Message> {
        self.db.collection("channel_messages")
    }

    pub async fn create(
        &self,
        user_id: Uuid,
        username: String,
        server_id: Uuid,
        data: CreateMessage,
    ) -> Result<Message, mongodb::error::Error> {
        let message = Message::new(
            data.content.clone(),
            user_id,
            username,
            data.channel_id,
            server_id,
        );

        self.collection().insert_one(&message).await?;
        Ok(message)
    }

    pub async fn find_by_id(
        &self,
        message_id: Uuid,
    ) -> Result<Option<Message>, mongodb::error::Error> {
        let filter = doc! {
            "message_id": uuid_bin0(message_id)
        };

        self.collection().find_one(filter).await
    }

    pub async fn find_by_channel(
        &self,
        channel_id: Uuid,
        limit: i64,
        before: Option<chrono::DateTime<chrono::Utc>>,
    ) -> Result<Vec<Message>, mongodb::error::Error> {
        use mongodb::bson::DateTime as BsonDateTime;
        use mongodb::options::FindOptions;

        let mut filter = doc! {
            "channel_id": uuid_bin0(channel_id),
            "$or": [
                { "deleted_at": { "$exists": false } },
                { "deleted_at": null }
            ]
        };

        if let Some(before_dt) = before {
            let before_bson = BsonDateTime::from_millis(before_dt.timestamp_millis());
            filter.insert("created_at", doc! { "$lt": before_bson });
        }

        let options = FindOptions::builder()
            .sort(doc! { "created_at": -1 })
            .limit(limit)
            .build();

        let mut cursor = self
            .collection()
            .find(filter)
            .with_options(options)
            .await?;

        let mut messages = Vec::new();
        while let Some(message) = cursor.try_next().await? {
            messages.push(message);
        }

        messages.reverse();
        Ok(messages)
    }

    pub async fn update(
        &self,
        message_id: Uuid,
        data: &UpdateMessage,
    ) -> Result<Message, mongodb::error::Error> {
        use mongodb::bson::DateTime as BsonDateTime;

        let filter = doc! {
            "message_id": uuid_bin0(message_id)
        };

        let update = doc! {
            "$set": {
                "content": &data.content,
                "updated_at": BsonDateTime::now()
            }
        };

        let options = mongodb::options::FindOneAndUpdateOptions::builder()
            .return_document(mongodb::options::ReturnDocument::After)
            .build();

        let message = self
            .collection()
            .find_one_and_update(filter, update)
            .with_options(options)
            .await?
            .ok_or_else(|| {
                mongodb::error::Error::from(std::io::Error::new(
                    std::io::ErrorKind::NotFound,
                    "Message not found",
                ))
            })?;

        Ok(message)
    }

    pub async fn delete(
        &self,
        message_id: Uuid,
    ) -> Result<(), mongodb::error::Error> {
        use mongodb::bson::DateTime as BsonDateTime;

        let filter = doc! {
            "message_id": uuid_bin0(message_id)
        };

        let update = doc! {
            "$set": { "deleted_at": BsonDateTime::now() }
        };

        self.collection().update_one(filter, update).await?;
        Ok(())
    }

    pub async fn count_by_channel(
        &self,
        channel_id: Uuid,
    ) -> Result<u64, mongodb::error::Error> {
        let filter = doc! {
            "channel_id": uuid_bin0(channel_id),
            "$or": [
                { "deleted_at": { "$exists": false } },
                { "deleted_at": null }
            ]
        };

        self.collection().count_documents(filter).await
    }

    pub async fn add_reaction(
        &self,
        message_id: Uuid,
        user_id: Uuid,
        emoji: String,
    ) -> Result<(), mongodb::error::Error> {
        let collection = self.db.collection::<Message>("messages");

        // 1. On essaie d'ajouter l'utilisateur à une réaction existante
        // On cherche le message ET l'emoji précis. S'il existe, on $addToSet (ajoute si absent) l'user_id
        let filter = doc! { "message_id": message_id.to_string(), "reactions.emoji": &emoji };
        let update = doc! { "$addToSet": { "reactions.$.users": user_id.to_string() } };
        
        let result = collection.update_one(filter, update).await?;

        // 2. Si aucune ligne n'a été modifiée (result.modified_count == 0), 
        // cela veut dire que l'emoji n'existe pas encore sur ce message.
        if result.modified_count == 0 {
            let filter_new = doc! { "message_id": message_id.to_string() };
            let update_new = doc! { 
                "$push": { 
                    "reactions": { 
                        "emoji": emoji, 
                        "users": [user_id.to_string()] 
                    } 
                } 
            };
            collection.update_one(filter_new, update_new).await?;
        }

        Ok(())
    }

    pub async fn remove_reaction(
        &self,
        message_id: Uuid,
        user_id: Uuid,
        emoji: String,
    ) -> Result<(), mongodb::error::Error> {
        let collection = self.db.collection::<Message>("messages");

        // On retire l'utilisateur du tableau users de l'emoji correspondant
        let filter = doc! { "message_id": message_id.to_string(), "reactions.emoji": &emoji };
        let update = doc! { "$pull": { "reactions.$.users": user_id.to_string() } };
        
        collection.update_one(filter, update).await?;

        // Bonus : On nettoie les réactions vides (sans utilisateurs)
        let cleanup_filter = doc! { "message_id": message_id.to_string() };
        let cleanup_update = doc! { "$pull": { "reactions": { "users": { "$size": 0 } } } };
        collection.update_one(cleanup_filter, cleanup_update).await?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_uuid_bin0_binary_format() {
        let id = Uuid::new_v4();
        let bin = uuid_bin0(id);

        assert_eq!(bin.subtype, BinarySubtype::Generic);
        assert_eq!(bin.bytes.len(), 16);
        assert_eq!(bin.bytes.as_slice(), id.as_bytes());
    }

    #[test]
    fn test_filters_use_uuid_bin0_consistently() {
        let channel_id = Uuid::new_v4();
        let message_id = Uuid::new_v4();

        let by_channel = doc! { "channel_id": uuid_bin0(channel_id) };
        let by_id = doc! { "message_id": uuid_bin0(message_id) };

        let bc = by_channel.get("channel_id").unwrap();
        let bi = by_id.get("message_id").unwrap();

        match (bc, bi) {
            (
                mongodb::bson::Bson::Binary(b1),
                mongodb::bson::Bson::Binary(b2),
            ) => {
                assert_eq!(b1.subtype, BinarySubtype::Generic);
                assert_eq!(b1.bytes.as_slice(), channel_id.as_bytes());

                assert_eq!(b2.subtype, BinarySubtype::Generic);
                assert_eq!(b2.bytes.as_slice(), message_id.as_bytes());
            }
            _ => panic!("Expected Binary BSON values"),
        }
    }
}
