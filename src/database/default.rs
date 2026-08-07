use rusqlite::Connection;

pub fn create_default_tables(conn: Connection) {
    // Create a table
    match conn.execute(
        "CREATE TABLE IF NOT EXISTS tables (
                id INTEGER PRIMARY KEY,
                description TEXT NOT NULL,
                user_id INTEGER NOT NULL
            )",
        [],
    ) {
        Ok(it) => it,
        Err(_err) => return,
    };
}
