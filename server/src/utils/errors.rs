use actix_web::{error::ResponseError, http::StatusCode, HttpResponse};
use serde::Serialize;
use std::fmt;

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub code: String,
    pub message: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<String>,
    pub timestamp: i64,
}

impl ErrorResponse {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            details: None,
            timestamp: chrono::Utc::now().timestamp(),
        }
    }
    pub fn with_details(mut self, details: impl Into<String>) -> Self {
        self.details = Some(details.into());
        self
    }
}

#[derive(Debug)]
pub enum AppError {
    UserNotFound,
    EmailAlreadyExists,
    UsernameAlreadyExists,
    InvalidPassword,
    InvalidCredentials,

    ServerNotFound,
    NotServerMember,
    PermissionDenied,
    InvalidInviteCode,
    AlreadyServerMember,
    OwnerCannotLeave,

    ChannelNotFound,
    InvalidChannelName,
    MessageNotFound,
    MessageTooLong,
    MessageEmpty,

    InvalidToken,
    TokenExpired,
    MissingToken,
    Unauthorized,
    ValidationError(String),
    MissingField(String),
    InvalidFormat(String),
    DatabaseError(String),
    ConnectionError,
    UniqueViolation(String),
    InternalError(String),
    NotFound(String),
    BadRequest(String),
    Conflict(String),
    TooManyRequests,
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AppError::UserNotFound => write!(f, "User not found"),
            AppError::EmailAlreadyExists => write!(f, "This email is already in use"),
            AppError::UsernameAlreadyExists => write!(f, "This username is already taken"),
            AppError::InvalidPassword => write!(f, "Invalid password"),
            AppError::InvalidCredentials => write!(f, "Invalid email or password"),
            AppError::ServerNotFound => write!(f, "Server not found"),
            AppError::NotServerMember => write!(f, "You are not a member of this server"),
            AppError::PermissionDenied => write!(f, "Permission denied"),
            AppError::InvalidInviteCode => write!(f, "Invalid invite code"),
            AppError::AlreadyServerMember => write!(f, "You are already a member of this server"),
            AppError::OwnerCannotLeave => write!(f, "The owner cannot leave the server"),
            AppError::ChannelNotFound => write!(f, "Channel not found"),
            AppError::InvalidChannelName => write!(f, "Invalid channel name"),
            AppError::MessageNotFound => write!(f, "Message not found"),
            AppError::MessageTooLong => write!(f, "Message is too long (max 2000 characters)"),
            AppError::MessageEmpty => write!(f, "Message cannot be empty"),
            AppError::InvalidToken => write!(f, "Invalid token"),
            AppError::TokenExpired => write!(f, "Token expired"),
            AppError::MissingToken => write!(f, "Missing token"),
            AppError::Unauthorized => write!(f, "Unauthorized"),
            AppError::ValidationError(msg) => write!(f, "Validation error: {}", msg),
            AppError::MissingField(field) => write!(f, "Required field missing: {}", field),
            AppError::InvalidFormat(msg) => write!(f, "Invalid format: {}", msg),
            AppError::DatabaseError(msg) => write!(f, "Database error: {}", msg),
            AppError::ConnectionError => write!(f, "Database connection error"),
            AppError::UniqueViolation(msg) => write!(f, "Unique constraint violation: {}", msg),
            AppError::InternalError(msg) => write!(f, "Internal error: {}", msg),
            AppError::NotFound(msg) => write!(f, "Not found: {}", msg),
            AppError::BadRequest(msg) => write!(f, "Invalid request: {}", msg),
            AppError::Conflict(msg) => write!(f, "Conflict: {}", msg),
            AppError::TooManyRequests => write!(f, "Too many requests, please try again later"),
        }
    }
}

