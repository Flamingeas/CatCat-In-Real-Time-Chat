use web_push::{
    SubscriptionInfo, WebPushClient, WebPushMessageBuilder, VapidSignatureBuilder,
};
use crate::models::user::PushSubscription;

pub async fn send_push_notification(
    sub: &PushSubscription, 
    title: &str, 
    body: &str
) -> Result<(), Box<dyn std::error::Error>> {
    
    let subscription_info = SubscriptionInfo::new(
        sub.endpoint.clone(),
        sub.keys.p256dh.clone(),
        sub.keys.auth.clone(),
    );

    let payload = serde_json::json!({
        "title": title,
        "body": body,
    }).to_string();

    let private_key = std::env::var("VAPID_PRIVATE_KEY").expect("VAPID_PRIVATE_KEY manquante");
    let subject = std::env::var("VAPID_SUBJECT").expect("VAPID_SUBJECT manquante");
    
    let sig_builder = VapidSignatureBuilder::from_base64_no_padding(
        &private_key,
        subscription_info.endpoint.clone(),
        &subject,
    )?;
    let signature = sig_builder.build()?;

    let mut builder = WebPushMessageBuilder::new(&subscription_info);
    builder.set_vapid_signature(signature);
    builder.set_payload(web_push::WebPushPayload::String(payload));

    let client = WebPushClient::new()?;
    let message = builder.build()?;
    
    client.send(message).await?;

    Ok(())
}