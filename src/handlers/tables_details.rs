use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};

use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::helpers::{self, encryption::CryptoService};

#[derive(Serialize, Deserialize, Debug)]
pub struct TableDetailsReturn {
    pub id: String,
    pub table_id: String,
    pub annotation: Option<String>,
    pub name: String,
    pub link: Option<String>,
    pub position: Option<i32>,
}

#[derive(Deserialize, Debug)]
pub struct TableDetails {
    pub id: Option<String>,
    pub table_id: Option<String>,
    pub annotation: Option<String>,
    pub name: String,
    pub link: Option<String>,
}

#[derive(Deserialize, Debug)]
pub struct DeleteTableDetailsPayload {
    pub id: Option<String>,
    pub ids: Option<Vec<String>>,
}

#[derive(Deserialize, Debug)]
pub struct ReorderTableDetailsPayload {
    pub table_id: String,
    pub ids: Vec<String>,
}

#[axum::debug_handler]
pub async fn get(
    State(conn): State<helpers::types::Conn>,
    Path(table_id): Path<String>,
) -> Result<Json<Vec<TableDetailsReturn>>, StatusCode> {
    let Ok(_conn) = conn.lock() else {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    };

    let crypto_service = match CryptoService::new(helpers::encryption::Keys::Token) {
        Ok(crypto) => crypto,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    let table_id_decrypted: String = match crypto_service.decrypt(table_id) {
        Ok(t_id) => t_id,
        Err(_) => return Err(StatusCode::FORBIDDEN),
    };

    let mut stmt = match _conn.prepare(
        "
            SELECT id, table_id, annotation, name, link, position
            FROM table_details
            WHERE table_id = ?1
            ORDER BY position ASC, id ASC
        ",
    ) {
        Ok(stmt) => stmt,
        Err(err) => {
            println!("Error on prepare select table_details: {}", err);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    let rows = match stmt.query_map(params![table_id_decrypted], |row| {
        Ok((
            row.get::<_, i32>(0)?,
            row.get::<_, i32>(1)?,
            row.get::<_, Option<String>>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, Option<String>>(4)?,
            row.get::<_, Option<i32>>(5)?,
        ))
    }) {
        Ok(rows) => rows,
        Err(err) => {
            println!("Error querying table_details: {}", err);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    let mut details = Vec::new();
    for row in rows {
        let (id, t_id, annotation, name, link, position) = match row {
            Ok(data) => data,
            Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
        };
        let id_encrypted = match crypto_service.encrypt(id.to_string()) {
            Ok(enc) => enc,
            Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
        };
        let table_id_encrypted = match crypto_service.encrypt(t_id.to_string()) {
            Ok(enc) => enc,
            Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
        };
        details.push(TableDetailsReturn {
            id: id_encrypted,
            table_id: table_id_encrypted,
            annotation,
            name,
            link,
            position,
        });
    }

    Ok(Json(details))
}

#[axum::debug_handler]
pub async fn post(
    State(conn): State<helpers::types::Conn>,
    Json(payload): Json<TableDetails>,
) -> Result<(StatusCode, Json<TableDetailsReturn>), StatusCode> {
    let Ok(_conn) = conn.lock() else {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    };

    let crypto_service = match CryptoService::new(helpers::encryption::Keys::Token) {
        Ok(crypto) => crypto,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    let Some(table_id_enc) = payload.table_id else {
        return Err(StatusCode::BAD_REQUEST);
    };

    let table_id_decrypted: String = match crypto_service.decrypt(table_id_enc) {
        Ok(t_id) => t_id,
        Err(_) => return Err(StatusCode::FORBIDDEN),
    };

    let next_position: i32 = _conn
        .query_row(
            "SELECT COALESCE(MAX(position), 0) + 1 FROM table_details WHERE table_id = ?1",
            params![table_id_decrypted],
            |row| row.get(0),
        )
        .unwrap_or(1);

    match _conn.query_row(
        "
            INSERT INTO table_details (table_id, annotation, name, link, creation_date, position)
            VALUES (?1, ?2, ?3, ?4, datetime('now'), ?5)
            RETURNING id, position
        ",
        params![
            table_id_decrypted,
            payload.annotation,
            payload.name,
            payload.link,
            next_position
        ],
        |row| Ok((row.get::<_, i32>(0)?, row.get::<_, i32>(1)?)),
    ) {
        Ok((id, returned_position)) => {
            let id_encrypted = match crypto_service.encrypt(id.to_string()) {
                Ok(enc) => enc,
                Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
            };
            let table_id_encrypted = match crypto_service.encrypt(table_id_decrypted) {
                Ok(enc) => enc,
                Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
            };
            Ok((
                StatusCode::CREATED,
                Json(TableDetailsReturn {
                    id: id_encrypted,
                    table_id: table_id_encrypted,
                    annotation: payload.annotation,
                    name: payload.name,
                    link: payload.link,
                    position: Some(returned_position),
                }),
            ))
        }
        Err(_err) => {
            println!("Error on insert table_details, error: {}", _err);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

#[axum::debug_handler]
pub async fn put(
    State(conn): State<helpers::types::Conn>,
    Json(payload): Json<TableDetails>,
) -> Result<StatusCode, StatusCode> {
    let Ok(_conn) = conn.lock() else {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    };

    let crypto_service = match CryptoService::new(helpers::encryption::Keys::Token) {
        Ok(crypto) => crypto,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    let Some(id_enc) = payload.id else {
        return Err(StatusCode::BAD_REQUEST);
    };

    let id_decrypted: String = match crypto_service.decrypt(id_enc) {
        Ok(id) => id,
        Err(_) => return Err(StatusCode::BAD_REQUEST),
    };

    match _conn.execute(
        "
            UPDATE table_details
            SET annotation = ?1, name = ?2, link = ?3
            WHERE id = ?4
        ",
        params![payload.annotation, payload.name, payload.link, id_decrypted],
    ) {
        Ok(0) => Err(StatusCode::NOT_FOUND),
        Ok(_) => Ok(StatusCode::OK),
        Err(_err) => {
            println!("Error on update table_details, error: {}", _err);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

#[axum::debug_handler]
pub async fn reorder(
    State(conn): State<helpers::types::Conn>,
    Json(payload): Json<ReorderTableDetailsPayload>,
) -> Result<StatusCode, StatusCode> {
    let Ok(mut _conn) = conn.lock() else {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    };

    let crypto_service = match CryptoService::new(helpers::encryption::Keys::Token) {
        Ok(crypto) => crypto,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    let table_id_decrypted: String = match crypto_service.decrypt(payload.table_id) {
        Ok(t_id) => t_id,
        Err(_) => return Err(StatusCode::BAD_REQUEST),
    };

    let mut decrypted_ids = Vec::new();
    for id_enc in payload.ids {
        let id_decrypted: String = match crypto_service.decrypt(id_enc) {
            Ok(id) => id,
            Err(_) => return Err(StatusCode::BAD_REQUEST),
        };
        decrypted_ids.push(id_decrypted);
    }

    let tx = match _conn.transaction() {
        Ok(tx) => tx,
        Err(err) => {
            println!("Error starting transaction for reorder: {}", err);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    for (index, id) in decrypted_ids.iter().enumerate() {
        let pos = (index + 1) as i32;
        if let Err(err) = tx.execute(
            "UPDATE table_details SET position = ?1 WHERE id = ?2 AND table_id = ?3",
            params![pos, id, table_id_decrypted],
        ) {
            println!("Error updating position for id {}: {}", id, err);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    }

    if let Err(err) = tx.commit() {
        println!("Error committing reorder transaction: {}", err);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    Ok(StatusCode::OK)
}

#[axum::debug_handler]
pub async fn delete(
    State(conn): State<helpers::types::Conn>,
    Json(payload): Json<DeleteTableDetailsPayload>,
) -> Result<StatusCode, StatusCode> {
    let Ok(mut _conn) = conn.lock() else {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    };

    let crypto_service = match CryptoService::new(helpers::encryption::Keys::Token) {
        Ok(crypto) => crypto,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    let mut ids_to_delete: Vec<String> = Vec::new();
    if let Some(id_enc) = payload.id {
        let id_decrypted: String = match crypto_service.decrypt(id_enc) {
            Ok(id) => id,
            Err(_) => return Err(StatusCode::BAD_REQUEST),
        };
        ids_to_delete.push(id_decrypted);
    }
    if let Some(ids_enc) = payload.ids {
        for id_enc in ids_enc {
            let id_decrypted: String = match crypto_service.decrypt(id_enc) {
                Ok(id) => id,
                Err(_) => return Err(StatusCode::BAD_REQUEST),
            };
            ids_to_delete.push(id_decrypted);
        }
    }

    if ids_to_delete.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let tx = match _conn.transaction() {
        Ok(tx) => tx,
        Err(err) => {
            println!("Error starting transaction: {}", err);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    for id in ids_to_delete {
        if let Err(err) = tx.execute("DELETE FROM table_details WHERE id = ?1", params![id]) {
            println!("Error deleting table_details id {}: {}", id, err);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    }

    if let Err(err) = tx.commit() {
        println!("Error committing delete transaction: {}", err);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    Ok(StatusCode::OK)
}
