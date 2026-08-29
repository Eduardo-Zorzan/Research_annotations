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

pub async fn upload_image(
    Extension(auth_user): Extension<AuthUser>,
    mut multipart: Multipart,
) -> Result<(StatusCode, Json<UploadSuccessResponse>), (StatusCode, Json<UploadErrorResponse>)> {
    let mut saved_url: Option<String> = None;

    while let Ok(Some(field)) = multipart.next_field().await {
        let field_name = field.name().unwrap_or("").to_string();
        if field_name == "image" || field_name == "file" || field_name == "upload" {
            let original_name = field.file_name().unwrap_or("image.webp").to_string();
            let ext = Path::new(&original_name)
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("webp")
                .to_lowercase();

            let safe_ext = match ext.as_str() {
                "png" => "png",
                "jpg" | "jpeg" => "jpg",
                "webp" => "webp",
                "gif" => "gif",
                "svg" => "svg",
                _ => "webp",
            };

            let bytes = match field.bytes().await {
                Ok(b) => b,
                Err(_) => {
                    return Err((
                        StatusCode::BAD_REQUEST,
                        Json(UploadErrorResponse {
                            success: 0,
                            message: "Failed to read uploaded image bytes".to_string(),
                        }),
                    ));
                }
            };

            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos();
            let timestamp = Utc::now().timestamp_millis();
            let filename = format!("img_{}_{:x}.{}", timestamp, now & 0xFFFFFF, safe_ext);

            let dir_path = format!("uploads/{}", auth_user.user_id);
            if let Err(_) = std::fs::create_dir_all(&dir_path) {
                return Err((
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(UploadErrorResponse {
                        success: 0,
                        message: "Failed to create uploads directory".to_string(),
                    }),
                ));
            }

            let file_path = format!("{}/{}", dir_path, filename);
            if let Err(_) = std::fs::write(&file_path, &bytes) {
                return Err((
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(UploadErrorResponse {
                        success: 0,
                        message: "Failed to write image file".to_string(),
                    }),
                ));
            }

            saved_url = Some(format!("/uploads/{}/{}", auth_user.user_id, filename));
            break;
        }
    }

    let Some(url) = saved_url else {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(UploadErrorResponse {
                success: 0,
                message: "No image file provided in multipart form data".to_string(),
            }),
        ));
    };

    Ok((
        StatusCode::OK,
        Json(UploadSuccessResponse {
            success: 1,
            file: UploadFileObj { url },
        }),
    ))
}

pub async fn serve_image(
    Extension(auth_user): Extension<AuthUser>,
    AxumPath((user_id, filename)): AxumPath<(String, String)>,
) -> Result<Response, StatusCode> {
    if auth_user.user_id.to_string() != user_id {
        return Err(StatusCode::FORBIDDEN);
    }

    if filename.contains('/') || filename.contains('\\') || filename.contains("..") {
        return Err(StatusCode::BAD_REQUEST);
    }

    let file_path = format!("uploads/{}/{}", user_id, filename);
    let path = Path::new(&file_path);

    if !path.exists() || !path.is_file() {
        return Err(StatusCode::NOT_FOUND);
    }

    let bytes = match std::fs::read(path) {
        Ok(b) => b,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    let mime = mime_guess::from_path(path).first_or_octet_stream();

    let mut response = bytes.into_response();
    if let Ok(mime_val) = HeaderValue::from_str(mime.as_ref()) {
        response.headers_mut().insert(header::CONTENT_TYPE, mime_val);
    }
    response.headers_mut().insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("private, max-age=31536000, immutable"),
    );

    Ok(response)
}

