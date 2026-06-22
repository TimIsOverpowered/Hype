use std::io::Write;

use skia_safe::{
    canvas::SrcRectConstraint,
    textlayout::{
        FontCollection, Paragraph, ParagraphBuilder, ParagraphStyle,
        PlaceholderAlignment, PlaceholderStyle, TextStyle, TextBaseline,
    },
    Canvas, Color, FontMgr, FontStyle, Paint, Point, Rect,
};
use tauri::AppHandle;
use tauri::Emitter;

use crate::media::chat::assets::{RENDER_ASSET_CACHE, RenderAssetManager};
use crate::media::chat::models::{ChatRenderConfig, FormattedFragment, FormattedMessage};

const MESSAGE_PADDING_X: f32 = 8.0;
const MESSAGE_PADDING_Y: f32 = 3.0;
const MESSAGE_GAP: f32 = 4.0;


#[derive(Clone, serde::Serialize)]
pub struct RenderProgressPayload {
    pub job_id: String,
    pub progress: u8,
}

#[derive(Clone, serde::Serialize)]
pub struct RenderCompletePayload {
    pub job_id: String,
    pub output_path: String,
}

fn hex_color_to_skia(color_hex: &str) -> Color {
    let cleaned = color_hex.trim().trim_start_matches('#');
    let parsed = u32::from_str_radix(cleaned, 16).unwrap_or(0);
    if cleaned.len() == 6 {
        Color::from_argb(0xFF, (parsed >> 16) as u8, (parsed >> 8) as u8, parsed as u8)
    } else if cleaned.len() == 8 {
        Color::from_argb(
            ((parsed >> 24) & 0xFF) as u8,
            ((parsed >> 16) & 0xFF) as u8,
            ((parsed >> 8) & 0xFF) as u8,
            (parsed & 0xFF) as u8,
        )
    } else {
        Color::from_rgb(0xFF, 0xFF, 0xFF)
    }
}

enum PlaceholderData {
    Badge(String),
    Emote(String),
}

struct MessageLayout {
    para: Paragraph,
    placeholders: Vec<PlaceholderData>,
    total_height: f32,
    msg_time: f64,
}

