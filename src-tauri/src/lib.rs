use std::fs;
use std::path::Path;

use tauri::{Emitter, Manager, WebviewWindow};
use tauri_plugin_deep_link::DeepLinkExt;

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

fn emit_protocol_event(app: &tauri::AppHandle, url: &tauri::Url) {
    let parsed = if url.as_str().starts_with("hype://") {
        url.as_str().strip_prefix("hype://").unwrap_or(url.as_str()).to_string()
    } else {
        url.as_str().to_string()
    };

    if let Err(e) = app.emit("protocol-uri", &parsed) {
        eprintln!("Failed to emit protocol event: {}", e);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![greet]);

    #[cfg(desktop)]
    {
        builder = builder.plugin(
            tauri_plugin_single_instance::init(|app, args, _cwd| {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_focus();
                }

                for arg in args {
                    if arg.starts_with("hype://") {
                        let url = tauri::Url::parse(&arg).ok();
                        if let Some(url) = url {
                            emit_protocol_event(app, &url);
                        }
                    }
                }
            }),
        );
    }

    builder
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            set_window_title(&window);

            #[cfg(any(windows, target_os = "linux"))]
            {
                app.deep_link().register_all()?;
            }

            if let Some(urls) = app.deep_link().get_current()? {
                if let Some(first_url) = urls.first() {
                    emit_protocol_event(app.handle(), first_url);
                }
            }

            let app_handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                for url in event.urls() {
                    emit_protocol_event(&app_handle, &url);
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
