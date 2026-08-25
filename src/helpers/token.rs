use axum::http::StatusCode;
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};

use crate::helpers::encryption::CryptoService;

#[derive(Serialize, Deserialize, Debug)]
pub struct Token {
    pub expired_at: DateTime<Utc>,
    pub user_id: i64,
}

fn generate_token(user_id: i64) -> Result<String, Box<dyn std::error::Error>> {
    let token = Token {
        expired_at: Utc::now() + Duration::weeks(2),
        user_id: user_id,
    };

    let crypto_service = match CryptoService::new(super::encryption::Keys::Token) {
        Ok(it) => it,
        Err(err) => return Err(err),
    };
    let json_token = serde_json::to_string(&token).unwrap();

    match crypto_service.encrypt(json_token) {
        Ok(token_success) => return Ok(token_success),
        Err(err) => return Err(err),
    };
}

fn verify_token(token_encrypted: String, user_id: i64) -> StatusCode {
    let crypto_service = match CryptoService::new(super::encryption::Keys::Token) {
        Ok(it) => it,
        Err(err) => {
            print!("Error on initialize CryptoService: {}", err);
            return StatusCode::INTERNAL_SERVER_ERROR;
        }
    };
    let decrypted_token = match crypto_service.decrypt(token_encrypted) {
        Ok(it) => it,
        Err(err) => {
            print!("Error on decrypting token: {}", err);
            return StatusCode::FORBIDDEN;
        }
    };

    let token: Token = match serde_json::from_str(&decrypted_token) {
        Ok(it) => it,
        Err(err) => {
            print!("Error on deserializing token: {}", err);
            return StatusCode::FORBIDDEN;
        }
    };

    if token.user_id != user_id || token.expired_at < Utc::now() {
        return StatusCode::FORBIDDEN;
    };

    return StatusCode::OK;
}
