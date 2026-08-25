use aes_gcm::{
    AeadCore, Aes256Gcm, KeyInit, Nonce,
    aead::{Aead, OsRng},
};
use base64::{Engine, prelude::BASE64_STANDARD};
use dotenvy::dotenv;
use std::env;

const NONCE_SIZE: usize = 12;

pub enum Keys {
    Token,
    Login,
}

impl Keys {
    pub fn as_str(&self) -> &'static str {
        match self {
            Keys::Token => "TOKEN_KEY",
            Keys::Login => "LOGIN_KEY",
        }
    }
}

#[derive(Clone)]
pub struct CryptoService {
    cipher: Aes256Gcm,
}

impl CryptoService {
    pub fn new(key: Keys) -> Result<Self, Box<dyn std::error::Error>> {
        dotenv().ok();

        let key_hex = env::var(key.as_str()).map_err(|_| "Key environment variable is not set")?;
        let key_bytes = hex::decode(key_hex).map_err(|_| "Key must be valid hex")?;

        if key_bytes.len() != 32 {
            return Err("Key must be exactly 32 bytes (64 hex characters)".into());
        }

        let cipher = Aes256Gcm::new_from_slice(&key_bytes)
            .map_err(|e| format!("Failed to create cipher: {e}"))?;

        Ok(Self { cipher })
    }

    pub fn encrypt(&self, plaintext: String) -> Result<String, Box<dyn std::error::Error>> {
        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);

        let mut ciphertext = self
            .cipher
            .encrypt(&nonce, plaintext.as_bytes())
            .map_err(|e| format!("Failed to create cipher: {e}"))?;

        let mut payload = Vec::with_capacity(NONCE_SIZE + ciphertext.len());
        payload.extend_from_slice(&nonce);
        payload.append(&mut ciphertext);

        Ok(BASE64_STANDARD.encode(payload))
    }

    pub fn decrypt(&self, encrypted_base64: String) -> Result<String, Box<dyn std::error::Error>> {
        let payload = BASE64_STANDARD.decode(encrypted_base64)?;

        if payload.len() < NONCE_SIZE + 16 {
            return Err(("Invalid Length").into());
        }

        let (nonce_bytes, ciphertext) = payload.split_at(NONCE_SIZE);
        let nonce = Nonce::from_slice(nonce_bytes);

        let decrypted_bytes = self
            .cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| format!("Failed to decrypt: {e}"))?;

        let plaintext = String::from_utf8(decrypted_bytes)?;
        Ok(plaintext)
    }
}
