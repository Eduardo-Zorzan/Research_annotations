mod database;
mod handlers;
mod helpers;

use std::sync::{Arc, Mutex};

use database::default;
use handlers::{assets, home, tables};

use axum::{
    Router,
    routing::{get, post},
};
use rusqlite::Connection;

use crate::helpers::{
    routes::{GET_HOME, GET_TABLES, TABLES},
    types::Conn,
};

#[tokio::main]
async fn main() {
    let conn: Conn = Arc::new(Mutex::new(Connection::open("my_database.db").unwrap()));

    default::create_default_tables(&conn);

    let app = Router::new()
        .route(GET_TABLES, get(tables::get))
        .route(
            TABLES,
            post(tables::post).put(tables::put).delete(tables::delete),
        )
        .route(GET_HOME, get(home::get_home))
        .with_state(conn)
        .fallback(assets::static_handler);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
