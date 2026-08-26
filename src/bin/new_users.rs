use rusqlite::Connection;
use rusqlite::params;
use std::env;
use std::io::{self, Write};
use std::sync::{Arc, Mutex};

use Project_tables::database::default;
use Project_tables::helpers::encryption::{CryptoService, Keys};
use Project_tables::helpers::types::Conn;

fn prompt(message: &str) -> String {
    print!("{message}");
    io::stdout().flush().unwrap();
    let mut input = String::new();
    io::stdin().read_line(&mut input).unwrap();
    input.trim().to_string()
}

fn main() {
    let args: Vec<String> = env::args().collect();

    let (login, password) = if args.len() >= 3 {
        (args[1].trim().to_string(), args[2].clone())
    } else {
        println!("=== Research Annotations — Create User CLI ===");
        let input_login = prompt("Enter login/username: ");
        let input_password = prompt("Enter password: ");
        (input_login, input_password)
    };

    if login.is_empty() {
        eprintln!("Error: Login cannot be empty.");
        std::process::exit(1);
    }

    if password.is_empty() {
        eprintln!("Error: Password cannot be empty.");
        std::process::exit(1);
    }

    let conn: Conn = Arc::new(Mutex::new(
        Connection::open("my_database.db").expect("Failed to open database connection"),
    ));

    default::create_default_tables(&conn);

    let user_exists: bool = {
        let db = conn.lock().unwrap();
        let mut stmt = db
            .prepare("SELECT 1 FROM users WHERE name = ?1")
            .expect("Failed to prepare user check query");
        stmt.exists([&login]).unwrap_or(false)
    };

    if user_exists {
        eprintln!("Error: User '{login}' already exists in the database.");
        std::process::exit(1);
    }

    let crypto_service = match CryptoService::new(Keys::Login) {
        Ok(service) => service,
        Err(err) => {
            eprintln!("Error initializing encryption service: {err}");
            std::process::exit(1);
        }
    };

    let encrypted_password = match crypto_service.encrypt(password) {
        Ok(encrypted) => encrypted,
        Err(err) => {
            eprintln!("Error encrypting password: {err}");
            std::process::exit(1);
        }
    };

    let user_id = {
        let db = conn.lock().unwrap();
        db.execute(
            "INSERT INTO users (name, password) VALUES (?1, ?2)",
            params![&login, &encrypted_password],
        )
        .expect("Failed to insert new user into database");
        db.last_insert_rowid()
    };

    println!("User registered successfully!");
    println!("User ID: {user_id}");
    println!("Login:   {login}");
}
