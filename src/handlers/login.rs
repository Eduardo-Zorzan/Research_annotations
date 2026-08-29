use axum::{
    Json,
    extract::State,
    http::StatusCode,
    response::{Html, IntoResponse},
};
use rust_embed::Embed;
use serde::{Deserialize, Serialize};

use crate::helpers::{self, encryption::CryptoService, token};

#[derive(Embed)]
#[folder = "public"]
struct Asset;

#[derive(Deserialize)]
pub struct Login {
    pub username: String,
    pub password: String,
}

#[derive(Serialize)]
pub struct LoginResponse {
    pub token: String,
}

pub async fn get_login() -> impl IntoResponse {
    match Asset::get("html/login.html") {
        Some(content) => Html(content.data.into_owned()),
        None => Html(b"<h1>Not Found</h1>".to_vec()),
    }
}

pub async fn post(
    State(conn): State<helpers::types::Conn>,
    Json(payload): Json<Login>,
) -> Result<(StatusCode, Json<LoginResponse>), StatusCode> {
    let username = payload.username.trim();
    let password = payload.password;

    if username.is_empty() || password.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let Ok(conn_guard) = conn.lock() else {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    };

    let user_record: (i64, String) = match conn_guard.query_row(
        "SELECT id, password FROM users WHERE name = ?1",
        rusqlite::params![username],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ) {
        Ok(record) => record,
        Err(rusqlite::Error::QueryReturnedNoRows) => return Err(StatusCode::UNAUTHORIZED),
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    let crypto_service_login = match CryptoService::new(helpers::encryption::Keys::Login) {
        Ok(crypto) => crypto,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    let decrypted_password = match crypto_service_login.decrypt(user_record.1) {
        Ok(pass) => pass,
        Err(_) => return Err(StatusCode::UNAUTHORIZED),
    };

    if decrypted_password != password {
        return Err(StatusCode::UNAUTHORIZED);
    }

    let generated_token = match token::generate_token(user_record.0) {
        Ok(crypto) => crypto,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    Ok((
        StatusCode::OK,
        Json(LoginResponse {
            token: generated_token,
        }),
    ))
}