impl AppError {
    pub fn error_code(&self) -> &str {
        match self {
            AppError::UserNotFound => "USER_NOT_FOUND",
            AppError::EmailAlreadyExists => "EMAIL_ALREADY_EXISTS",
            AppError::UsernameAlreadyExists => "USERNAME_ALREADY_EXISTS",
            AppError::InvalidPassword => "INVALID_PASSWORD",
            AppError::InvalidCredentials => "INVALID_CREDENTIALS",
            AppError::ServerNotFound => "SERVER_NOT_FOUND",
            AppError::NotServerMember => "NOT_SERVER_MEMBER",
            AppError::PermissionDenied => "PERMISSION_DENIED",
            AppError::InvalidInviteCode => "INVALID_INVITE_CODE",
            AppError::AlreadyServerMember => "ALREADY_SERVER_MEMBER",
            AppError::OwnerCannotLeave => "OWNER_CANNOT_LEAVE",
            AppError::ChannelNotFound => "CHANNEL_NOT_FOUND",
            AppError::InvalidChannelName => "INVALID_CHANNEL_NAME",
            AppError::MessageNotFound => "MESSAGE_NOT_FOUND",
            AppError::MessageTooLong => "MESSAGE_TOO_LONG",
            AppError::MessageEmpty => "MESSAGE_EMPTY",
            AppError::InvalidToken => "INVALID_TOKEN",
            AppError::TokenExpired => "TOKEN_EXPIRED",
            AppError::MissingToken => "MISSING_TOKEN",
            AppError::Unauthorized => "UNAUTHORIZED",

            AppError::ValidationError(_) => "VALIDATION_ERROR",
            AppError::MissingField(_) => "MISSING_FIELD",
            AppError::InvalidFormat(_) => "INVALID_FORMAT",

            AppError::DatabaseError(_) => "DATABASE_ERROR",
            AppError::ConnectionError => "CONNECTION_ERROR",
            AppError::UniqueViolation(_) => "UNIQUE_VIOLATION",

            AppError::InternalError(_) => "INTERNAL_ERROR",
            AppError::NotFound(_) => "NOT_FOUND",
            AppError::BadRequest(_) => "BAD_REQUEST",
            AppError::Conflict(_) => "CONFLICT",
            AppError::TooManyRequests => "TOO_MANY_REQUESTS",
        }
    }

