use argon2::{
    Argon2, PasswordHash, PasswordHasher, PasswordVerifier,
    password_hash::{SaltString, rand_core::OsRng},
};

use crate::helpers::encryption::{CryptoService, Keys};

pub enum Verification {
    Invalid,
    Valid,
    Upgrade(String),
}

pub fn hash(password: &str) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|err| format!("Failed to hash password: {err}").into())
}

pub fn verify(password: &str, stored: &str) -> Verification {
    if stored.starts_with("$argon2") {
        let matches = PasswordHash::new(stored)
            .map(|parsed| {
                Argon2::default()
                    .verify_password(password.as_bytes(), &parsed)
                    .is_ok()
            })
            .unwrap_or(false);
        return if matches {
            Verification::Valid
        } else {
            Verification::Invalid
        };
    }

    let Some(legacy) = CryptoService::shared(Keys::Login) else {
        return Verification::Invalid;
    };
    let Ok(decrypted) = legacy.decrypt(stored.to_string()) else {
        return Verification::Invalid;
    };
    if !constant_time_eq(decrypted.as_bytes(), password.as_bytes()) {
        return Verification::Invalid;
    }

    match hash(password) {
        Ok(upgraded) => Verification::Upgrade(upgraded),
        Err(_) => Verification::Valid,
    }
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    a.len() == b.len() && a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}
