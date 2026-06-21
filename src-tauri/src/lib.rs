use std::fs;
use std::path::Path;

use tauri::{AppHandle, Manager, WebviewWindow};

mod logs;
mod media;
mod proxy;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

use crate::media::chat::emotes::init_channel_emotes;
use crate::media::chat::twitch::{fetch_and_parse_comments, ChatBatchResponse};

#[tauri::command]
async fn init_chat_session(broadcaster_id: String) -> Result<(), String> {
    init_channel_emotes(&broadcaster_id).await
}

#[tauri::command]
async fn fetch_chat_batch(
    vod_id: String,
    broadcaster_id: String,
    offset_seconds: Option<f64>,
    cursor: Option<String>,
) -> Result<ChatBatchResponse, String> {
    fetch_and_parse_comments(&vod_id, &broadcaster_id, offset_seconds, cursor).await
}

#[tauri::command]
fn show_window(app: AppHandle) -> Result<(), ()> {
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.set_focus();
    }
    Ok(())
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
pub fn run(debug: bool) {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        // single-instance MUST be registered first
        builder = builder.plugin(
            tauri_plugin_single_instance::init(|app, _argv, _cwd| {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_focus();
                }
            }),
        );
    }

    builder
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::all()
                        & !tauri_plugin_window_state::StateFlags::VISIBLE,
                )
                .build(),
        )
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            greet,
            show_window,
            init_chat_session,
            fetch_chat_batch,
            proxy::get_proxy_port,
            logs::fetch_vod_logs,
            media::clipper::submit_clip,
            media::clipper::submit_download,
            media::clipper::cancel_job,
            media::clipper::list_jobs,
            media::clipper::remove_job,
        ])
        .setup(move |app| {
            proxy::init();

            let window = app.get_webview_window("main").unwrap();
            set_window_title(&window);

            if debug {
                window.open_devtools();
            }

            #[cfg(any(target_os = "linux", all(debug_assertions, windows)))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                app.deep_link().register_all()?;
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
