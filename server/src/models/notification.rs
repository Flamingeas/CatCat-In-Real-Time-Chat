use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PushSubscription {
    pub endpoint: String,
    pub keys: SubscriptionKeys,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SubscriptionKeys {
    pub p256dh: String,
    pub auth: String,
}