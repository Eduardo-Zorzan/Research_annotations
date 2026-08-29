use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::helpers::encryption::CryptoService;

#[derive(Serialize, Deserialize, Debug)]
pub struct Token {
    pub expired_at: DateTime<Utc>,
    pub user_id: i64,
}

pub fn generate_token(
    user_id: i64,
    expiration_date: DateTime<Utc>,
) -> Result<String, Box<dyn std::error::Error>> {
    let token = Token {
        expired_at: expiration_date,
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

pub fn verify_token(token_encrypted: String) -> Result<i64, Box<dyn std::error::Error>> {
    let crypto_service = match CryptoService::new(super::encryption::Keys::Token) {
        Ok(it) => it,
        Err(err) => return Err(err),
    };
    let decrypted_token = match crypto_service.decrypt(token_encrypted) {
        Ok(it) => it,
        Err(err) => {
            print!("Error on decrypting token: {}", err);
            return Err(err);
        }
    };

    let token: Token = match serde_json::from_str(&decrypted_token) {
        Ok(it) => it,
        Err(err) => {
            print!("Error on deserializing token: {}", err);
            return Err(err.into());
        }
    };

    if token.expired_at < Utc::now() {
        return Err("Token Expired.".into());
    };

    Ok(token.user_id)
}
