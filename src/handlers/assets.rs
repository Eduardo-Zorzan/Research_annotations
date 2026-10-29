use axum::{
    body::Body,
    http::{Response, StatusCode, Uri, header},
    response::{Html, IntoResponse},
};
use rust_embed::Embed;

#[derive(Embed)]
#[folder = "public"]
pub struct Asset;

pub fn html_page(path: &str) -> Html<Vec<u8>> {
    match Asset::get(path) {
        Some(content) => Html(content.data.into_owned()),
        None => Html(b"<h1>Not Found</h1>".to_vec()),
    }
}

pub async fn static_handler(uri: Uri) -> impl IntoResponse {
    let path = uri.path().trim_start_matches('/');

    match Asset::get(path).filter(|_| !path.starts_with("html/")) {
        Some(content) => {
            let mime = mime_guess::from_path(path).first_or_octet_stream();
            Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, mime.as_ref())
                .body(Body::from(content.data))
                .unwrap()
        }
        None => Response::builder()
            .status(StatusCode::NOT_FOUND)
            .header(header::CONTENT_TYPE, "text/plain")
            .body(Body::from("404 Not Found"))
            .unwrap(),
    }
}
