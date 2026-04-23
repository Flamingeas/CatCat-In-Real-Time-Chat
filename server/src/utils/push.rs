use web_push::{
    SubscriptionInfo, WebPushClient, WebPushMessageBuilder, VapidSignatureBuilder,
};
use crate::models::user::PushSubscription;

pub async fn send_push_notification(
    sub: &PushSubscription, 
    title: &str, 
    body: &str
) -> Result<(), Box<dyn std::error::Error>> {
    
    // 1. On recrée l'objet d'abonnement pour la librairie
    let subscription_info = SubscriptionInfo::new(
        sub.endpoint.clone(),
        sub.keys.p256dh.clone(),
        sub.keys.auth.clone(),
    );

    // 2. On prépare le contenu (JSON) qui sera lu par le Service Worker en JS
    let payload = serde_json::json!({
        "title": title,
        "body": body,
    }).to_string();

    // 3. On signe la requête avec nos clés VAPID (depuis le .env)
    let private_key = std::env::var("VAPID_PRIVATE_KEY").expect("VAPID_PRIVATE_KEY manquante");
    let subject = std::env::var("VAPID_SUBJECT").expect("VAPID_SUBJECT manquante");
    
    let sig_builder = VapidSignatureBuilder::from_base64_no_padding(
        &private_key,
        subscription_info.endpoint.clone(),
        &subject,
    )?;
    let signature = sig_builder.build()?;

    // 4. On forge et on envoie le message !
    let mut builder = WebPushMessageBuilder::new(&subscription_info);
    builder.set_vapid_signature(signature);
    builder.set_payload(web_push::WebPushPayload::String(payload));

    let client = WebPushClient::new()?;
    let message = builder.build()?;
    
    // Boom ! L'envoi vers les serveurs de push (Google FCM, Apple APNs...)
    client.send(message).await?;

    Ok(())
}