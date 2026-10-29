use axum::{
    Json,
    extract::{Extension, State},
    http::{HeaderMap, StatusCode, header},
    response::{IntoResponse, Response},
};
use chrono::{Duration, Utc};
use rusqlite::params;
use serde::Serialize;

use crate::handlers::auth::{self, AuthUser};
use crate::helpers::{access::lock_db, token, types::Conn};

#[derive(Serialize)]
pub struct TokenResponse {
    pub token: String,
}

pub async fn create_token(
    State(conn): State<Conn>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<(StatusCode, Json<TokenResponse>), StatusCode> {
    let versions = token::user_token_versions(&*lock_db(&conn)?, auth_user.user_id)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    match token::generate_token(
        auth_user.user_id,
        Utc::now() + Duration::days(365),
        &versions,
        false,
    ) {
        Ok(generated_token) => Ok((
            StatusCode::CREATED,
            Json(TokenResponse {
                token: generated_token,
            }),
        )),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

pub async fn revoke_all(
    State(conn): State<Conn>,
    Extension(auth_user): Extension<AuthUser>,
    headers: HeaderMap,
) -> Result<Response, StatusCode> {
    lock_db(&conn)?
        .execute(
            "UPDATE users SET token_version = token_version + 1 WHERE id = ?1",
            params![auth_user.user_id],
        )
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut response = StatusCode::NO_CONTENT.into_response();
    response
        .headers_mut()
        .insert(header::SET_COOKIE, auth::session_cookie(&headers, "", 0));
    Ok(response)
}
