use crate::helpers::{
    routes::GET_LOGIN,
    token::{self, Token},
    types::Conn,
};
use axum::{
    extract::{Request, State},
    http::{HeaderMap, HeaderValue, StatusCode, header},
    middleware::Next,
    response::{IntoResponse, Redirect, Response},
};

#[derive(Clone, Debug)]
pub struct AuthUser {
    pub user_id: i64,
}

fn url_decode(input: &str) -> String {
    let mut output = Vec::with_capacity(input.len());
    let bytes = input.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(byte) =
                u8::from_str_radix(std::str::from_utf8(&bytes[i + 1..i + 3]).unwrap_or(""), 16)
            {
                output.push(byte);
                i += 3;
                continue;
            }
        }
        output.push(bytes[i]);
        i += 1;
    }
    String::from_utf8(output).unwrap_or_else(|_| input.to_string())
}

pub fn request_token(headers: &HeaderMap) -> Option<String> {
    let token_from_header = headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .map(|raw| url_decode(raw.strip_prefix("Bearer ").unwrap_or(raw)));

    token_from_header.or_else(|| {
        headers
            .get(header::COOKIE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .split(';')
            .find_map(|cookie| {
                let (name, val) = cookie.trim().split_once('=')?;
                (name == "token").then(|| url_decode(val))
            })
    })
}

pub fn authenticate(conn: &Conn, raw_token: String) -> Option<Token> {
    let claims = token::verify_token(raw_token).ok()?;
    let guard = conn.lock().ok()?;
    let versions = token::user_token_versions(&guard, claims.user_id).ok()?;
    token::is_token_current(&claims, &versions).then_some(claims)
}

pub fn session_cookie(headers: &HeaderMap, value: &str, max_age_secs: i64) -> HeaderValue {
    let is_https = headers
        .get("x-forwarded-proto")
        .and_then(|v| v.to_str().ok())
        .is_some_and(|proto| proto.eq_ignore_ascii_case("https"));
    let secure = if is_https { "; Secure" } else { "" };
    HeaderValue::from_str(&format!(
        "token={value}; Path=/; Max-Age={max_age_secs}; HttpOnly; SameSite=Lax{secure}"
    ))
    .unwrap_or_else(|_| HeaderValue::from_static("token=; Path=/; Max-Age=0"))
}

pub async fn auth_middleware(State(conn): State<Conn>, mut request: Request, next: Next) -> Response {
    let user_id = request_token(request.headers())
        .and_then(|raw_token| authenticate(&conn, raw_token))
        .map(|claims| claims.user_id);

    let Some(user_id) = user_id else {
        let is_page_request = request
            .headers()
            .get(header::ACCEPT)
            .and_then(|v| v.to_str().ok())
            .is_some_and(|v| v.contains("text/html"));
        if is_page_request {
            return Redirect::to(GET_LOGIN).into_response();
        }
        return StatusCode::UNAUTHORIZED.into_response();
    };

    request.extensions_mut().insert(AuthUser { user_id });

    next.run(request).await
}
