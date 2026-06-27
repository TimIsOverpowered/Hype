use std::sync::atomic::Ordering;

use serde::{Deserialize, Serialize};
use tauri::path::BaseDirectory;
use tauri::AppHandle;
use tauri::Emitter;
use tauri::Manager;
use tokio::io::AsyncBufReadExt;

use crate::media::job_queue;
use crate::utils::parse_timecode;

pub fn get_ffmpeg_path(app: &AppHandle) -> std::path::PathBuf {
    let arch = std::env::consts::ARCH;
    let os = std::env::consts::OS;

    let ext = if os == "windows" { ".exe" } else { "" };

    // 1. Production: Tauri strips the target triple during the build process.
    // The bundled file will simply be named "ffmpeg.exe" (or "ffmpeg").
    let prod_name = format!("ffmpeg{}", ext);

    // Check right next to the executable
    if let Ok(mut exe_path) = std::env::current_exe() {
        exe_path.pop();

        let sidecar_path = exe_path.join(&prod_name);
        if sidecar_path.exists() {
            return sidecar_path;
        }

        // Fallback: Check if Tauri kept the "binaries" folder structure
        let nested_path = exe_path.join("binaries").join(&prod_name);
        if nested_path.exists() {
            return nested_path;
        }
    }

    // Production Fallback: Check Tauri's Resource directory
    if let Ok(resource_path) = app.path().resolve(&prod_name, BaseDirectory::Resource) {
        if resource_path.exists() {
            return resource_path;
        }
    }

    // 2. Development: Tauri requires the exact target triple in the filename locally.
    let triple = match (os, arch) {
        ("windows", "x86_64") => "x86_64-pc-windows-msvc",
        ("macos", "x86_64") => "x86_64-apple-darwin",
        ("macos", "aarch64") => "aarch64-apple-darwin",
        ("linux", "x86_64") => "x86_64-unknown-linux-gnu",
        _ => "x86_64-pc-windows-msvc",
    };

    let dev_name = format!("ffmpeg-{}{}", triple, ext);

    std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("binaries")
        .join(&dev_name)
}

#[derive(Serialize, Clone)]
pub struct SubmitJobResponse {
    pub job_id: String,
}

