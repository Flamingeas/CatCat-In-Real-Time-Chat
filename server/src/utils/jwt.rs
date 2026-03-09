use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{Duration, Utc};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,
    pub exp: i64,
    pub iat: i64,
    pub user_id: Uuid,
    pub email: String,
    pub username: Option<String>,
}

pub fn generate_token(
    user_id: Uuid,
    email: &str,
    username: Option<&str>,
    secret: &str,
    expiration_seconds: i64,
) -> Result<String, jsonwebtoken::errors::Error> {
    let now = Utc::now();
    let expiration = now + Duration::seconds(expiration_seconds);

    let claims = Claims {
        sub: user_id.to_string(),
        exp: expiration.timestamp(),
        iat: now.timestamp(),
        user_id,
        email: email.to_string(),
        username: username.map(|u| u.to_string()),
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
}

pub fn verify_token(token: &str, secret: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
    let mut validation = Validation::default();
    validation.validate_exp = true;
    validation.algorithms = vec![jsonwebtoken::Algorithm::HS256];

    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    )?;
    Ok(token_data.claims)
}

#[cfg(test)]
mod tests {
    use super::*;
    use jsonwebtoken::errors::ErrorKind;

    #[test]
    fn test_verify_token_accepts_valid() {
        let secret = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        let uid = Uuid::new_v4();

        let token = generate_token(uid, "test@example.com", Some("tester"), secret, 60).unwrap();
        let claims = verify_token(&token, secret).unwrap();

        assert_eq!(claims.user_id, uid);
        assert_eq!(claims.email, "test@example.com");
        assert_eq!(claims.username.as_deref(), Some("tester"));
    }
    #[test]
    fn test_verify_token_rejects_expired() {
        let secret = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        let uid = Uuid::new_v4();
        let token = generate_token(uid, "test@example.com", Some("tester"), secret, -3600).unwrap();
        let err = verify_token(&token, secret).unwrap_err();
        match err.kind() {
            ErrorKind::ExpiredSignature => {}
            other => panic!("expected ExpiredSignature, got {:?}", other),
        }
    }
}
