mod commands;

use tauri_plugin_sql::Migration;
use tauri_plugin_sql::MigrationKind;

const MIGRATIONS: [Migration; 1] = [Migration {
    version: 1,
    description: "create_initial_tables",
    sql: include_str!("../migrations/0001_init.sql"),
    kind: MigrationKind::Up,
}];

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:gemini-desktop.db", MIGRATIONS.into_iter().collect())
                .build(),
        )
        .setup(|app| {
            use tauri::Manager;
            if let Ok(dir) = app.path().app_data_dir() {
                let _ = std::fs::create_dir_all(dir);
            }
            if let Ok(dir) = app.path().app_config_dir() {
                let _ = std::fs::create_dir_all(dir);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::config::get_config,
            commands::config::set_api_key,
            commands::files::save_attachment,
            commands::files::save_attachment_data,
            commands::files::read_file_text,
            commands::files::read_file_base64,
            commands::files::write_text_file,
            commands::files::check_is_file,
            commands::paths::get_app_paths,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}