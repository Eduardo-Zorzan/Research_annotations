mod database;
mod handlers;

use database::default;
use handlers::{assets, home};

use axum::{Router, routing::get};
use rusqlite::Connection;

#[tokio::main]
async fn main() {
    let conn = match Connection::open("my_database.db") {
        Ok(it) => it,
        Err(_err) => return,
    };

    default::create_default_tables(conn);

    let app = Router::new()
        .route("/", get(home::get_home))
        .fallback(assets::static_handler);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
