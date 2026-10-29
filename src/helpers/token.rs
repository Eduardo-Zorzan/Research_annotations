use chrono::{DateTime, Utc};
use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};

use crate::helpers::encryption::{CryptoService, Keys};

#[derive(Serialize, Deserialize, Debug)]
pub struct Token {
    pub expired_at: DateTime<Utc>,
    pub user_id: i64,
    #[serde(default)]
    pub version: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub session: Option<i64>,
}

pub struct UserTokenVersions {
    pub token_version: i64,
    pub session_version: i64,
}

pub fn user_token_versions(conn: &Connection, user_id: i64) -> rusqlite::Result<UserTokenVersions> {
    conn.query_row(
        "SELECT token_version, session_version FROM users WHERE id = ?1",
        params![user_id],
        |row| {
            Ok(UserTokenVersions {
                token_version: row.get(0)?,
                session_version: row.get(1)?,
            })
        },
    )
}

pub fn generate_token(
    user_id: i64,
    expiration_date: DateTime<Utc>,
    versions: &UserTokenVersions,
    is_session: bool,
) -> Result<String, Box<dyn std::error::Error>> {
    let token = Token {
        expired_at: expiration_date,
        user_id,
        version: versions.token_version,
        session: is_session.then_some(versions.session_version),
    };

    let crypto_service = CryptoService::shared(Keys::Token).ok_or("Token cipher unavailable")?;
    crypto_service.encrypt(serde_json::to_string(&token)?)
}

pub fn verify_token(token_encrypted: String) -> Result<Token, Box<dyn std::error::Error>> {
    let crypto_service = CryptoService::shared(Keys::Token).ok_or("Token cipher unavailable")?;
    let token: Token = serde_json::from_str(&crypto_service.decrypt(token_encrypted)?)?;

    if token.expired_at < Utc::now() {
        return Err("Token Expired.".into());
    }

    Ok(token)
}

pub fn is_token_current(token: &Token, versions: &UserTokenVersions) -> bool {
    token.version == versions.token_version
        && token
            .session
            .is_none_or(|session| session == versions.session_version)
}
