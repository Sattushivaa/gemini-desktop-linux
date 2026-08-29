//! File persistence: attachment storage, text export and reading local files.

use base64::Engine;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredFile {
    pub path: String,
    pub filename: String,
    pub size: u64,
    pub mime_type: String,
}

fn attachments_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("attachments");
    Ok(dir)
}

fn sanitize_filename(name: &str) -> String {
    let name = name.replace(['/', '\\'], "_");
    let name = name.trim().trim_start_matches('.').to_string();
    if name.is_empty() {
        "attachment".to_string()
    } else {
        name
    }
}

fn infer_mime(path: &Path) -> String {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_default();
    let mime = match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        "svg" => "image/svg+xml",
        "pdf" => "application/pdf",
        "txt" => "text/plain",
        "md" | "markdown" => "text/markdown",
        "csv" => "text/csv",
        "json" => "application/json",
        "html" | "htm" => "text/html",
        "py" => "text/x-python",
        "js" | "mjs" => "text/javascript",
        "ts" | "tsx" => "text/typescript",
        "jsx" => "text/jsx",
        "rs" => "text/x-rust",
        "c" | "h" => "text/x-c",
        "cpp" | "cc" | "hpp" => "text/x-c++",
        "go" => "text/x-go",
        "java" => "text/x-java",
        "rb" => "text/x-ruby",
        "php" => "text/x-php",
        "sh" | "bash" | "zsh" => "text/x-shellscript",
        "yaml" | "yml" => "text/yaml",
        "xml" => "text/xml",
        "toml" => "text/toml",
        _ => "application/octet-stream",
    };
    mime.to_string()
}

/// Copies an existing file (e.g. chosen via the file picker or drag-and-drop)
/// into the per-application attachments directory so it survives afterwards.
#[tauri::command]
pub fn save_attachment(
    app: tauri::AppHandle,
    source_path: String,
    filename: Option<String>,
    mime_type: Option<String>,
) -> Result<StoredFile, String> {
    let src = PathBuf::from(&source_path);
    if !src.is_file() {
        return Err(format!("File not found: {source_path}"));
    }
    let name = sanitize_filename(filename.as_deref().unwrap_or_else(|| {
        src.file_name().and_then(|n| n.to_str()).unwrap_or("attachment")
    }));

    let base = attachments_dir(&app)?;
    let folder = uuid_v4();
    let dest_dir = base.join(&folder);
    fs::create_dir_all(&dest_dir).map_err(|e| format!("unable to create attachment dir: {e}"))?;

    let dest = dest_dir.join(&name);
    fs::copy(&src, &dest).map_err(|e| format!("unable to copy file: {e}"))?;

    let size = fs::metadata(&dest).map(|m| m.len()).unwrap_or(0);
    let mime = mime_type.unwrap_or_else(|| infer_mime(&src));

    Ok(StoredFile {
        path: dest.to_string_lossy().into_owned(),
        filename: name,
        size,
        mime_type: mime,
    })
}

/// Saves raw bytes (base64 over IPC) as an attachment. Used for clipboard
/// pastes where there is no source file on disk.
#[tauri::command]
pub fn save_attachment_data(
    app: tauri::AppHandle,
    filename: String,
    data_base64: String,
    mime_type: String,
) -> Result<StoredFile, String> {
    let name = sanitize_filename(&filename);
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data_base64.as_bytes())
        .map_err(|e| format!("invalid base64 payload: {e}"))?;

    let base = attachments_dir(&app)?;
    let dest_dir = base.join(uuid_v4());
    fs::create_dir_all(&dest_dir).map_err(|e| format!("unable to create attachment dir: {e}"))?;

    let dest = dest_dir.join(&name);
    fs::write(&dest, &bytes).map_err(|e| format!("unable to write attachment: {e}"))?;

    Ok(StoredFile {
        path: dest.to_string_lossy().into_owned(),
        filename: name,
        size: bytes.len() as u64,
        mime_type,
    })
}

/// Reads a local text/source file so it can be attached to a prompt.
/// Returns None when the file is not valid UTF-8 or exceeds the size limit.
#[tauri::command]
pub fn read_file_text(path: String, max_bytes: Option<u64>) -> Result<Option<String>, String> {
    let p = PathBuf::from(&path);
    if !p.is_file() {
        return Err(format!("File not found: {path}"));
    }
    let limit = max_bytes.unwrap_or(2 * 1024 * 1024);
    if fs::metadata(&p).map(|m| m.len()).unwrap_or(u64::MAX) > limit {
        return Ok(None);
    }
    let bytes = fs::read(&p).map_err(|e| format!("unable to read file: {e}"))?;
    match String::from_utf8(bytes) {
        Ok(s) => Ok(Some(s)),
        Err(_) => Ok(None),
    }
}

/// Reads a file and returns its base64 (UTF-8 bytes encoded). Used to feed
/// stored attachments (images, PDFs, ...) into Gemini API requests from the
/// webview without exposing the filesystem plugin wide-open.
#[tauri::command]
pub fn read_file_base64(path: String, max_bytes: Option<u64>) -> Result<Option<String>, String> {
    let p = PathBuf::from(&path);
    if !p.is_file() {
        return Err(format!("File not found: {path}"));
    }
    let limit = max_bytes.unwrap_or(64 * 1024 * 1024);
    if fs::metadata(&p).map(|m| m.len()).unwrap_or(u64::MAX) > limit {
        return Ok(None);
    }
    let bytes = fs::read(&p).map_err(|e| format!("unable to read file: {e}"))?;
    Ok(Some(
        base64::engine::general_purpose::STANDARD.encode(bytes),
    ))
}

/// Writes text to an arbitrary path (used for exporting conversations).
#[tauri::command]
pub fn write_text_file(path: String, contents: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if let Some(parent) = p.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent).map_err(|e| format!("unable to create dir: {e}"))?;
        }
    }
    fs::write(&p, contents).map_err(|e| format!("unable to write file: {e}"))
}

fn uuid_v4() -> String {
    let mut buf = [0u8; 16];
    getrandom(&mut buf);
    // set version (4) and variant bits for a proper v4 uuid
    buf[6] = (buf[6] & 0x0f) | 0x40;
    buf[8] = (buf[8] & 0x3f) | 0x80;
    let hex = buf.iter().map(|b| format!("{:02x}", b)).collect::<String>();
    format!(
        "{}-{}-{}-{}-{}",
        &hex[0..8],
        &hex[8..12],
        &hex[12..16],
        &hex[16..20],
        &hex[20..32]
    )
}

fn getrandom(buf: &mut [u8]) {
    use std::sync::atomic::{AtomicBool, Ordering};
    // On Linux try getrandom(2); fall back to a time/pid based mix.
    static WARNED: AtomicBool = AtomicBool::new(false);
    let mut file = match fs::File::open("/dev/urandom") {
        Ok(f) => Some(f),
        Err(_) => None,
    };
    if let Some(f) = file.as_mut() {
        use std::io::Read;
        if f.read_exact(buf).is_ok() {
            return;
        }
    }
    if !WARNED.swap(true, Ordering::Relaxed) {
        eprintln!("warning: /dev/urandom unavailable; using weaker uuid source");
    }
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let pid = std::process::id() as u128;
    let seed = now ^ (pid << 64);
    for (i, b) in buf.iter_mut().enumerate() {
        *b = ((seed >> ((i % 8) * 8)) & 0xff) as u8 ^ (i as u8).wrapping_mul(31);
    }
}