    pub fn status_code(&self) -> StatusCode {
        match self {
            AppError::ValidationError(_)
            | AppError::MissingField(_)
            | AppError::InvalidFormat(_)
            | AppError::BadRequest(_)
            | AppError::MessageEmpty
            | AppError::MessageTooLong
            | AppError::InvalidChannelName => StatusCode::BAD_REQUEST,
            AppError::InvalidToken
            | AppError::TokenExpired
            | AppError::MissingToken
            | AppError::Unauthorized
            | AppError::InvalidCredentials
            | AppError::InvalidPassword => StatusCode::UNAUTHORIZED,
            AppError::PermissionDenied | AppError::OwnerCannotLeave => StatusCode::FORBIDDEN,
            AppError::UserNotFound
            | AppError::ServerNotFound
            | AppError::ChannelNotFound
            | AppError::MessageNotFound
            | AppError::NotFound(_) => StatusCode::NOT_FOUND,
            AppError::EmailAlreadyExists
            | AppError::UsernameAlreadyExists
            | AppError::AlreadyServerMember
            | AppError::UniqueViolation(_)
            | AppError::Conflict(_) => StatusCode::CONFLICT,
            AppError::TooManyRequests => StatusCode::TOO_MANY_REQUESTS,
            AppError::DatabaseError(_) | AppError::ConnectionError | AppError::InternalError(_) => {
                StatusCode::INTERNAL_SERVER_ERROR
            }
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

impl ResponseError for AppError {
    fn error_response(&self) -> HttpResponse {
        let status = self.status_code();
        let error_response = ErrorResponse::new(self.error_code(), self.to_string());
        if status.is_server_error() {
            log::error!("[{}] {}: {:?}", status, self.error_code(), self);
        } else if status.is_client_error() && status != StatusCode::NOT_FOUND {
            log::warn!("[{}] {}: {}", status, self.error_code(), self);
        }
        HttpResponse::build(status).json(error_response)
    }
    fn status_code(&self) -> StatusCode {
        self.status_code()
    }
}

impl From<sqlx::Error> for AppError {
    fn from(err: sqlx::Error) -> Self {
        match err {
            sqlx::Error::RowNotFound => AppError::NotFound("Resource not found".to_string()),
            sqlx::Error::Database(db_err) => {
                if let Some(constraint) = db_err.constraint() {
                    AppError::UniqueViolation(constraint.to_string())
                } else {
                    AppError::DatabaseError(db_err.to_string())
                }
            }
            _ => AppError::DatabaseError(err.to_string()),
        }
    }
}
impl From<mongodb::error::Error> for AppError {
    fn from(err: mongodb::error::Error) -> Self {
        AppError::DatabaseError(err.to_string())
    }
}
impl From<validator::ValidationErrors> for AppError {
    fn from(err: validator::ValidationErrors) -> Self {
        AppError::ValidationError(err.to_string())
    }
}
impl From<bcrypt::BcryptError> for AppError {
    fn from(err: bcrypt::BcryptError) -> Self {
        AppError::InternalError(format!("Password hashing error: {}", err))
    }
}
impl From<jsonwebtoken::errors::Error> for AppError {
    fn from(err: jsonwebtoken::errors::Error) -> Self {
        use jsonwebtoken::errors::ErrorKind;
        match err.kind() {
            ErrorKind::ExpiredSignature => AppError::TokenExpired,
            ErrorKind::InvalidToken => AppError::InvalidToken,
            ErrorKind::InvalidSignature => AppError::InvalidToken,
            _ => AppError::InvalidToken,
        }
    }
}
pub type Result<T> = std::result::Result<T, AppError>;

pub fn json_error(
    status: StatusCode,
    code: impl Into<String>,
    message: impl Into<String>,
) -> HttpResponse {
    HttpResponse::build(status).json(ErrorResponse::new(code, message))
}

pub fn json_error_with_details(
    status: StatusCode,
    code: impl Into<String>,
    message: impl Into<String>,
    details: impl Into<String>,
) -> HttpResponse {
    HttpResponse::build(status).json(ErrorResponse::new(code, message).with_details(details))
}

pub fn json_message(
    status: StatusCode,
    code: impl Into<String>,
    message: impl Into<String>,
) -> HttpResponse {
    HttpResponse::build(status).json(serde_json::json!({
        "code": code.into(),
        "message": message.into(),
    }))
}

#[macro_export]
macro_rules! not_found {
    ($($arg:tt)*) => {
        $crate::utils::errors::AppError::NotFound(format!($($arg)*))
    };
}

#[macro_export]
macro_rules! bad_request {
    ($($arg:tt)*) => {
        $crate::utils::errors::AppError::BadRequest(format!($($arg)*))
    };
}

#[macro_export]
macro_rules! internal_error {
    ($($arg:tt)*) => {
        $crate::utils::errors::AppError::InternalError(format!($($arg)*))
    };
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::body::to_bytes;
    use serde_json::Value;

    fn all_error_cases() -> Vec<(AppError, &'static str, &'static str, StatusCode)> {
        vec![
            (
                AppError::UserNotFound,
                "USER_NOT_FOUND",
                "User not found",
                StatusCode::NOT_FOUND,
            ),
            (
                AppError::EmailAlreadyExists,
                "EMAIL_ALREADY_EXISTS",
                "This email is already in use",
                StatusCode::CONFLICT,
            ),
            (
                AppError::UsernameAlreadyExists,
                "USERNAME_ALREADY_EXISTS",
                "This username is already taken",
                StatusCode::CONFLICT,
            ),
            (
                AppError::InvalidPassword,
                "INVALID_PASSWORD",
                "Invalid password",
                StatusCode::UNAUTHORIZED,
            ),
            (
                AppError::InvalidCredentials,
                "INVALID_CREDENTIALS",
                "Invalid email or password",
                StatusCode::UNAUTHORIZED,
            ),
            (
                AppError::ServerNotFound,
                "SERVER_NOT_FOUND",
                "Server not found",
                StatusCode::NOT_FOUND,
            ),
            (
                AppError::NotServerMember,
                "NOT_SERVER_MEMBER",
                "You are not a member of this server",
                StatusCode::INTERNAL_SERVER_ERROR,
            ),
            (
                AppError::PermissionDenied,
                "PERMISSION_DENIED",
                "Permission denied",
                StatusCode::FORBIDDEN,
            ),
            (
                AppError::InvalidInviteCode,
                "INVALID_INVITE_CODE",
                "Invalid invite code",
                StatusCode::INTERNAL_SERVER_ERROR,
            ),
            (
                AppError::AlreadyServerMember,
                "ALREADY_SERVER_MEMBER",
                "You are already a member of this server",
                StatusCode::CONFLICT,
            ),
            (
                AppError::OwnerCannotLeave,
                "OWNER_CANNOT_LEAVE",
                "The owner cannot leave the server",
                StatusCode::FORBIDDEN,
            ),
            (
                AppError::ChannelNotFound,
                "CHANNEL_NOT_FOUND",
                "Channel not found",
                StatusCode::NOT_FOUND,
            ),
            (
                AppError::InvalidChannelName,
                "INVALID_CHANNEL_NAME",
                "Invalid channel name",
                StatusCode::BAD_REQUEST,
            ),
            (
                AppError::MessageNotFound,
                "MESSAGE_NOT_FOUND",
                "Message not found",
                StatusCode::NOT_FOUND,
            ),
            (
                AppError::MessageTooLong,
                "MESSAGE_TOO_LONG",
                "Message is too long (max 2000 characters)",
                StatusCode::BAD_REQUEST,
            ),
            (
                AppError::MessageEmpty,
                "MESSAGE_EMPTY",
                "Message cannot be empty",
                StatusCode::BAD_REQUEST,
            ),
            (
                AppError::InvalidToken,
                "INVALID_TOKEN",
                "Invalid token",
                StatusCode::UNAUTHORIZED,
            ),
            (
                AppError::TokenExpired,
                "TOKEN_EXPIRED",
                "Token expired",
                StatusCode::UNAUTHORIZED,
            ),
            (
                AppError::MissingToken,
                "MISSING_TOKEN",
                "Missing token",
                StatusCode::UNAUTHORIZED,
            ),
            (
                AppError::Unauthorized,
                "UNAUTHORIZED",
                "Unauthorized",
                StatusCode::UNAUTHORIZED,
            ),
            (
                AppError::ValidationError("bad".to_string()),
                "VALIDATION_ERROR",
                "Validation error: bad",
                StatusCode::BAD_REQUEST,
            ),
            (
                AppError::MissingField("email".to_string()),
                "MISSING_FIELD",
                "Required field missing: email",
                StatusCode::BAD_REQUEST,
            ),
            (
                AppError::InvalidFormat("uuid".to_string()),
                "INVALID_FORMAT",
                "Invalid format: uuid",
                StatusCode::BAD_REQUEST,
            ),
            (
                AppError::DatabaseError("down".to_string()),
                "DATABASE_ERROR",
                "Database error: down",
                StatusCode::INTERNAL_SERVER_ERROR,
            ),
            (
                AppError::ConnectionError,
                "CONNECTION_ERROR",
                "Database connection error",
                StatusCode::INTERNAL_SERVER_ERROR,
            ),
            (
                AppError::UniqueViolation("users_email_key".to_string()),
                "UNIQUE_VIOLATION",
                "Unique constraint violation: users_email_key",
                StatusCode::CONFLICT,
            ),
            (
                AppError::InternalError("oops".to_string()),
                "INTERNAL_ERROR",
                "Internal error: oops",
                StatusCode::INTERNAL_SERVER_ERROR,
            ),
            (
                AppError::NotFound("thing".to_string()),
                "NOT_FOUND",
                "Not found: thing",
                StatusCode::NOT_FOUND,
            ),
            (
                AppError::BadRequest("bad".to_string()),
                "BAD_REQUEST",
                "Invalid request: bad",
                StatusCode::BAD_REQUEST,
            ),
            (
                AppError::Conflict("taken".to_string()),
                "CONFLICT",
                "Conflict: taken",
                StatusCode::CONFLICT,
            ),
            (
                AppError::TooManyRequests,
                "TOO_MANY_REQUESTS",
                "Too many requests, please try again later",
                StatusCode::TOO_MANY_REQUESTS,
            ),
        ]
    }

    #[test]
    fn test_error_codes() {
        for (error, code, _, _) in all_error_cases() {
            assert_eq!(error.error_code(), code);
        }
    }

    #[test]
    fn test_status_codes() {
        for (error, _, _, status) in all_error_cases() {
            assert_eq!(error.status_code(), status);
        }
    }

    #[test]
    fn test_display() {
        for (error, _, message, _) in all_error_cases() {
            assert_eq!(error.to_string(), message);
        }
    }

    #[actix_web::test]
    async fn test_error_response() {
        for (error, code, message, status) in all_error_cases() {
            let response = error.error_response();
            assert_eq!(response.status(), status);

            let body = to_bytes(response.into_body()).await.unwrap();
            let value: Value = serde_json::from_slice(&body).unwrap();
            assert_eq!(value["code"], code);
            assert_eq!(value["message"], message);
        }
    }

    #[actix_web::test]
    async fn json_helpers_return_expected_shapes() {
        let response = json_error(StatusCode::BAD_REQUEST, "BAD", "bad request");
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let body = to_bytes(response.into_body()).await.unwrap();
        let value: Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(value["code"], "BAD");
        assert_eq!(value["message"], "bad request");
        assert!(value.get("details").is_none() || value["details"].is_null());

        let response =
            json_error_with_details(StatusCode::BAD_REQUEST, "BAD", "bad request", "field");
        let body = to_bytes(response.into_body()).await.unwrap();
        let value: Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(value["details"], "field");

        let response = json_message(StatusCode::OK, "OK", "done");
        let body = to_bytes(response.into_body()).await.unwrap();
        let value: Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(value["code"], "OK");
        assert_eq!(value["message"], "done");
    }

    #[test]
    fn sqlx_row_not_found_maps_to_not_found() {
        let error = AppError::from(sqlx::Error::RowNotFound);
        assert!(matches!(error, AppError::NotFound(message) if message == "Resource not found"));
    }

    #[test]
    fn jwt_errors_map_to_token_variants() {
        let expired =
            jsonwebtoken::errors::Error::from(jsonwebtoken::errors::ErrorKind::ExpiredSignature);
        let invalid =
            jsonwebtoken::errors::Error::from(jsonwebtoken::errors::ErrorKind::InvalidToken);
        let invalid_signature =
            jsonwebtoken::errors::Error::from(jsonwebtoken::errors::ErrorKind::InvalidSignature);

        assert!(matches!(AppError::from(expired), AppError::TokenExpired));
        assert!(matches!(AppError::from(invalid), AppError::InvalidToken));
        assert!(matches!(
            AppError::from(invalid_signature),
            AppError::InvalidToken
        ));
    }

    #[test]
    fn convenience_macros_create_expected_errors() {
        assert!(matches!(
            not_found!("missing {}", "cat"),
            AppError::NotFound(message) if message == "missing cat"
        ));
        assert!(matches!(
            bad_request!("bad {}", "input"),
            AppError::BadRequest(message) if message == "bad input"
        ));
        assert!(matches!(
            internal_error!("boom {}", 1),
            AppError::InternalError(message) if message == "boom 1"
        ));
    }
}
