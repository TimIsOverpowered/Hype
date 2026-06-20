use std::fs;
use std::path::Path;
use std::sync::Mutex;

use tauri::async_runtime::spawn;
use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow};
use tauri_plugin_deep_link::DeepLinkExt;

mod media;
mod proxy;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

struct SetupState {
    frontend_task: bool,
    backend_task: bool,
}

#[tauri::command]
async fn set_complete(
    app: AppHandle,
    state: State<'_, Mutex<SetupState>>,
    task: String,
) -> Result<(), ()> {
    let mut state_lock = state.lock().unwrap();
    match task.as_str() {
        "frontend" => state_lock.frontend_task = true,
        "backend" => state_lock.backend_task = true,
        _ => return Err(()),
    }
    if state_lock.backend_task && state_lock.frontend_task {
        if let Some(splash) = app.get_webview_window("splashscreen") {
            let _ = splash.close();
        }
        if let Some(main) = app.get_webview_window("main") {
            let _ = main.show();
            let _ = main.set_focus();
        }
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

fn emit_protocol_event(app: &tauri::AppHandle, url: &tauri::Url) {
    if let Err(e) = app.emit("protocol-uri", url.as_str()) {
        eprintln!("Failed to emit protocol event: {}", e);
    }
}

async fn setup_backend(app: AppHandle) -> Result<(), ()> {
    println!("Backend setup complete!");
    set_complete(
        app.clone(),
        app.state::<Mutex<SetupState>>(),
        "backend".to_string(),
    )
    .await?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
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
        .manage(Mutex::new(SetupState {
            frontend_task: false,
            backend_task: false,
        }))
        .invoke_handler(tauri::generate_handler![
            greet,
            set_complete,
            proxy::get_proxy_port,
            media::clipper::submit_clip,
            media::clipper::submit_download,
            media::clipper::cancel_job,
            media::clipper::list_jobs,
            media::clipper::remove_job,
        ]);

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
            proxy::init();

            let window = app.get_webview_window("main").unwrap();
            set_window_title(&window);

            spawn(setup_backend(app.handle().clone()));

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
