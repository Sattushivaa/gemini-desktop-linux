use serde::Serialize;
use tauri::Manager;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppPaths {
    pub data_dir: String,
    pub config_dir: String,
    pub db_path: String,
    pub attachments_dir: String,
}

#[tauri::command]
pub fn get_app_paths(app: tauri::AppHandle) -> Result<AppPaths, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let config_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    Ok(AppPaths {
        data_dir: data_dir.to_string_lossy().into_owned(),
        config_dir: config_dir.to_string_lossy().into_owned(),
        db_path: data_dir.join("gemini-desktop.db").to_string_lossy().into_owned(),
        attachments_dir: data_dir.join("attachments").to_string_lossy().into_owned(),
    })
}