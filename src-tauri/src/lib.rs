use std::fs;
use std::path::Path;

use tauri::{AppHandle, Manager, WebviewWindow};

mod graph;
mod logs;
mod media;
mod proxy;

use crate::graph::{aggregate_clips, aggregate_logs};
use crate::media::chat::emotes::{get_channel_emotes, init_channel_emotes};
use crate::media::chat::models::{AggregateClipsPayload, AggregatePayload, BadgeSet};
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
async fn fetch_emotes(
    broadcaster_id: String,
) -> Result<crate::media::chat::models::SerializedEmoteSet, String> {
    get_channel_emotes(&broadcaster_id).await
}

#[tauri::command]
async fn fetch_badges(vod_id: String) -> Result<BadgeSet, String> {
    crate::media::chat::twitch::fetch_badges(&vod_id).await
}

#[tauri::command]
async fn aggregate_graph(
    payload: AggregatePayload,
) -> Result<crate::media::chat::models::GraphResult, String> {
    let (data, result) = tokio::task::spawn_blocking(move || aggregate_logs(payload))
        .await
        .map_err(|e| e.to_string())?;
    let _ = data;
    Ok(result)
}

#[tauri::command]
async fn aggregate_clips_cmd(
    payload: AggregateClipsPayload,
) -> Result<crate::media::chat::models::ClipsResult, String> {
    tokio::task::spawn_blocking(move || aggregate_clips(payload))
        .await
        .map_err(|e| e.to_string())
}

pub use crate::media::chat::assets::preload_render_assets;
pub use crate::media::chat::renderer::render_chat_video_orchestrator_cmd;

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
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        // single-instance MUST be registered first
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }));
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
            show_window,
            init_chat_session,
            fetch_chat_batch,
            fetch_emotes,
            fetch_badges,
            aggregate_graph,
            aggregate_clips_cmd,
            proxy::get_proxy_port,
            logs::fetch_vod_logs,
            media::clipper::submit_clip,
            media::clipper::submit_download,
            media::clipper::cancel_job,
            media::clipper::list_jobs,
            media::clipper::remove_job,
            preload_render_assets,
            render_chat_video_orchestrator_cmd,
        ])
        .setup(move |app| {
            proxy::init();

            let window = app.get_webview_window("main").unwrap();
            set_window_title(&window);

            if cfg!(debug_assertions) {
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
