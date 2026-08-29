use crate::helpers::{routes::GET_LOGIN, token};
use axum::{
    extract::Request,
    http::{StatusCode, header},
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

pub async fn auth_middleware(mut request: Request, next: Next) -> Response {
    let cookie_header = request
        .headers()
        .get(header::COOKIE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    let token_from_cookie = cookie_header.split(';').find_map(|cookie| {
        let mut parts = cookie.trim().splitn(2, '=');
        let name = parts.next()?;
        let val = parts.next()?;
        if name == "token" {
            Some(url_decode(val))
        } else {
            None
        }
    });

    let token_from_header = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .map(|raw| url_decode(raw.strip_prefix("Bearer ").unwrap_or(raw)));

    let token_str = token_from_cookie.or(token_from_header);

    let is_page_request = request
        .headers()
        .get(header::ACCEPT)
        .and_then(|v| v.to_str().ok())
        .map(|v| v.contains("text/html"))
        .unwrap_or(false);

    let Some(raw_token) = token_str else {
        if is_page_request {
            return Redirect::to(GET_LOGIN).into_response();
        }
        return StatusCode::UNAUTHORIZED.into_response();
    };

    let user_id = match token::verify_token(raw_token) {
        Ok(id) => id,
        Err(_) => {
            if is_page_request {
                return Redirect::to(GET_LOGIN).into_response();
            }
            return StatusCode::UNAUTHORIZED.into_response();
        }
    };

    request.extensions_mut().insert(AuthUser { user_id });

    next.run(request).await
}
