//! Persistent application configuration.
//!
//! The only secret we persist here is the Gemini API key, which is stored in
//! the user's native config directory (outside the webview) with 0600
//! permissions. The `GEMINI_API_KEY` environment variable always takes
//! precedence over the stored value so it can be supplied at launch time
//! without writing anything to disk.

use serde::{Deserialize, Serialize};
use serde_json::json;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

const CONFIG_FILENAME: &str = "config.json";
const ENV_KEY: &str = "GEMINI_API_KEY";

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Config {
    pub api_key: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigResponse {
    pub api_key: Option<String>,
    pub api_key_source: String,
}

fn config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    Ok(dir.join(CONFIG_FILENAME))
}

fn read_config(app: &tauri::AppHandle) -> Config {
    let Ok(path) = config_path(app) else {
        return Config::default();
    };
    fs::read_to_string(path)
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default()
}

fn resolve_api_key(app: &tauri::AppHandle) -> (Option<String>, String) {
    if let Ok(key) = std::env::var(ENV_KEY) {
        let trimmed = key.trim();
        if !trimmed.is_empty() {
            return (Some(trimmed.to_string()), "env".to_string());
        }
    }
    let stored = read_config(app).api_key;
    match stored {
        Some(key) if !key.trim().is_empty() => (Some(key), "config".to_string()),
        _ => (None, "none".to_string()),
    }
}

#[tauri::command]
pub fn get_config(app: tauri::AppHandle) -> Result<ConfigResponse, String> {
    let (api_key, source) = resolve_api_key(&app);
    Ok(ConfigResponse { api_key, api_key_source: source })
}

#[tauri::command]
pub fn set_api_key(app: tauri::AppHandle, key: String) -> Result<(), String> {
    let path = config_path(&app)?;
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| format!("unable to create config dir: {e}"))?;
    }
    let data = serde_json::to_vec(&json!({ "api_key": key.trim() }))
        .map_err(|e| format!("unable to serialize config: {e}"))?;
    fs::write(&path, &data).map_err(|e| format!("unable to write config: {e}"))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&path, fs::Permissions::from_mode(0o600))
            .map_err(|e| format!("unable to secure config file: {e}"))?;
    }
    Ok(())
}