fn build_paragraph_for_message(
    msg: &FormattedMessage,
    username_color: Color,
    asset_manager: &RenderAssetManager,
    fc: &FontCollection,
    config: &ChatRenderConfig,
) -> (Paragraph, Vec<PlaceholderData>) {
    let mut builder = ParagraphBuilder::new(&ParagraphStyle::new(), fc.clone());
    let mut placeholders = Vec::new();

    let mut font_list: Vec<&str> = config.font_family.split(',').map(|s| s.trim()).collect();
    if !font_list.contains(&"sans-serif") {
        font_list.push("sans-serif");
    }
    if !font_list.contains(&"emoji") {
        font_list.push("emoji");
    }

    if config.show_badges {
        if let Some(badges) = &msg.badges {
            for badge in badges {
                let key = format!("{}--{}", badge.set_id, badge.version);
                if asset_manager.get_badge(&key).is_some() {
                    let ph_style = PlaceholderStyle::new(
                        config.font_size,
                        config.font_size,
                        PlaceholderAlignment::Middle,
                        TextBaseline::Alphabetic,
                        0.0,
                    );
                    builder.add_placeholder(&ph_style);
                    placeholders.push(PlaceholderData::Badge(key));
                }
            }
        }
    }

    let mut username_style = TextStyle::new();
    username_style.set_color(username_color);
    username_style.set_font_size(config.font_size);
    username_style.set_font_style(FontStyle::bold());
    username_style.set_font_families(&font_list);
    builder.push_style(&username_style);
    builder.add_text(&msg.display_name);
    builder.add_text(": ");
    builder.pop();

    let mut msg_style = TextStyle::new();
    msg_style.set_color(hex_color_to_skia(&config.font_color));
    msg_style.set_font_size(config.font_size);
    msg_style.set_font_families(&font_list);
    builder.push_style(&msg_style);

    for fragment in &msg.fragments {
        match fragment {
            FormattedFragment::Custom { id, code, provider, .. } => {
                let mut should_render = true;
                if provider == "7TV" && !config.enable7tv {
                    should_render = false;
                }
                if provider == "BTTV" && !config.enable_bttv {
                    should_render = false;
                }
                if provider == "FFZ" && !config.enable_ffz {
                    should_render = false;
                }

                let key = format!("{}:{}", provider, id);
                if should_render && asset_manager.get_emote(&key).is_some() {
                    let emote_img = asset_manager.get_emote(&key).unwrap();
                    let frame = emote_img.get_frame_for_time(0);
                    let src_w = frame.width() as f32;
                    let src_h = frame.height() as f32;

                    let placeholder_h = config.font_size * 1.8;
                    let is_zw = asset_manager.is_zero_width(&key);

                    let placeholder_w = if is_zw {
                        0.0
                    } else if src_h > 0.0 {
                        (src_w / src_h) * placeholder_h
                    } else {
                        config.font_size * 1.8
                    };

                    let ph_style = PlaceholderStyle::new(
                        placeholder_w,
                        placeholder_h,
                        PlaceholderAlignment::Middle,
                        TextBaseline::Alphabetic,
                        0.0,
                    );
                    builder.add_placeholder(&ph_style);
                    placeholders.push(PlaceholderData::Emote(key));
                } else {
                    builder.add_text(code);
                }
            }
            FormattedFragment::Twitch { emote_id, text } => {
                let key = format!("twitch:{}", emote_id);
                if let Some(emote_img) = asset_manager.get_emote(&key) {
                    let frame = emote_img.get_frame_for_time(0);
                    let src_w = frame.width() as f32;
                    let src_h = frame.height() as f32;
                    let placeholder_h = config.font_size * 1.8;
                    let placeholder_w = if src_h > 0.0 {
                        (src_w / src_h) * placeholder_h
                    } else {
                        config.font_size * 1.8
                    };

                    let ph_style = PlaceholderStyle::new(
                        placeholder_w,
                        placeholder_h,
                        PlaceholderAlignment::Middle,
                        TextBaseline::Alphabetic,
                        0.0,
                    );
                    builder.add_placeholder(&ph_style);
                    placeholders.push(PlaceholderData::Emote(key));
                } else {
                    builder.add_text(text);
                }
            }
            FormattedFragment::Emoji { text } => {
                builder.add_text(text);
            }
            FormattedFragment::Url { text } => {
                let mut url_style = TextStyle::new();
                url_style.set_color(Color::from_rgb(0x58, 0xA6, 0xFF));
                url_style.set_font_size(config.font_size);
                url_style.set_font_families(&["monospace"]);
                builder.push_style(&url_style);
                builder.add_text(text);
                builder.pop();
            }
            FormattedFragment::Text { text } => {
                builder.add_text(text);
            }
        }
    }

    builder.pop();
    let mut para = builder.build();
    para.layout(config.width as f32 - MESSAGE_PADDING_X * 2.0);
        (para, placeholders)
}




fn layout_messages(
    messages: &[FormattedMessage],
    asset_manager: &RenderAssetManager,
    fc: &FontCollection,
    config: &ChatRenderConfig,
) -> Vec<MessageLayout> {
    let mut layouts = Vec::new();

    for msg in messages {
        let user_color = hex_color_to_skia(&msg.user_color);
        let (para, placeholders) = build_paragraph_for_message(msg, user_color, asset_manager, fc, config);

        let total_height = para.height() + MESSAGE_GAP;

        layouts.push(MessageLayout {
            para,
            placeholders,
            total_height,
            msg_time: msg.content_offset_seconds,
        });
    }

    layouts
}

