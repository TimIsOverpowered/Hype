use std::io::BufRead;
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use serde::Serialize;
use tauri::Emitter;
use tauri::AppHandle;

use ffmpeg_sidecar::download;
use ffmpeg_sidecar::paths;

static CANCEL_FLAG: Mutex<Option<std::sync::Arc<AtomicBool>>> = Mutex::new(None);

#[derive(Serialize, Clone)]
pub struct ProgressPayload {
    pub percent: u8,
    pub elapsed: f64,
    pub eta: f64,
}

pub fn trigger_cancel() {
    if let Some(flag) = CANCEL_FLAG.lock().ok().and_then(|mut f| f.take()) {
        flag.store(true, Ordering::SeqCst);
    }
}

fn parse_timecode(s: &str) -> f64 {
    let parts: Vec<&str> = s.split(':').collect();
    if parts.len() != 3 {
        return 0.0;
    }
    let h = parts[0].parse::<f64>().unwrap_or(0.0);
    let m = parts[1].parse::<f64>().unwrap_or(0.0);
    let sec = parts[2].parse::<f64>().unwrap_or(0.0);
    h * 3600.0 + m * 60.0 + sec
}

fn spawn_ffmpeg(
    args: &[String],
    app: AppHandle,
    emit_event: &str,
    duration_hint: f64,
    cancel_flag: std::sync::Arc<AtomicBool>,
) -> Result<(), String> {
    // Download FFmpeg if not already present (like v1's ffmpeg-static install.js)
    download::auto_download().map_err(|e| format!("FFmpeg download failed: {}", e))?;

    let ffmpeg_path = paths::ffmpeg_path();

    let mut child = std::process::Command::new(&ffmpeg_path)
        .args(args)
        .stderr(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn ffmpeg: {}", e))?;

    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;
    let stderr_reader = std::io::BufReader::new(stderr);

    let app_clone = app.clone();
    let progress_cancel = cancel_flag.clone();
    let progress_emit = emit_event.to_string();
    let progress_duration = duration_hint;

    let total_duration = std::thread::spawn(move || {
        let mut total_duration: Option<f64> = None;
        let mut last_emit = std::time::Instant::now();
        let throttle = std::time::Duration::from_millis(500);

        for line in stderr_reader.lines() {
            if progress_cancel.load(Ordering::SeqCst) {
                break;
            }

            let line = match line {
                Ok(l) => l,
                Err(_) => break,
            };

            if total_duration.is_none() {
                if let Some(dur) = line.split("Duration: ").nth(1) {
                    let dur_str = dur.split(',').next().unwrap_or("");
                    total_duration = Some(parse_timecode(dur_str));
                }
            }

            let total = total_duration.unwrap_or(progress_duration);
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
                    let eta = if clamped > 0 {
                        (elapsed / clamped as f64) * (100.0 - clamped as f64)
                    } else {
                        total - elapsed
                    };

                    let payload = ProgressPayload {
                        percent: clamped,
                        elapsed,
                        eta,
                    };
                    let _ = app_clone.emit(&progress_emit, payload);
                }
            }
        }

        total_duration
    });

    loop {
        if cancel_flag.load(Ordering::SeqCst) {
            let _ = child.kill();
            let _ = child.wait();
            return Ok(());
        }

        match child.try_wait() {
            Ok(Some(status)) => {
                let td = total_duration.join().unwrap_or(None);
                let elapsed = td.unwrap_or(duration_hint);
                let _ = app.emit(
                    emit_event,
                    ProgressPayload {
                        percent: 100,
                        elapsed,
                        eta: 0.0,
                    },
                );
                if status.success() {
                    return Ok(());
                } else {
                    return Err(format!("FFmpeg exited with status: {}", status));
                }
            }
            Ok(None) => {
                std::thread::sleep(std::time::Duration::from_millis(100));
            }
            Err(e) => {
                return Err(format!("Failed to check process status: {}", e));
            }
        }
    }
}

#[tauri::command]
pub async fn clip_vod(
    m3u8_url: String,
    start: f64,
    duration: f64,
    output_path: String,
    _is_fmp4: bool,
    app: AppHandle,
) -> Result<(), String> {
    let cancel_flag = std::sync::Arc::new(AtomicBool::new(false));
    {
        let mut flag = CANCEL_FLAG.lock().ok().unwrap();
        *flag = Some(cancel_flag.clone());
    }

    let args: Vec<String> = vec![
        "-v".into(), "info".into(),
        "-threads".into(), "0".into(),
        "-thread_queue_size".into(), "1024".into(),
        "-i".into(), m3u8_url,
        "-ss".into(), start.to_string(),
        "-t".into(), duration.to_string(),
        "-c".into(), "copy".into(),
        "-copyts".into(),
        "-start_at_zero".into(),
        "-avoid_negative_ts".into(), "make_zero".into(),
        "-y".into(),
        output_path,
    ];

    spawn_ffmpeg(&args, app, "clip-progress", duration, cancel_flag)
}

#[tauri::command]
pub async fn download_vod(
    m3u8_url: String,
    duration: f64,
    output_path: String,
    _is_fmp4: bool,
    app: AppHandle,
) -> Result<(), String> {
    let cancel_flag = std::sync::Arc::new(AtomicBool::new(false));
    {
        let mut flag = CANCEL_FLAG.lock().ok().unwrap();
        *flag = Some(cancel_flag.clone());
    }

    let args: Vec<String> = vec![
        "-v".into(), "info".into(),
        "-threads".into(), "0".into(),
        "-thread_queue_size".into(), "1024".into(),
        "-i".into(), m3u8_url,
        "-c".into(), "copy".into(),
        "-bsf:a".into(), "aac_adtstoasc".into(),
        "-movflags".into(), "+faststart".into(),
        "-y".into(),
        output_path,
    ];

    spawn_ffmpeg(&args, app, "download-progress", duration, cancel_flag)
}

#[tauri::command]
pub async fn cancel_job() -> Result<(), String> {
    trigger_cancel();
    Ok(())
}
