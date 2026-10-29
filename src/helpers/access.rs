use std::sync::MutexGuard;

use axum::http::StatusCode;
use rusqlite::{Connection, params};

use crate::helpers::{
    encryption::{CryptoService, Keys},
    types::Conn,
};

pub fn lock_db(conn: &Conn) -> Result<MutexGuard<'_, Connection>, StatusCode> {
    conn.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

pub fn db_error(context: &str, err: rusqlite::Error) -> StatusCode {
    eprintln!("{context}: {err}");
    StatusCode::INTERNAL_SERVER_ERROR
}

fn id_cipher() -> Result<&'static CryptoService, StatusCode> {
    CryptoService::shared(Keys::Token).ok_or(StatusCode::INTERNAL_SERVER_ERROR)
}

pub fn encrypt_id(id: i64) -> Result<String, StatusCode> {
    id_cipher()?
        .encrypt(id.to_string())
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

pub fn decrypt_id(encrypted: String) -> Result<i64, StatusCode> {
    id_cipher()?
        .decrypt(encrypted)
        .ok()
        .and_then(|id| id.trim().parse::<i64>().ok())
        .ok_or(StatusCode::BAD_REQUEST)
}

pub fn ensure_table_owner(conn: &Connection, table_id: i64, user_id: i64) -> Result<(), StatusCode> {
    match conn
        .prepare_cached("SELECT 1 FROM tables WHERE id = ?1 AND user_id = ?2")
        .and_then(|mut stmt| stmt.exists(params![table_id, user_id]))
    {
        Ok(true) => Ok(()),
        Ok(false) => Err(StatusCode::NOT_FOUND),
        Err(err) => Err(db_error("Error checking table ownership", err)),
    }
}
