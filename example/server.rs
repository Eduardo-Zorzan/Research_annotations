use axum::{
    Router,
    body::Body,
    http::{StatusCode, Uri, header, uri},
    response::{IntoResponse, Response},
    routing::get,
};
use rust_embed::Embed;

#[derive(Embed)]
#[folder = "public"]
struct Asset;

#[tokio::main]
async fn main() {
    // build our application with a single route
    let app = Router::new().route("/home", get(static_handler)).route(
        "/home2",
        get(static_handler)
            .post(static_handler)
            .patch(static_handler),
    );

    // run our app with hyper, listening globally on port 3000
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

// 2. The handler that resolves embedded files
async fn static_handler(uri: Uri) -> impl IntoResponse {
    let mut path = "html/home.html".to_string();

    // Attempt to serve the requested file
    match Asset::get(&path) {
        Some(content) => {
            let mime = mime_guess::from_path(&path).first_or_octet_stream();
            Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, mime.as_ref())
                .body(Body::from(content.data))
                .unwrap()
        }
        None => {
            // SPA Fallback: If file isn't found and request doesn't look like an asset (e.g. no extension),
            // return index.html for client-side routing (React Router, Vue Router, etc.)
            if !path.contains('.') {
                if let Some(content) = Asset::get("home.html") {
                    return Response::builder()
                        .status(StatusCode::OK)
                        .header(header::CONTENT_TYPE, "text/html")
                        .body(Body::from(content.data))
                        .unwrap();
                }
            }
            // Otherwise, return 404
            Response::builder()
                .status(StatusCode::NOT_FOUND)
                .header(header::CONTENT_TYPE, "text/plain")
                .body(Body::from("404 Not Found"))
                .unwrap()
        }
    }
}
