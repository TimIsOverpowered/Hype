use std::collections::VecDeque;
use std::io::Write;

use skia_safe::{
    canvas::{SaveLayerRec, SrcRectConstraint},
    textlayout::{
        FontCollection, Paragraph, ParagraphBuilder, ParagraphStyle, PlaceholderAlignment,
        PlaceholderStyle, TextBaseline, TextStyle,
    },
    BlendMode, Canvas, Color, FontMgr, FontStyle, Paint, Point, Rect,
};
use tauri::AppHandle;
use tauri::Emitter;

use crate::media::chat::assets::{RenderAssetManager, RENDER_ASSET_CACHE};
use crate::media::chat::models::{ChatRenderConfig, FormattedFragment, FormattedMessage};

const MESSAGE_PADDING_X: f32 = 8.0;
const MESSAGE_PADDING_Y: f32 = 3.0;
const MESSAGE_GAP: f32 = 16.0;

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
        Color::from_argb(
            0xFF,
            (parsed >> 16) as u8,
            (parsed >> 8) as u8,
            parsed as u8,
        )
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

fn adjust_username_color(username_color: Color, bg_color: Color) -> Color {
    let r = username_color.r() as f32;
    let g = username_color.g() as f32;
    let b = username_color.b() as f32;

    let user_lum = 0.299 * r + 0.587 * g + 0.114 * b;
    let bg_lum = 0.299 * bg_color.r() as f32 + 0.587 * bg_color.g() as f32 + 0.114 * bg_color.b() as f32;

    if (user_lum - bg_lum).abs() < 80.0 {
        if bg_lum < 128.0 {
            let factor = (80.0 - (user_lum - bg_lum).abs()) / 80.0;
            let new_r = (r + (255.0 - r) * factor).min(255.0) as u8;
            let new_g = (g + (255.0 - g) * factor).min(255.0) as u8;
            let new_b = (b + (255.0 - b) * factor).min(255.0) as u8;
            Color::from_rgb(new_r, new_g, new_b)
        } else {
            Color::from_rgb((r * 0.3) as u8, (g * 0.3) as u8, (b * 0.3) as u8)
        }
    } else {
        username_color
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
}

pub fn has_encoder(ffmpeg_path: &std::path::Path, encoder_name: &str) -> bool {
    let mut cmd = crate::media::build_std_command(ffmpeg_path);
    cmd.arg("-encoders");

    if let Ok(output) = cmd.output() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        stdout.contains(encoder_name)
    } else {
        false
    }
}

pub fn get_h264_args(encoder: &str) -> Vec<String> {
    match encoder {
        "h264_nvenc" => vec![
            "-c:v".into(), "h264_nvenc".into(),
            "-pix_fmt".into(), "yuv420p".into(),
            "-preset".into(), "p4".into(), 
            "-cq".into(), "18".into(),     
        ],
        "h264_videotoolbox" => vec![
            "-c:v".into(), "h264_videotoolbox".into(),
            "-pix_fmt".into(), "yuv420p".into(),
            "-q:v".into(), "60".into(), 
        ],
        "h264_amf" => vec![
            "-c:v".into(), "h264_amf".into(),
            "-pix_fmt".into(), "yuv420p".into(),
            "-rc".into(), "cqp".into(),
            "-qp_p".into(), "18".into(),
            "-qp_i".into(), "18".into(),
        ],
        "h264_qsv" => vec![
            "-c:v".into(), "h264_qsv".into(),
            "-pix_fmt".into(), "yuv420p".into(),
            "-global_quality".into(), "18".into(),
        ],
        _ => vec![
            "-c:v".into(), "libx264".into(),
            "-pix_fmt".into(), "yuv420p".into(),
            "-preset".into(), "veryfast".into(),
            "-crf".into(), "18".into(),
            "-threads".into(), "0".into(),
        ],
    }
}

