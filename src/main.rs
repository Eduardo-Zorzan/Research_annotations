mod database;
mod handlers;
mod helpers;

use std::sync::{Arc, Mutex};

use database::default;
use handlers::{assets, auth, home, login, tables, tables_details};

use axum::{
    Router,
    routing::{get, post, put},
};
use rusqlite::Connection;

use crate::helpers::{
    routes::{
        GET_HOME, GET_LOGIN, GET_TABLE_DETAILS, GET_TABLES, LOGIN, REORDER_TABLE_DETAILS,
        REORDER_TABLES, TABLE_DETAILS, TABLES,
    },
    types::Conn,
};

#[tokio::main]
async fn main() {
    let conn: Conn = Arc::new(Mutex::new(Connection::open("my_database.db").unwrap()));

    default::create_default_tables(&conn);

    let protected_routes = Router::new()
        .route(GET_HOME, get(home::get_home))
        .route(GET_TABLES, get(tables::get))
        .route(
            TABLES,
            post(tables::post).put(tables::put).delete(tables::delete),
        )
        .route(REORDER_TABLES, put(tables::reorder))
        .route(GET_TABLE_DETAILS, get(tables_details::get))
        .route(
            TABLE_DETAILS,
            post(tables_details::post)
                .put(tables_details::put)
                .delete(tables_details::delete),
        )
        .route(REORDER_TABLE_DETAILS, put(tables_details::reorder))
        .layer(axum::middleware::from_fn(auth::auth_middleware));

    let app = Router::new()
        .merge(protected_routes)
        .route(GET_LOGIN, get(login::get_login))
        .route(LOGIN, post(login::post))
        .with_state(conn)
        .fallback(assets::static_handler);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
