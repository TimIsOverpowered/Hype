use std::fs;
use std::path::Path;

use tauri::{Manager, WebviewWindow};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

fn read_package_version() -> Option<String> {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).parent()?;
    let pkg_path = root.join("package.json");
    let content = fs::read_to_string(pkg_path).ok()?;
    let obj: serde_json::Value = serde_json::from_str(&content).ok()?;
    obj["version"].as_str().map(String::from)
}

fn set_window_title(window: &WebviewWindow) {
    if let Some(version) = read_package_version() {
        let title = format!("Hype v{}", version);
        window.set_title(&title).ok();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            set_window_title(&window);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