fn render_frame(
    canvas: &Canvas,
    active_messages: &[&MessageLayout],
    asset_manager: &RenderAssetManager,
    elapsed_ms: u32,
    _current_time_sec: f64,
    height: f32,
) {
    let mut paint = Paint::default();
    paint.set_anti_alias(true);

    const PLACEHOLDER_SIZE: f32 = 1.8 * 16.0;

    let mut draw_y = height - 20.0;

    // Iterate BACKWARDS (newest messages first) so they stack upward
    for msg in active_messages.iter().rev() {
        draw_y -= msg.total_height;

        if draw_y < -100.0 {
            break; // Stop drawing once we go off the top of the screen
        }

        msg.para.paint(canvas, Point::new(MESSAGE_PADDING_X, draw_y + MESSAGE_PADDING_Y));

        let placeholder_rects = msg.para.get_rects_for_placeholders();
        for (pi, rect) in placeholder_rects.iter().enumerate() {
            if pi >= msg.placeholders.len() {
                continue;
            }

            let px = MESSAGE_PADDING_X + rect.rect.left;
            let py = draw_y + MESSAGE_PADDING_Y + rect.rect.top;
            let dst_rect = Rect::from_xywh(px, py, rect.rect.width(), rect.rect.height());

            match &msg.placeholders[pi] {
                PlaceholderData::Badge(key) => {
                    if let Some(badge_img) = asset_manager.get_badge(key) {
                        let src_rect = Rect::from_xywh(0.0, 0.0, badge_img.width() as f32, badge_img.height() as f32);
                        canvas.draw_image_rect(badge_img, Some((&src_rect, SrcRectConstraint::Fast)), &dst_rect, &paint);
                    }
                }
                PlaceholderData::Emote(key) => {
                    if let Some(emote_img) = asset_manager.get_emote(key) {
                        let frame = emote_img.get_frame_for_time(elapsed_ms);
                        let src_rect = Rect::from_xywh(0.0, 0.0, frame.width() as f32, frame.height() as f32);

                        let ph_size = PLACEHOLDER_SIZE;
                        let final_dst = if asset_manager.is_zero_width(key) {
                            Rect::from_xywh(px - ph_size, py, ph_size, dst_rect.height())
                        } else {
                            dst_rect
                        };

                        canvas.draw_image_rect(frame, Some((&src_rect, SrcRectConstraint::Fast)), &final_dst, &paint);
                    }
                }
            }
        }
    }
}

pub fn render_chat_video(
    messages: Vec<FormattedMessage>,
    asset_manager: &RenderAssetManager,
    output_path: &str,
    start_sec: f64,
    duration_sec: f64,
    config: ChatRenderConfig,
    app: Option<AppHandle>,
    job_id: Option<String>,
) -> Result<(), String> {
    let total_frames = (duration_sec * config.fps as f64) as usize;
    if total_frames == 0 {
        return Err("Duration is zero or negative".to_string());
    }

    let mut surface = skia_safe::surfaces::raster_n32_premul((config.width, config.height))
        .ok_or("Failed to create Skia surface")?;

    let ffmpeg_path = ffmpeg_sidecar::paths::ffmpeg_path();
    let mut child = std::process::Command::new(&ffmpeg_path)
        .args([
            "-y",
            "-f", "rawvideo",
            "-pixel_format", "bgra",
            "-video_size", &format!("{}x{}", config.width, config.height),
            "-framerate", &config.fps.to_string(),
            "-thread_queue_size", "1024",
            "-i", "-",
            "-c:v", "libvpx-vp9",
            "-pix_fmt", "yuva420p",
            "-b:v", "2M",
            "-cpu-used", "8",
            "-deadline", "realtime",
            "-row-mt", "1",
            "-threads", "0",
            output_path,
        ])
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn FFmpeg: {}", e))?;

    let mut stdin = child.stdin.take().ok_or("Failed to take FFmpeg stdin")?;

    let font_mgr = FontMgr::default();
    let mut fc = FontCollection::new();
    fc.set_default_font_manager(font_mgr, None);

    let ignored_users: Vec<String> = config.ignored_users.split(',').map(|s| s.trim().to_lowercase()).filter(|s| !s.is_empty()).collect();
    let banned_words: Vec<String> = config.banned_words.split(',').map(|s| s.trim().to_lowercase()).filter(|s| !s.is_empty()).collect();

    let mut filtered_messages: Vec<FormattedMessage> = messages.into_iter().filter(|msg| {
        if ignored_users.contains(&msg.display_name.to_lowercase()) {
            return false;
        }

        let msg_text = msg.fragments.iter().filter_map(|f| match f {
            FormattedFragment::Text { text } => Some(text.as_str()),
            _ => None
        }).collect::<Vec<_>>().join(" ").to_lowercase();

        for word in &banned_words {
            if msg_text.contains(word) {
                return false;
            }
        }
        true
    }).collect();

    filtered_messages.sort_by(|a, b| a.content_offset_seconds.partial_cmp(&b.content_offset_seconds).unwrap_or(std::cmp::Ordering::Equal));

    let all_layouts = layout_messages(
        &filtered_messages,
        &asset_manager,
        &fc,
        &config,
    );

    let mut frame_buf = vec![0u8; config.width as usize * config.height as usize * 4];

    let bg_color = if config.transparent_background {
        Color::TRANSPARENT
    } else {
        hex_color_to_skia(&config.background_color)
    };

    for frame_idx in 0..total_frames {
        let canvas = surface.canvas();
        canvas.clear(bg_color);

        let current_time_sec = start_sec + (frame_idx as f64 / config.fps as f64);
        let elapsed_ms = (frame_idx as u32) * (1000 / config.fps as u32);

        let active_messages: Vec<&MessageLayout> = all_layouts
            .iter()
            .filter(|m| m.msg_time <= current_time_sec)
            .collect();

        render_frame(
            &canvas,
            &active_messages,
            &asset_manager,
            elapsed_ms,
            current_time_sec,
            config.height as f32,
        );

        let image = surface.image_snapshot();
        if let Some(pixmap) = image.peek_pixels() {
            if let Some(bytes) = pixmap.bytes() {
                frame_buf.copy_from_slice(bytes);
            }
            if let Err(e) = stdin.write_all(&frame_buf) {
                eprintln!("FFmpeg stdin closed early: {}", e);
                break;
            }
        }

        if let (Some(app_ref), Some(ref job_id_ref)) = (&app, &job_id) {
            if frame_idx % 30 == 0 || frame_idx == total_frames - 1 {
                let render_fraction = (frame_idx + 1) as f64 / total_frames as f64;
                let progress = (20.0 + (80.0 * render_fraction)).min(100.0) as u8;
                crate::media::job_queue::get_queue().update_progress(job_id_ref, progress, app_ref);
                let payload = RenderProgressPayload {
                    job_id: job_id_ref.clone(),
                    progress,
                };
                let _ = app_ref.emit("chat-render-progress", &payload);
            }
        }
    }

    drop(stdin);

    let status = child.wait_with_output().map_err(|e| format!("FFmpeg wait failed: {}", e))?;

    if !status.status.success() {
        let stderr_str = String::from_utf8_lossy(&status.stderr);
        return Err(format!("FFmpeg failed with status {:?}: {}", status.status, stderr_str));
    }

    if let (Some(app_ref), Some(ref job_id_ref)) = (&app, &job_id) {
        let payload = RenderCompletePayload {
            job_id: job_id_ref.clone(),
            output_path: output_path.to_string(),
        };
        let _ = app_ref.emit("chat-render-complete", &payload);
    }

    Ok(())
}

