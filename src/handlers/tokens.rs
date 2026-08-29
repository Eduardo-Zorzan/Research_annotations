use axum::{Json, extract::Extension, http::StatusCode};
use chrono::{Duration, Utc};
use serde::Serialize;

use crate::handlers::auth::AuthUser;
use crate::helpers::token;

#[derive(Serialize)]
pub struct TokenResponse {
    pub token: String,
}

pub async fn create_token(
    Extension(auth_user): Extension<AuthUser>,
) -> Result<(StatusCode, Json<TokenResponse>), StatusCode> {
    match token::generate_token(auth_user.user_id, Utc::now() + Duration::days(365)) {
        Ok(generated_token) => Ok((
            StatusCode::CREATED,
            Json(TokenResponse {
                token: generated_token,
            }),
        )),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}
