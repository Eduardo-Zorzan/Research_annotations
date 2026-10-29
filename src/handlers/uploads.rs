use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use axum::{
    Json,
    extract::{Extension, Multipart, Path as AxumPath},
    http::{HeaderValue, StatusCode, header},
    response::{IntoResponse, Response},
};
use chrono::Utc;
use serde::Serialize;

use crate::handlers::auth::AuthUser;

const STORED_IMAGE_EXTENSIONS: [&str; 6] = ["png", "jpg", "jpeg", "webp", "gif", "svg"];

#[derive(Serialize)]
pub struct UploadFileObj {
    pub url: String,
}

#[derive(Serialize)]
pub struct UploadSuccessResponse {
    pub success: i32,
    pub file: UploadFileObj,
}

#[derive(Serialize)]
pub struct UploadErrorResponse {
    pub success: i32,
    pub message: String,
}

pub fn user_uploads_dir(user_id: i64) -> String {
    format!("uploads/{user_id}")
}

pub fn is_stored_image_name(filename: &str) -> bool {
    !filename.is_empty()
        && !filename.starts_with('.')
        && !filename.contains(['/', '\\'])
        && !filename.contains("..")
        && Path::new(filename)
            .extension()
            .and_then(|ext| ext.to_str())
            .is_some_and(|ext| STORED_IMAGE_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
}

fn upload_error(status: StatusCode, message: &str) -> (StatusCode, Json<UploadErrorResponse>) {
    (
        status,
        Json(UploadErrorResponse {
            success: 0,
            message: message.to_string(),
        }),
    )
}

pub async fn upload_image(
    Extension(auth_user): Extension<AuthUser>,
    mut multipart: Multipart,
) -> Result<(StatusCode, Json<UploadSuccessResponse>), (StatusCode, Json<UploadErrorResponse>)> {
    while let Ok(Some(field)) = multipart.next_field().await {
        let field_name = field.name().unwrap_or("");
        if field_name != "image" && field_name != "file" && field_name != "upload" {
            continue;
        }

        let ext = Path::new(field.file_name().unwrap_or("image.webp"))
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("webp")
            .to_lowercase();

        let safe_ext = match ext.as_str() {
            "png" => "png",
            "jpg" | "jpeg" => "jpg",
            "gif" => "gif",
            _ => "webp",
        };

        let bytes = field.bytes().await.map_err(|_| {
            upload_error(StatusCode::BAD_REQUEST, "Failed to read uploaded image bytes")
        })?;

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let timestamp = Utc::now().timestamp_millis();
        let filename = format!("img_{}_{:x}.{}", timestamp, now & 0xFFFFFF, safe_ext);

        let dir_path = user_uploads_dir(auth_user.user_id);
        tokio::fs::create_dir_all(&dir_path).await.map_err(|_| {
            upload_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to create uploads directory",
            )
        })?;

        tokio::fs::write(format!("{dir_path}/{filename}"), &bytes)
            .await
            .map_err(|_| {
                upload_error(StatusCode::INTERNAL_SERVER_ERROR, "Failed to write image file")
            })?;

        return Ok((
            StatusCode::OK,
            Json(UploadSuccessResponse {
                success: 1,
                file: UploadFileObj {
                    url: format!("/uploads/{}/{}", auth_user.user_id, filename),
                },
            }),
        ));
    }

    Err(upload_error(
        StatusCode::BAD_REQUEST,
        "No image file provided in multipart form data",
    ))
}

pub async fn serve_image(
    Extension(auth_user): Extension<AuthUser>,
    AxumPath((user_id, filename)): AxumPath<(String, String)>,
) -> Result<Response, StatusCode> {
    if auth_user.user_id.to_string() != user_id {
        return Err(StatusCode::FORBIDDEN);
    }

    if !is_stored_image_name(&filename) {
        return Err(StatusCode::NOT_FOUND);
    }

    let file_path = format!("{}/{}", user_uploads_dir(auth_user.user_id), filename);
    let bytes = match tokio::fs::read(&file_path).await {
        Ok(b) => b,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
            return Err(StatusCode::NOT_FOUND);
        }
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    let mime = mime_guess::from_path(&file_path).first_or_octet_stream();

    let mut response = bytes.into_response();
    let headers = response.headers_mut();
    if let Ok(mime_val) = HeaderValue::from_str(mime.as_ref()) {
        headers.insert(header::CONTENT_TYPE, mime_val);
    }
    headers.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("private, max-age=31536000, immutable"),
    );
    headers.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    headers.insert(
        header::CONTENT_SECURITY_POLICY,
        HeaderValue::from_static("default-src 'none'; style-src 'unsafe-inline'; sandbox"),
    );

    Ok(response)
}