#[tauri::command]
pub async fn render_chat_video_cmd(
    messages: Vec<FormattedMessage>,
    output_path: String,
    start_sec: f64,
    duration_sec: f64,
    config: ChatRenderConfig,
    app: AppHandle,
) -> Result<String, String> {
    let job_id = uuid::Uuid::new_v4().to_string();
    let queue = crate::media::job_queue::get_queue();
    queue.submit(crate::media::job_queue::JobType::Clip, format!("chat-render-{}", job_id));

    let asset_manager = RenderAssetManager::new();
    let app_clone = app.clone();
    let job_id_clone = job_id.clone();
    let output_path_clone = output_path.clone();

    tauri::async_runtime::spawn(async move {
        let messages_inner = messages.clone();
        let asset_manager_inner = asset_manager;
        let app_inner = app_clone.clone();
        let job_id_inner = job_id_clone.clone();
        let config_inner = config.clone();

        let render_result = tokio::task::spawn_blocking(move || {
            render_chat_video(
                messages_inner,
                &asset_manager_inner,
                &output_path_clone,
                start_sec,
                duration_sec,
                config_inner,
                Some(app_inner),
                Some(job_id_inner),
            )
        }).await;

        let render_result = match render_result {
            Ok(r) => r,
            Err(e) => {
                queue.fail(&job_id_clone, e.to_string(), &app_clone, "chat-render");
                return;
            }
        };

        match render_result {
            Ok(()) => {
                queue.complete(&job_id_clone, true, &app_clone, "chat-render");
                let payload = RenderCompletePayload {
                    job_id: job_id_clone,
                    output_path: output_path.clone(),
                };
                let _ = app_clone.emit("chat-render-complete", &payload);
            }
            Err(e) => {
                queue.fail(&job_id_clone, e.clone(), &app_clone, "chat-render");
            }
        }
    });

    Ok(job_id)
}

