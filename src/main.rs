mod database;
mod handlers;
mod helpers;

use std::sync::{Arc, Mutex};

use database::default;
use handlers::{assets, auth, backup, home, login, tables, tables_details, tokens};

use axum::{
    Router,
    routing::{get, post, put},
};
use rusqlite::Connection;

use crate::helpers::{
    routes::{
        BACKUP_DOWNLOAD, BACKUP_GENERATE, BACKUP_IMPORT, BACKUP_INFO, GET_HOME, GET_LOGIN,
        GET_TABLE_DETAILS, GET_TABLES, LOGIN, REORDER_TABLE_DETAILS, REORDER_TABLES, TABLE_DETAILS,
        TABLES, TOKENS,
    },
    types::Conn,
};

#[tokio::main]
async fn main() {
    let conn: Conn = Arc::new(Mutex::new(Connection::open("my_database.db").unwrap()));

    default::create_default_tables(&conn);

    create_backup_routine(conn.clone());

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
        .route(BACKUP_INFO, get(backup::get_info))
        .route(BACKUP_GENERATE, post(backup::generate))
        .route(BACKUP_DOWNLOAD, get(backup::download))
        .route(BACKUP_IMPORT, post(backup::import))
        .route(TOKENS, post(tokens::create_token))
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

fn create_backup_routine(conn: Conn) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(3600));
        loop {
            interval.tick().await;
            if let Ok(guard) = conn.lock() {
                let user_ids: Vec<i64> = match guard.prepare("SELECT id FROM users") {
                    Ok(mut stmt) => match stmt.query_map([], |row| row.get(0)) {
                        Ok(rows) => rows.filter_map(Result::ok).collect(),
                        Err(_) => Vec::new(),
                    },
                    Err(_) => Vec::new(),
                };
                for uid in user_ids {
                    let _ = backup::perform_backup_for_user(&guard, uid);
                }
            }
        }
    });
}
