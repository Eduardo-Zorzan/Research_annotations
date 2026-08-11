use std::sync::{Arc, Mutex};

use rusqlite::Connection;

pub type Conn = Arc<Mutex<Connection>>;