pub async fn fetch_all_messages_for_window(
    vod_id: &str,
    broadcaster_id: &str,
    start_sec: f64,
    duration_sec: f64,
) -> Result<Vec<FormattedMessage>, String> {
    let end_sec = start_sec + duration_sec;
    let mut all_messages = Vec::new();
    let mut cursor: Option<String> = None;
    let mut offset = Some(start_sec);

    loop {
        let batch = crate::media::chat::twitch::fetch_and_parse_comments(vod_id, broadcaster_id, offset, cursor).await?;

        let raw_last_time = batch.messages.last().map(|m| m.content_offset_seconds).unwrap_or(0.0);

        let messages_in_range: Vec<FormattedMessage> = batch.messages
            .into_iter()
            .filter(|m| m.content_offset_seconds >= start_sec && m.content_offset_seconds < end_sec)
            .collect();

        if !messages_in_range.is_empty() {
            all_messages.extend(messages_in_range);
        }

        match batch.next_cursor {
            Some(next) => {
                if raw_last_time >= end_sec {
                    break;
                }

                cursor = Some(next);
                offset = None;
            }
            None => break,
        }
    }

    Ok(all_messages)
}

#[tauri::command]
pub async fn render_chat_video_orchestrator_cmd(
    vod_id: String,
    broadcaster_id: String,
    start_sec: f64,
    duration_sec: f64,
    output_path: String,
    config: ChatRenderConfig,
    app: AppHandle,
) -> Result<crate::media::clipper::SubmitJobResponse, String> {
    let queue = crate::media::job_queue::get_queue();
    let job_id = queue.submit(
        crate::media::job_queue::JobType::ChatRender,
        output_path
            .split('/')
            .last()
            .unwrap_or("chat-render.webm")
            .to_string(),
    );

    let app_clone = app.clone();
    let job_id_clone = job_id.clone();
    let vod_id_clone = vod_id.clone();
    let broadcaster_id_clone = broadcaster_id.clone();
    let config_clone = config.clone();

    tauri::async_runtime::spawn(async move {
        let messages = match fetch_all_messages_for_window(&vod_id_clone, &broadcaster_id_clone, start_sec, duration_sec).await {
            Ok(msgs) => msgs,
            Err(e) => {
                queue.fail(&job_id_clone, e, &app_clone, "chat-render");
                return;
            }
        };

        if messages.is_empty() {
            queue.fail(&job_id_clone, "No chat messages found for the selected timeframe".to_string(), &app_clone, "chat-render");
            return;
        }

        let preload_result = crate::media::chat::assets::run_internal_preload(&job_id_clone, &broadcaster_id_clone, &vod_id_clone, &messages, &app_clone).await;
        match preload_result {
            Ok(_) => {},
            Err(e) => {
                queue.fail(&job_id_clone, e, &app_clone, "chat-render");
                return;
            }
        }

        queue.update_progress(&job_id_clone, 20, &app_clone);

        let asset_cache_clone = RENDER_ASSET_CACHE.clone();
        let output_path_clone = output_path.clone();
        let output_path_for_payload = output_path.clone();
        let messages_inner = messages;
        let app_inner = app_clone.clone();
        let job_id_inner = job_id_clone.clone();
        let config_inner = config_clone;

        let render_result = tokio::task::spawn_blocking(move || {
            let manager_guard = asset_cache_clone.blocking_read();
            render_chat_video(
                messages_inner,
                &manager_guard,
                &output_path_clone,
                start_sec,
                duration_sec,
                config_inner,
                Some(app_inner),
                Some(job_id_inner),
            )
        }).await;

        let render_result = match render_result {
            Ok(r) => r,
            Err(e) => {
                queue.fail(&job_id_clone, e.to_string(), &app_clone, "chat-render");
                return;
            }
        };

        match render_result {
            Ok(()) => {
                queue.complete(&job_id_clone, true, &app_clone, "chat-render");
                let payload = RenderCompletePayload {
                    job_id: job_id_clone,
                    output_path: output_path_for_payload,
                };
                let _ = app_clone.emit("chat-render-complete", &payload);
            }
            Err(e) => {
                queue.fail(&job_id_clone, e.clone(), &app_clone, "chat-render");
            }
        }
    });

    Ok(crate::media::clipper::SubmitJobResponse { job_id })
}
