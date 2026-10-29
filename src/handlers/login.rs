use std::{
    collections::HashMap,
    sync::{LazyLock, Mutex},
    time::{Duration as StdDuration, Instant},
};

use axum::{
    Json,
    extract::State,
    http::{HeaderMap, StatusCode, header},
    response::{IntoResponse, Response},
};
use chrono::{Duration, Utc};
use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::handlers::{assets, auth};
use crate::helpers::{
    self,
    access::lock_db,
    password::{self, Verification},
    token,
};

const SESSION_WEEKS: i64 = 4;
const MAX_FAILED_ATTEMPTS: u32 = 5;
const LOCKOUT: StdDuration = StdDuration::from_secs(5 * 60);

static FAILED_LOGINS: LazyLock<Mutex<HashMap<String, (u32, Instant)>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

#[derive(Deserialize)]
pub struct Login {
    pub username: String,
    pub password: String,
}

#[derive(Serialize)]
pub struct LoginResponse {
    pub token: String,
}

fn is_locked_out(username: &str) -> bool {
    let Ok(attempts) = FAILED_LOGINS.lock() else {
        return false;
    };
    attempts
        .get(username)
        .is_some_and(|(count, last)| *count >= MAX_FAILED_ATTEMPTS && last.elapsed() < LOCKOUT)
}

fn record_failure(username: &str) {
    let Ok(mut attempts) = FAILED_LOGINS.lock() else {
        return;
    };
    attempts.retain(|_, (_, last)| last.elapsed() < LOCKOUT);
    let entry = attempts
        .entry(username.to_string())
        .or_insert((0, Instant::now()));
    entry.0 += 1;
    entry.1 = Instant::now();
}

fn clear_failures(username: &str) {
    if let Ok(mut attempts) = FAILED_LOGINS.lock() {
        attempts.remove(username);
    }
}

pub async fn get_login() -> impl IntoResponse {
    assets::html_page("html/login.html")
}

pub async fn post(
    State(conn): State<helpers::types::Conn>,
    headers: HeaderMap,
    Json(payload): Json<Login>,
) -> Result<Response, StatusCode> {
    let username = payload.username.trim().to_string();
    let password = payload.password;

    if username.is_empty() || password.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    if is_locked_out(&username) {
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }

    let user_record: Option<(i64, String)> = match lock_db(&conn)?.query_row(
        "SELECT id, password FROM users WHERE name = ?1",
        params![username],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ) {
        Ok(record) => Some(record),
        Err(rusqlite::Error::QueryReturnedNoRows) => None,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    let Some((user_id, stored_password)) = user_record else {
        record_failure(&username);
        return Err(StatusCode::UNAUTHORIZED);
    };

    let verification =
        tokio::task::spawn_blocking(move || password::verify(&password, &stored_password))
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let conn_guard = lock_db(&conn)?;
    match verification {
        Verification::Invalid => {
            record_failure(&username);
            return Err(StatusCode::UNAUTHORIZED);
        }
        Verification::Upgrade(hash) => {
            if let Err(err) = conn_guard.execute(
                "UPDATE users SET password = ?1 WHERE id = ?2",
                params![hash, user_id],
            ) {
                eprintln!("Error upgrading password hash for user {user_id}: {err}");
            }
        }
        Verification::Valid => {}
    }
    clear_failures(&username);

    let versions = token::user_token_versions(&conn_guard, user_id)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    drop(conn_guard);

    let generated_token = token::generate_token(
        user_id,
        Utc::now() + Duration::weeks(SESSION_WEEKS),
        &versions,
        true,
    )
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let cookie = auth::session_cookie(
        &headers,
        &generated_token,
        Duration::weeks(SESSION_WEEKS).num_seconds(),
    );

    let mut response = Json(LoginResponse {
        token: generated_token,
    })
    .into_response();
    response.headers_mut().insert(header::SET_COOKIE, cookie);
    Ok(response)
}

pub async fn logout(State(conn): State<helpers::types::Conn>, headers: HeaderMap) -> Response {
    let claims = auth::request_token(&headers).and_then(|raw| auth::authenticate(&conn, raw));

    if let Some(claims) = claims.filter(|claims| claims.session.is_some()) {
        if let Ok(guard) = conn.lock() {
            if let Err(err) = guard.execute(
                "UPDATE users SET session_version = session_version + 1 WHERE id = ?1",
                params![claims.user_id],
            ) {
                eprintln!("Error ending sessions for user {}: {err}", claims.user_id);
            }
        }
    }

    let mut response = StatusCode::NO_CONTENT.into_response();
    response
        .headers_mut()
        .insert(header::SET_COOKIE, auth::session_cookie(&headers, "", 0));
    response
}
