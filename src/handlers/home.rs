use axum::response::IntoResponse;

use crate::handlers::assets;

pub async fn get_home() -> impl IntoResponse {
    assets::html_page("html/home.html")
}
