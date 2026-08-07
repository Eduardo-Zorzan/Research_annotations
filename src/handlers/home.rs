use axum::response::{Html, IntoResponse};
use rust_embed::Embed;

#[derive(Embed)]
#[folder = "public"]
struct Asset;

pub async fn get_home() -> impl IntoResponse {
    match Asset::get("html/home.html") {
        Some(content) => Html(content.data.into_owned()),
        None => Html(b"<h1>Not Found</h1>".to_vec()),
    }
}
