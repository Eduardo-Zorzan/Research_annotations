use crate::helpers::types::Conn;

pub fn create_default_tables(conn: &Conn) {
    match conn.lock().unwrap().execute_batch(
        "
        CREATE TABLE IF NOT EXISTS users (
                id INTEGER NOT NULL PRIMARY KEY,
                name TEXT NOT NULL,
                password TEXT NOT NULL
            );

        CREATE TABLE IF NOT EXISTS tokens (
                id INTEGER NOT NULL PRIMARY KEY,
                token TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                expiration_date TEXT NOT NULL,
                FOREIGN KEY (user_id)
                    REFERENCES users(id)
                    ON DELETE CASCADE
                    ON UPDATE NO ACTION
            );

        CREATE TABLE IF NOT EXISTS tables (
                id INTEGER NOT NULL PRIMARY KEY,
                description TEXT NOT NULL,
                user_id INTEGER NOT NULL,
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
        ",
    ) {
        Ok(it) => it,
        Err(_) => return,
    }
}