fn build_paragraph_for_message(
    msg: &FormattedMessage,
    username_color: Color,
    asset_manager: &RenderAssetManager,
    fc: &FontCollection,
    config: &ChatRenderConfig,
    force_white_mask: bool,
    bg_color: Color,
) -> (Paragraph, Vec<PlaceholderData>) {
    let mut builder = ParagraphBuilder::new(&ParagraphStyle::new(), fc.clone());
    let mut placeholders = Vec::new();

    let mut font_list: Vec<&str> = config.font_family.split(',').map(|s| s.trim()).collect();
    font_list.extend(["Arial", "Segoe UI", "Helvetica", "San Francisco"]);

    if config.show_badges {
        if let Some(badges) = &msg.badges {
            for badge in badges {
                let key = format!("{}--{}", badge.set_id, badge.version);
                if asset_manager.get_badge(&key).is_some() {
                    let badge_size = config.font_size * 1.15;
                    let ph_style = PlaceholderStyle::new(
                        badge_size,
                        badge_size,
                        PlaceholderAlignment::Baseline,
                        TextBaseline::Alphabetic,
                        badge_size * 0.85,
                    );
                    builder.add_placeholder(&ph_style);
                    placeholders.push(PlaceholderData::Badge(key));

                    let mut spacer_style = TextStyle::new();
                    spacer_style.set_font_size(config.font_size * 0.3);
                    spacer_style.set_font_families(&font_list);
                    builder.push_style(&spacer_style);
                    builder.add_text(" ");
                    builder.pop();
                }
            }
        }
    }

    let mut username_style = TextStyle::new();
    let guarded_color = if force_white_mask { Color::WHITE } else { adjust_username_color(username_color, bg_color) };
    username_style.set_color(guarded_color);
    username_style.set_font_size(config.font_size);
    username_style.set_font_style(FontStyle::bold());
    username_style.set_font_families(&font_list);
    builder.push_style(&username_style);
    builder.add_text(&msg.display_name);
    builder.add_text(": ");
    builder.pop();

    let mut msg_style = TextStyle::new();
    msg_style.set_color(if force_white_mask { Color::WHITE } else { hex_color_to_skia(&config.font_color) });
    msg_style.set_font_size(config.font_size);
    msg_style.set_font_families(&font_list);
    builder.push_style(&msg_style);

    for fragment in &msg.fragments {
        match fragment {
            FormattedFragment::Custom { id, code, provider, .. } => {
                let mut should_render = true;
                if provider == "7TV" && !config.enable7tv { should_render = false; }
                if provider == "BTTV" && !config.enable_bttv { should_render = false; }
                if provider == "FFZ" && !config.enable_ffz { should_render = false; }

                let key = format!("{}:{}", provider, id);
                if should_render && asset_manager.get_emote(&key).is_some() {
                    let emote_img = asset_manager.get_emote(&key).unwrap();
                    let frame = emote_img.get_frame_for_time(0);
                    let src_w = frame.width() as f32;
                    let src_h = frame.height() as f32;

                    let placeholder_h = config.font_size * 1.8;
                    let is_zw = asset_manager.is_zero_width(&key);
                    let placeholder_w = if is_zw { 0.0 } else if src_h > 0.0 { (src_w / src_h) * placeholder_h } else { config.font_size * 1.8 };

                    let ph_style = PlaceholderStyle::new(placeholder_w, placeholder_h, PlaceholderAlignment::Middle, TextBaseline::Alphabetic, 0.0);
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
                    let placeholder_w = if src_h > 0.0 { (src_w / src_h) * placeholder_h } else { config.font_size * 1.8 };

                    let ph_style = PlaceholderStyle::new(placeholder_w, placeholder_h, PlaceholderAlignment::Middle, TextBaseline::Alphabetic, 0.0);
                    builder.add_placeholder(&ph_style);
                    placeholders.push(PlaceholderData::Emote(key));
                } else {
                    builder.add_text(text);
                }
            }
            FormattedFragment::Emoji { text } => {
                let id = crate::media::chat::assets::to_twemoji_id(text);
                let key = format!("twemoji:{}", id);

                if let Some(_emote_img) = asset_manager.get_emote(&key) {
                    // Lock to exactly 28x28 to match Twitch and BTTV emotes perfectly
                    let placeholder_size = 28.0;
                    let ph_style = PlaceholderStyle::new(
                        placeholder_size,
                        placeholder_size,
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
            FormattedFragment::Url { text } => {
                let mut url_style = TextStyle::new();
                url_style.set_color(if force_white_mask { Color::WHITE } else { Color::from_rgb(0x58, 0xA6, 0xFF) });
                url_style.set_font_size(config.font_size);
                url_style.set_font_families(&["monospace"]);
                builder.push_style(&url_style);
                builder.add_text(text);
                builder.pop();
            }
            FormattedFragment::Text { text } => { builder.add_text(text); }
        }
    }

    builder.pop();
    let mut para = builder.build();
    para.layout(config.width as f32 - MESSAGE_PADDING_X * 2.0);
    (para, placeholders)
}

fn render_frame(
    canvas: &Canvas,
    active_messages: &VecDeque<MessageLayout>,
    asset_manager: &RenderAssetManager,
    elapsed_ms: u32,
    height: f32,
    force_white_mask: bool,
) {
    let mut paint = Paint::default();
    paint.set_anti_alias(true);

    let mut draw_y = height - 20.0;

    for msg in active_messages.iter().rev() {
        draw_y -= msg.total_height;

        if draw_y < -100.0 { break; }

        msg.para.paint(canvas, Point::new(MESSAGE_PADDING_X, draw_y + MESSAGE_PADDING_Y));

        let placeholder_rects = msg.para.get_rects_for_placeholders();
        for (pi, rect) in placeholder_rects.iter().enumerate() {
            if pi >= msg.placeholders.len() { continue; }

            let px = MESSAGE_PADDING_X + rect.rect.left;
            let py = draw_y + MESSAGE_PADDING_Y + rect.rect.top;
            let dst_rect = Rect::from_xywh(px, py, rect.rect.width(), rect.rect.height());

            match &msg.placeholders[pi] {
                PlaceholderData::Badge(key) => {
                    if let Some(badge_img) = asset_manager.get_badge(key) {
                        let src_rect = Rect::from_xywh(0.0, 0.0, badge_img.width() as f32, badge_img.height() as f32);
                        
                        if force_white_mask {
                            let rec = SaveLayerRec::default().bounds(&dst_rect);
                            canvas.save_layer(&rec);
                            canvas.draw_image_rect(badge_img, Some((&src_rect, SrcRectConstraint::Fast)), &dst_rect, &Paint::default());
                            let mut tint = Paint::default();
                            tint.set_color(Color::WHITE);
                            tint.set_blend_mode(BlendMode::SrcIn);
                            canvas.draw_rect(&dst_rect, &tint);
                            canvas.restore();
                        } else {
                            canvas.draw_image_rect(badge_img, Some((&src_rect, SrcRectConstraint::Fast)), &dst_rect, &paint);
                        }
                    }
                }
                PlaceholderData::Emote(key) => {
                    if let Some(emote_img) = asset_manager.get_emote(key) {
                        let frame = emote_img.get_frame_for_time(elapsed_ms);
                        let src_rect = Rect::from_xywh(0.0, 0.0, frame.width() as f32, frame.height() as f32);
                        let actual_ph_height = dst_rect.height();
                        let final_dst = if asset_manager.is_zero_width(key) {
                            Rect::from_xywh(px - actual_ph_height, py, actual_ph_height, actual_ph_height)
                        } else {
                            dst_rect
                        };
                        
                        if force_white_mask {
                            let rec = SaveLayerRec::default().bounds(&final_dst);
                            canvas.save_layer(&rec);
                            canvas.draw_image_rect(frame, Some((&src_rect, SrcRectConstraint::Fast)), &final_dst, &Paint::default());
                            let mut tint = Paint::default();
                            tint.set_color(Color::WHITE);
                            tint.set_blend_mode(BlendMode::SrcIn);
                            canvas.draw_rect(&final_dst, &tint);
                            canvas.restore();
                        } else {
                            canvas.draw_image_rect(frame, Some((&src_rect, SrcRectConstraint::Fast)), &final_dst, &paint);
                        }
                    }
                }
            }
        }
    }
}

pub fn render_chat_video(
    messages: Vec<FormattedMessage>,
    asset_manager: &RenderAssetManager,
    ffmpeg_path: &std::path::Path,
    output_path: &str,
    start_sec: f64,
    duration_sec: f64,
    config: ChatRenderConfig,
    app: Option<AppHandle>,
    job_id: Option<String>,
) -> Result<(), String> {
    let total_frames = (duration_sec * config.fps as f64) as usize;
    if total_frames == 0 { return Err("Duration is zero or negative".to_string()); }

    let mut color_surface = skia_safe::surfaces::raster_n32_premul((config.width, config.height)).ok_or("Failed to create Color surface")?;
    let mut mask_surface = if config.generate_mask {
        Some(skia_safe::surfaces::raster_n32_premul((config.width, config.height)).ok_or("Failed to create Mask surface")?)
    } else {
        None
    };

    let encoder = if has_encoder(ffmpeg_path, "h264_nvenc") { "h264_nvenc" }
    else if has_encoder(ffmpeg_path, "h264_videotoolbox") { "h264_videotoolbox" }
    else if has_encoder(ffmpeg_path, "h264_amf") { "h264_amf" }
    else if has_encoder(ffmpeg_path, "h264_qsv") { "h264_qsv" }
    else { "libx264" };

    // ─── PIPE 1: STANDARD COLOR VIDEO ───
    let mut color_args = vec![
        "-y".into(), "-f".into(), "rawvideo".into(), "-pixel_format".into(), "bgra".into(),
        "-video_size".into(), format!("{}x{}", config.width, config.height),
        "-framerate".into(), config.fps.to_string(), "-thread_queue_size".into(), "1024".into(), "-i".into(), "-".into(),
    ];
    color_args.extend(get_h264_args(encoder));
    color_args.push(output_path.to_string());

    let mut color_cmd = crate::media::build_std_command(&ffmpeg_path);
    color_cmd.args(&color_args).stdin(std::process::Stdio::piped());

    let mut color_child = color_cmd.spawn().map_err(|e| format!("Failed to spawn Color FFmpeg: {}", e))?;
    let mut color_stdin = color_child.stdin.take().ok_or("Failed to take Color stdin")?;

    // ─── PIPE 2: TRACK MATTE BLACK & WHITE MASK VIDEO (Conditional) ───
    let mut mask_child = None;
    let mut mask_stdin = None;
    
    if config.generate_mask {
        let mask_output_path = output_path.replace(".mp4", "_mask.mp4");
        let mut mask_args = vec![
            "-y".into(), "-f".into(), "rawvideo".into(), "-pixel_format".into(), "bgra".into(),
            "-video_size".into(), format!("{}x{}", config.width, config.height),
            "-framerate".into(), config.fps.to_string(), "-thread_queue_size".into(), "1024".into(), "-i".into(), "-".into(),
        ];
        mask_args.extend(get_h264_args(encoder));
        mask_args.push(mask_output_path);

        let mut mask_cmd = crate::media::build_std_command(&ffmpeg_path);
        mask_cmd.args(&mask_args).stdin(std::process::Stdio::piped());

        let mut child = mask_cmd.spawn().map_err(|e| format!("Failed to spawn Mask FFmpeg: {}", e))?;
        mask_stdin = Some(child.stdin.take().ok_or("Failed to take Mask stdin")?);
        mask_child = Some(child);
    }

    let font_mgr = FontMgr::default();
    let mut fc = FontCollection::new();
    fc.set_default_font_manager(font_mgr, None);

    let ignored_users: Vec<String> = config.ignored_users.split(',').map(|s| s.trim().to_lowercase()).filter(|s| !s.is_empty()).collect();
    let banned_words: Vec<String> = config.banned_words.split(',').map(|s| s.trim().to_lowercase()).filter(|s| !s.is_empty()).collect();

    let mut filtered_messages: Vec<FormattedMessage> = messages.into_iter().filter(|msg| {
        if ignored_users.contains(&msg.display_name.to_lowercase()) { return false; }
        let msg_text = msg.fragments.iter().filter_map(|f| match f { FormattedFragment::Text { text } => Some(text.as_str()), _ => None }).collect::<Vec<_>>().join(" ").to_lowercase();
        for word in &banned_words { if msg_text.contains(word) { return false; } }
        true
    }).collect();

    filtered_messages.sort_by(|a, b| a.content_offset_seconds.partial_cmp(&b.content_offset_seconds).unwrap_or(std::cmp::Ordering::Equal));

    let mut frame_buf = vec![0u8; config.width as usize * config.height as usize * 4];

    let bg_color = if config.generate_mask { Color::BLACK } else { hex_color_to_skia(&config.background_color) };

    let mut color_queue: VecDeque<MessageLayout> = VecDeque::new();
    let mut mask_queue: VecDeque<MessageLayout> = VecDeque::new();
    let mut next_msg_idx = 0;

    for frame_idx in 0..total_frames {
        let current_time_sec = start_sec + (frame_idx as f64 / config.fps as f64);
        let elapsed_ms = (frame_idx as u32) * (1000 / config.fps as u32);

        // 1. INGEST
        while next_msg_idx < filtered_messages.len() && filtered_messages[next_msg_idx].content_offset_seconds <= current_time_sec {
            let msg = &filtered_messages[next_msg_idx];
            let user_color = hex_color_to_skia(&msg.user_color);

            let (c_para, c_ph) = build_paragraph_for_message(msg, user_color, &asset_manager, &fc, &config, false, bg_color);
            let c_height = c_para.height() + MESSAGE_GAP;
            color_queue.push_back(MessageLayout { para: c_para, placeholders: c_ph, total_height: c_height });

            if config.generate_mask {
                let (m_para, m_ph) = build_paragraph_for_message(msg, user_color, &asset_manager, &fc, &config, true, bg_color);
                let m_height = m_para.height() + MESSAGE_GAP;
                mask_queue.push_back(MessageLayout { para: m_para, placeholders: m_ph, total_height: m_height });
            }

            next_msg_idx += 1;
        }

        // 2. PRUNE
        let (mut c_acc, mut c_keep) = (0.0, 0.0);
        for msg in color_queue.iter().rev() { c_acc += msg.total_height; c_keep += 1.0; if c_acc > config.height as f32 + 200.0 { break; } }
        while color_queue.len() > c_keep as usize { color_queue.pop_front(); }

        if config.generate_mask {
            let (mut m_acc, mut m_keep) = (0.0, 0.0);
            for msg in mask_queue.iter().rev() { m_acc += msg.total_height; m_keep += 1.0; if m_acc > config.height as f32 + 200.0 { break; } }
            while mask_queue.len() > m_keep as usize { mask_queue.pop_front(); }
        }

        // 3. RENDER COLOR VIDEO
        let color_canvas = color_surface.canvas();
        color_canvas.clear(bg_color);
        render_frame(&color_canvas, &color_queue, &asset_manager, elapsed_ms, config.height as f32, false);
        
        if let Some(pixmap) = color_surface.image_snapshot().peek_pixels() {
            if let Some(bytes) = pixmap.bytes() {
                frame_buf.copy_from_slice(bytes);
                if let Err(e) = color_stdin.write_all(&frame_buf) {
                    eprintln!("Color FFmpeg stdin closed early: {}", e);
                    break;
                }
            }
        }

        // 4. RENDER MASK VIDEO (If Transparent)
        if let (Some(m_surface), Some(m_stdin)) = (&mut mask_surface, &mut mask_stdin) {
            let mask_canvas = m_surface.canvas();
            mask_canvas.clear(Color::BLACK);
            render_frame(&mask_canvas, &mask_queue, &asset_manager, elapsed_ms, config.height as f32, true);
            
            if let Some(pixmap) = m_surface.image_snapshot().peek_pixels() {
                if let Some(bytes) = pixmap.bytes() {
                    frame_buf.copy_from_slice(bytes);
                    if let Err(e) = m_stdin.write_all(&frame_buf) {
                        eprintln!("Mask FFmpeg stdin closed early: {}", e);
                        break;
                    }
                }
            }
        }

        // 5. PROGRESS
        if let (Some(app_ref), Some(ref job_id_ref)) = (&app, &job_id) {
            if frame_idx % 30 == 0 || frame_idx == total_frames - 1 {
                let render_fraction = (frame_idx + 1) as f64 / total_frames as f64;
                let progress = (20.0 + (80.0 * render_fraction)).min(100.0) as u8;
                crate::media::job_queue::get_queue().update_progress(job_id_ref, progress, app_ref);
                let payload = RenderProgressPayload { job_id: job_id_ref.clone(), progress };
                let _ = app_ref.emit("chat-render-progress", &payload);
            }
        }
    }

    drop(color_stdin);
    let status = color_child.wait_with_output().map_err(|e| format!("Color FFmpeg wait failed: {}", e))?;
    if !status.status.success() {
        return Err(format!("Color FFmpeg failed: {}", String::from_utf8_lossy(&status.stderr)));
    }

    if let (Some(m_stdin), Some(mut m_child)) = (mask_stdin, mask_child) {
        drop(m_stdin);
        let _ = m_child.wait();
    }

    if let (Some(app_ref), Some(ref job_id_ref)) = (&app, &job_id) {
        let payload = RenderCompletePayload { job_id: job_id_ref.clone(), output_path: output_path.to_string() };
        let _ = app_ref.emit("chat-render-complete", &payload);
    }

    Ok(())
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
            .unwrap_or("chat-render.mp4")
            .to_string(),
    );

    let app_clone = app.clone();
    let job_id_clone = job_id.clone();
    let vod_id_clone = vod_id.clone();
    let broadcaster_id_clone = broadcaster_id.clone();
    let config_clone = config.clone();

    tauri::async_runtime::spawn(async move {
        let messages = match fetch_all_messages_for_window(
            &vod_id_clone,
            &broadcaster_id_clone,
            start_sec,
            duration_sec,
        )
        .await
        {
            Ok(msgs) => msgs,
            Err(e) => {
                queue.fail(&job_id_clone, e, &app_clone, "chat-render");
                return;
            }
        };

        if messages.is_empty() {
            queue.fail(
                &job_id_clone,
                "No chat messages found for the selected timeframe".to_string(),
                &app_clone,
                "chat-render",
            );
            return;
        }

        let preload_result = crate::media::chat::assets::run_internal_preload(
            &job_id_clone,
            &broadcaster_id_clone,
            &vod_id_clone,
            &messages,
            &app_clone,
        )
        .await;
        match preload_result {
            Ok(_) => {}
            Err(e) => {
                queue.fail(&job_id_clone, e, &app_clone, "chat-render");
                return;
            }
        }

        queue.update_progress(&job_id_clone, 20, &app_clone);

        let asset_cache_clone = RENDER_ASSET_CACHE.clone();
        let output_path_clone = output_path.clone();
        let output_path_for_payload = output_path.clone();

        let native_ffmpeg_path = crate::media::clipper::get_ffmpeg_path(&app_clone);

        let messages_inner = messages;
        let app_inner = app_clone.clone();
        let job_id_inner = job_id_clone.clone();
        let config_inner = config_clone;
        let ffmpeg_path = native_ffmpeg_path;

        let render_result = tokio::task::spawn_blocking(move || {
            let manager_guard = asset_cache_clone.blocking_read();
            render_chat_video(
                messages_inner,
                &manager_guard,
                &ffmpeg_path,
                &output_path_clone,
                start_sec,
                duration_sec,
                config_inner,
                Some(app_inner),
                Some(job_id_inner),
            )
        })
        .await;

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
        let batch = crate::media::chat::twitch::fetch_and_parse_comments(
            vod_id,
            broadcaster_id,
            offset,
            cursor,
        )
        .await?;

        let raw_last_time = batch
            .messages
            .last()
            .map(|m| m.content_offset_seconds)
            .unwrap_or(0.0);

        let messages_in_range: Vec<FormattedMessage> = batch
            .messages
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
