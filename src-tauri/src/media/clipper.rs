use std::sync::atomic::Ordering;

use serde::Serialize;
use tauri::AppHandle;
use tauri::Emitter;
use tauri::Manager;
use tauri::path::BaseDirectory;
use tokio::io::AsyncBufReadExt;

use crate::media::job_queue;
use crate::utils::parse_timecode;

pub fn get_ffmpeg_path(app: &AppHandle) -> std::path::PathBuf {
    let arch = std::env::consts::ARCH;
    let os = std::env::consts::OS;

    let triple = match (os, arch) {
        ("windows", "x86_64") => "x86_64-pc-windows-msvc",
        ("macos", "x86_64") => "x86_64-apple-darwin",
        ("macos", "aarch64") => "aarch64-apple-darwin",
        ("linux", "x86_64") => "x86_64-unknown-linux-gnu",
        _ => "x86_64-pc-windows-msvc",
    };

    let ext = if os == "windows" { ".exe" } else { "" };
    let binary_name = format!("ffmpeg-{}{}", triple, ext);

    let dev_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("binaries")
        .join(&binary_name);
    if dev_path.exists() {
        return dev_path;
    }

    if let Ok(prod_path) = app.path().resolve(format!("binaries/{}", binary_name), BaseDirectory::Resource) {
        if prod_path.exists() {
            return prod_path;
        }
    }

    if let Ok(prod_path_root) = app.path().resolve(&binary_name, BaseDirectory::Resource) {
        if prod_path_root.exists() {
            return prod_path_root;
        }
    }

    dev_path
}

#[derive(Serialize, Clone)]
pub struct SubmitJobResponse {
    pub job_id: String,
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

        if total_duration.is_none() && event_prefix != "clip" {
            if let Some(dur) = line.split("Duration: ").nth(1) {
                let dur_str = dur.split(',').next().unwrap_or("");
                total_duration = Some(parse_timecode(dur_str));
            }
        }

        let total = if event_prefix == "clip" { duration_hint } else { total_duration.unwrap_or(duration_hint) };
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

    let mut args: Vec<String> = vec![
        "-v".into(),
        "info".into(),
        "-threads".into(),
        "0".into(),
        "-thread_queue_size".into(),
        "1024".into(),
    ];

    // Keep the demuxer helper flags for reading Fragmented MP4 streams stably
    if is_fmp4 {
        args.extend(vec![
            "-fflags".into(),
            "+genpts+igndts".into(),
            "-correct_ts_overflow".into(),
            "1".into(),
        ]);
    }

    args.extend(vec![
        "-ss".into(),
        start.to_string(),
        "-i".into(),
        m3u8_url,
        "-t".into(),
        duration.to_string(),
        "-c".into(),
        "copy".into(),
    ]);

    // Omit the ADTS bitstream translator for fMP4 streams to keep the audio pipeline clean
    if !is_fmp4 {
        args.extend(vec![
            "-bsf:a".into(),
            "aac_adtstoasc".into(),
        ]);
    }

    args.extend(vec![
        "-movflags".into(),
        "+faststart".into(),
        "-y".into(),
        output_path,
    ]);

    let app_clone = app.clone();
    let id_clone = job_id.clone();
    tauri::async_runtime::spawn(async move {
        run_ffmpeg(id_clone, args, app_clone, "clip", duration).await;
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

    let mut args: Vec<String> = vec![
        "-v".into(),
        "info".into(),
        "-threads".into(),
        "0".into(),
        "-thread_queue_size".into(),
        "1024".into(),
    ];

    if is_fmp4 {
        args.extend(vec![
            "-fflags".into(),
            "+genpts+igndts".into(),
            "-correct_ts_overflow".into(),
            "1".into(),
        ]);
    }

    args.extend(vec![
        "-i".into(),
        m3u8_url,
        "-c".into(),
        "copy".into(),
    ]);

    if !is_fmp4 {
        args.extend(vec![
            "-bsf:a".into(),
            "aac_adtstoasc".into(),
        ]);
    }

    args.extend(vec![
        "-movflags".into(),
        "+faststart".into(),
        "-y".into(),
        output_path,
    ]);

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