#[derive(Deserialize, Debug)]
pub struct CropBoxPct {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

async fn run_ffmpeg(
    job_id: String,
    args: Vec<String>,
    app: AppHandle,
    event_prefix: &'static str,
    duration_hint: f64,
) {
    let queue = job_queue::get_queue();

    let ffmpeg_path = get_ffmpeg_path(&app);

    let mut child = match crate::media::build_tokio_command(&ffmpeg_path)
        .args(&args)
        .stderr(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .spawn()
    {
        Ok(c) => c,
        Err(e) => {
            queue.fail(
                &job_id,
                format!("Failed to spawn ffmpeg: {}", e),
                &app,
                event_prefix,
            );
            return;
        }
    };

    let stderr = match child.stderr.take() {
        Some(s) => s,
        None => {
            queue.fail(
                &job_id,
                "Failed to capture stderr".into(),
                &app,
                event_prefix,
            );
            return;
        }
    };

    if let Some(job) = queue.get_job(&job_id) {
        if let Ok(mut handle) = job.child_handle.lock() {
            *handle = Some(child);
        }
    }

    let stderr_reader = tokio::io::BufReader::new(stderr);
    let mut lines = stderr_reader.lines();

    let app_clone = app.clone();
    let job_id_clone = job_id.clone();
    let event_prefix_clone = event_prefix.to_string();

    let mut total_duration: Option<f64> = None;
    let mut last_emit = std::time::Instant::now();
    let throttle = std::time::Duration::from_millis(500);

    loop {
        let job = queue.get_job(&job_id_clone);
        let cancelled = job
            .as_ref()
            .map(|j| j.cancel_flag.load(Ordering::SeqCst))
            .unwrap_or(false);
        if cancelled {
            break;
        }

        let line = match lines.next_line().await {
            Ok(Some(l)) => l,
            _ => break,
        };

        if total_duration.is_none() && (event_prefix != "clip" || duration_hint <= 0.0) {
            if let Some(dur) = line.split("Duration: ").nth(1) {
                let dur_str = dur.split(',').next().unwrap_or("");
                total_duration = Some(parse_timecode(dur_str));
            }
        }

        let total = if event_prefix == "clip" && duration_hint > 0.0 {
            duration_hint
        } else {
            total_duration.unwrap_or(duration_hint)
        };
        if total <= 0.0 {
            continue;
        }

        if let Some(time_str) = line.split("time=").nth(1) {
            let time_str = time_str.split(' ').next().unwrap_or("");
            if time_str.is_empty() || !time_str.contains(':') {
                continue;
            }
            let elapsed = parse_timecode(time_str);
            let percent = ((elapsed / total) * 100.0) as u8;
            let clamped = percent.min(100);

            let now = std::time::Instant::now();
            if now.duration_since(last_emit) >= throttle {
                last_emit = now;
                queue.update_progress(&job_id_clone, clamped, &app_clone);

                let summary = queue.list().into_iter().find(|s| s.id == job_id_clone);
                if let Some(s) = summary {
                    let _ = app_clone.emit(&format!("{}-progress", event_prefix_clone), s);
                }
            }
        }
    }

    let exit_status = if let Some(job_ref) = queue.get_job(&job_id) {
        let maybe_child = if let Ok(mut guard) = job_ref.child_handle.lock() {
            guard.take()
        } else {
            None
        };
        if let Some(mut c) = maybe_child {
            c.wait().await.ok()
        } else {
            None
        }
    } else {
        None
    };

    if let Some(status) = exit_status {
        let is_cancelled = queue
            .get_job(&job_id)
            .map(|j| j.cancel_flag.load(Ordering::SeqCst))
            .unwrap_or(false);
        if is_cancelled {
            return;
        }
        let is_success = status.success();
        if !is_success {
            if let Some(j) = queue.get_job(&job_id) {
                if let Ok(mut err) = j.error.lock() {
                    *err = Some(format!("FFmpeg exited with status: {}", status));
                }
            }
        }
        queue.complete(&job_id, is_success, &app, event_prefix);
    }
}

fn build_base_args(is_fmp4: bool) -> Vec<String> {
    let mut args = vec![
        "-v".into(), "info".into(),
        "-threads".into(), "0".into(),
        "-thread_queue_size".into(), "1024".into(),
    ];
    if is_fmp4 {
        args.extend(["-fflags".into(), "+genpts+igndts".into(),
                      "-correct_ts_overflow".into(), "1".into()]);
    }
    args
}

fn build_output_args(is_fmp4: bool, output_path: &str) -> Vec<String> {
    let mut args = vec!["-c".into(), "copy".into()];
    if !is_fmp4 {
        args.extend(["-bsf:a".into(), "aac_adtstoasc".into()]);
    }
    args.extend(["-movflags".into(), "+faststart".into(), "-y".into(), output_path.to_string()]);
    args
}

#[tauri::command]
pub async fn submit_clip(
    m3u8_url: String,
    start: f64,
    duration: f64,
    output_path: String,
    is_fmp4: bool,
    app: AppHandle,
) -> Result<SubmitJobResponse, String> {
    let job_id = job_queue::get_queue().submit(
        job_queue::JobType::Clip,
        output_path
            .split('/')
            .last()
            .unwrap_or("clip.mp4")
            .to_string(),
    );

    let mut args = build_base_args(is_fmp4);
    args.extend(["-ss".into(), start.to_string(), "-i".into(), m3u8_url]);
    args.extend(["-t".into(), duration.to_string()]);
    args.extend(build_output_args(is_fmp4, &output_path));

    let app_clone = app.clone();
    let id_clone = job_id.clone();
    tauri::async_runtime::spawn(async move {
        run_ffmpeg(id_clone, args, app_clone, "clip", duration).await;
    });

    Ok(SubmitJobResponse { job_id })
}

#[tauri::command]
pub async fn submit_vertical_clip(
    source_path: String,
    layout_mode: String,
    cam_box: CropBoxPct,
    game_box: CropBoxPct,
    single_box: CropBoxPct,
    fit_mode: bool,
    app: AppHandle,
) -> Result<SubmitJobResponse, String> {
    let path = std::path::Path::new(&source_path);
    let stem = path.file_stem().ok_or("Invalid path")?.to_string_lossy().to_string();
    let ext = path.extension().unwrap_or_default().to_string_lossy().to_string();
    let parent = path.parent().ok_or("Invalid directory")?;

    let output_path = parent.join(format!("{}-vertical.{}", stem, ext));
    let output_path_str = output_path.to_string_lossy().to_string();

    let job_id = job_queue::get_queue().submit(
        job_queue::JobType::Clip,
        output_path.file_name().unwrap_or_default().to_string_lossy().into_owned(),
    );

    let filtergraph = if layout_mode == "stacked" {
        format!(
            "[0:v]crop=w='iw*{}/100':h='ih*{}/100':x='iw*{}/100':y='ih*{}/100',scale=1080:-2[cam];\
             [0:v]crop=w='iw*{}/100':h='ih*{}/100':x='iw*{}/100':y='ih*{}/100',scale=1080:-2[game];\
             [cam][game]vstack,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[v]",
            cam_box.w, cam_box.h, cam_box.x, cam_box.y,
            game_box.w, game_box.h, game_box.x, game_box.y
        )
    } else if layout_mode == "full" && fit_mode {
        "[0:v]scale=1080:-2,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black[v]".to_string()
    } else {
        format!(
            "[0:v]crop=w='iw*{}/100':h='ih*{}/100':x='iw*{}/100':y='ih*{}/100',scale=1080:1920[v]",
            single_box.w, single_box.h, single_box.x, single_box.y
        )
    };

    let encoder = crate::media::chat::renderer::get_cached_encoder(&get_ffmpeg_path(&app));
    let mut args = vec![
        "-v".into(), "info".into(),
        "-i".into(), source_path,
        "-filter_complex".into(), filtergraph,
        "-map".into(), "[v]".into(),
        "-map".into(), "0:a?".into(),
        "-c:a".into(), "copy".into(),
    ];

    args.extend(crate::media::chat::renderer::get_h264_args(encoder));
    args.extend(vec!["-y".into(), output_path_str]);

    let app_clone = app.clone();
    let id_clone = job_id.clone();

    tauri::async_runtime::spawn(async move {
        run_ffmpeg(id_clone, args, app_clone, "clip", 0.0).await;
    });

    Ok(SubmitJobResponse { job_id })
}

#[tauri::command]
pub async fn submit_download(
    m3u8_url: String,
    duration: f64,
    output_path: String,
    is_fmp4: bool,
    app: AppHandle,
) -> Result<SubmitJobResponse, String> {
    let job_id = job_queue::get_queue().submit(
        job_queue::JobType::Download,
        output_path
            .split('/')
            .last()
            .unwrap_or("vod.mp4")
            .to_string(),
    );

    let mut args = build_base_args(is_fmp4);
    args.extend(["-i".into(), m3u8_url]);
    args.extend(build_output_args(is_fmp4, &output_path));

    let app_clone = app.clone();
    let id_clone = job_id.clone();
    tauri::async_runtime::spawn(async move {
        run_ffmpeg(id_clone, args, app_clone, "download", duration).await;
    });

    Ok(SubmitJobResponse { job_id })
}

#[tauri::command]
pub async fn cancel_job(id: String, app: tauri::AppHandle) -> Result<(), String> {
    if job_queue::get_queue().cancel(&id, &app).await {
        Ok(())
    } else {
        Err("Job not found".to_string())
    }
}

#[tauri::command]
pub async fn list_jobs() -> Vec<job_queue::JobSummary> {
    job_queue::get_queue().list()
}

#[tauri::command]
pub async fn remove_job(id: String) -> Result<(), String> {
    job_queue::get_queue().remove(&id);
    Ok(())
}
