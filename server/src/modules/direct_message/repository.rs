use chrono::DateTime;
use futures::stream::TryStreamExt;
use mongodb::{
    bson::{doc, Binary},
    bson::spec::BinarySubtype,
    Database,
};
use uuid::Uuid;

use crate::models::direct_message::DirectMessage;

fn uuid_bin(id: Uuid) -> Binary {
    Binary { subtype: BinarySubtype::Generic, bytes: id.as_bytes().to_vec(),
    }
}
pub struct DirectMessageRepository<'a> {
    db: &'a Database,
}
impl<'a> DirectMessageRepository<'a> {
    pub fn new(db: &'a Database) -> Self {
        Self { db }
    }
    fn collection(&self) -> mongodb::Collection<DirectMessage> {
        self.db.collection("direct_messages")
    }
    pub async fn create(
        &self,
        conversation_id: Uuid,
        sender_id: Uuid,
        sender_username: String,
        recipient_id: Uuid,
        content: String,
    ) -> Result<DirectMessage, mongodb::error::Error> {
        let dm = DirectMessage::new(conversation_id, sender_id, sender_username, recipient_id, content);
        self.collection().insert_one(&dm).await?;
        Ok(dm)
    }

    pub async fn find_by_id(
        &self,
        message_id: Uuid,
    ) -> Result<Option<DirectMessage>, mongodb::error::Error> {
        let filter = doc! { "message_id": uuid_bin(message_id) };
        self.collection().find_one(filter).await
    }

    pub async fn find_by_conversation(
        &self,
        conversation_id: Uuid,
        limit: i64,
        before: Option<DateTime<chrono::Utc>>,
    ) -> Result<Vec<DirectMessage>, mongodb::error::Error> {
        use mongodb::bson::DateTime as BsonDateTime;
        use mongodb::options::FindOptions;
        let mut filter = doc! {
            "conversation_id": uuid_bin(conversation_id),
        };
        if let Some(before_dt) = before {
            let before_bson = BsonDateTime::from_millis(before_dt.timestamp_millis());
            filter.insert("created_at", doc! { "$lt": before_bson });
        }

        let options = FindOptions::builder()
            .sort(doc! { "created_at": -1 })
            .limit(limit)
            .build();
        let mut cursor = self.collection().find(filter).with_options(options).await?;
        let mut messages = Vec::new();
        while let Some(msg) = cursor.try_next().await? {
            messages.push(msg);
        }
        messages.reverse();
        Ok(messages)
    }

    pub async fn update(
        &self,
        message_id: Uuid,
        content: String,
    ) -> Result<DirectMessage, mongodb::error::Error> {
        use mongodb::bson::DateTime as BsonDateTime;
        let filter = doc! { "message_id": uuid_bin(message_id) };
        let update = doc! {
            "$set": {
                "content": content,
                "updated_at": BsonDateTime::now()
            }
        };
        let dm = self
            .collection()
            .find_one_and_update(filter, update)
            .return_document(mongodb::options::ReturnDocument::After)
            .await?
            .ok_or_else(|| {
                mongodb::error::Error::from(std::io::Error::new(
                    std::io::ErrorKind::NotFound,
                    "Direct message not found",
                ))
            })?;
        Ok(dm)
    }
    pub async fn delete(&self, message_id: Uuid) -> Result<(), mongodb::error::Error> {
        use mongodb::bson::DateTime as BsonDateTime;

        let filter = doc! { "message_id": uuid_bin(message_id) };
        let update = doc! { "$set": { "deleted_at": BsonDateTime::now() } };
        self.collection().update_one(filter, update).await?;
        Ok(())
    }
}
