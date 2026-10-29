use rusqlite::Connection;

use crate::helpers::types::Conn;

pub fn create_default_tables(conn: &Conn) {
    let Ok(conn) = conn.lock() else {
        return;
    };
    if let Err(err) = migrate(&conn) {
        eprintln!("Error preparing database schema: {err}");
    }
}

fn migrate(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS users (
                id INTEGER NOT NULL PRIMARY KEY,
                name TEXT NOT NULL,
                password TEXT NOT NULL,
                token_version INTEGER NOT NULL DEFAULT 0,
                session_version INTEGER NOT NULL DEFAULT 0
            );

        CREATE TABLE IF NOT EXISTS tables (
                id INTEGER NOT NULL PRIMARY KEY,
                description TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                position INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (user_id)
                    REFERENCES users(id)
                    ON DELETE NO ACTION
                    ON UPDATE NO ACTION
            );

        CREATE TABLE IF NOT EXISTS table_details (
                id INTEGER NOT NULL PRIMARY KEY,
                table_id INTEGER NOT NULL,
                annotation TEXT NULL,
                name TEXT NOT NULL,
                link TEXT NULL,
                creation_date TEXT NOT NULL,
                position INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (table_id)
                    REFERENCES tables(id)
                    ON DELETE CASCADE
                    ON UPDATE NO ACTION
            );

        CREATE TABLE IF NOT EXISTS backups (
                id INTEGER NOT NULL PRIMARY KEY,
                user_id INTEGER NOT NULL UNIQUE,
                created_at TEXT NOT NULL,
                file_path TEXT NOT NULL,
                FOREIGN KEY (user_id)
                    REFERENCES users(id)
                    ON DELETE CASCADE
                    ON UPDATE NO ACTION
            );
        ",
    )?;

    add_column_if_missing(conn, "users", "token_version", "INTEGER NOT NULL DEFAULT 0")?;
    add_column_if_missing(conn, "users", "session_version", "INTEGER NOT NULL DEFAULT 0")?;

    Ok(())
}

fn add_column_if_missing(
    conn: &Connection,
    table: &str,
    column: &str,
    definition: &str,
) -> rusqlite::Result<()> {
    let exists = conn
        .prepare(&format!("SELECT 1 FROM pragma_table_info('{table}') WHERE name = ?1"))?
        .exists([column])?;
    if !exists {
        conn.execute(&format!("ALTER TABLE {table} ADD COLUMN {column} {definition}"), [])?;
    }
    Ok(())
}
