use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use image::AnimationDecoder;
use lazy_static::lazy_static;
use serde::Serialize;
use skia_safe::{
    codec::{Codec, Options},
    images, Data, Image,
};
use tauri::AppHandle;
use tauri::Emitter;
use tokio::sync::RwLock;

use crate::media::chat::models::{CheerBadge, TwitchBadge};
use crate::media::job_queue;

// ─── CDN URL constants ─────────────────────────────────────────────────────

const SEVENTV_CDN: &str = "https://cdn.7tv.app/emote";
const BTTV_CDN: &str = "https://cdn.betterttv.net/emote";
const FFZ_CDN: &str = "https://cdn.frankerfacez.com/emote";
const TWITCH_EMOTES_CDN: &str = "https://static-cdn.jtvnw.net/emoticons/v2";

lazy_static! {
    static ref REQWEST_CLIENT: reqwest::Client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .expect("failed to build reqwest client");
}

// ─── Event payload types ───────────────────────────────────────────────────

#[derive(Serialize, Clone)]
pub struct AssetProgressPayload {
    pub job_id: String,
    pub loaded: u32,
    pub total: u32,
}

#[derive(Serialize, Clone)]
pub struct AssetPreloadCompletePayload {
    pub job_id: String,
    pub loaded: u32,
    pub total: u32,
    pub failed: u32,
}

// ─── Animated image container ──────────────────────────────────────────────

pub struct SkiaAnimatedImage {
    pub frames: Vec<Image>,
    pub frame_durations_ms: Vec<u32>,
    pub total_duration_ms: u32,
    #[allow(dead_code)]
    pub is_zero_width: bool,
}

impl SkiaAnimatedImage {
    pub fn get_frame_for_time(&self, elapsed_ms: u32) -> &Image {
        if self.frames.len() == 1 || self.total_duration_ms == 0 {
            return &self.frames[0];
        }

        let mut time_in_loop = elapsed_ms % self.total_duration_ms;
        for (i, &duration) in self.frame_durations_ms.iter().enumerate() {
            if time_in_loop < duration {
                return &self.frames[i];
            }
            time_in_loop -= duration;
        }
        self.frames.last().unwrap()
    }
}

// ─── Asset manager ─────────────────────────────────────────────────────────

pub struct RenderAssetManager {
    emotes: HashMap<String, SkiaAnimatedImage>,
    badges: HashMap<String, Image>,
    zero_width_keys: HashSet<String>,
}

impl RenderAssetManager {
    pub fn new() -> Self {
        Self {
            emotes: HashMap::new(),
            badges: HashMap::new(),
            zero_width_keys: HashSet::new(),
        }
    }

    // ─── URL builders ──────────────────────────────────────────────────

    pub fn build_badge_url(badge: &TwitchBadge) -> String {
        badge.image_1x.clone()
    }

    pub fn build_cheer_badge_url(badge: &CheerBadge) -> String {
        badge.image_1x.clone()
    }

    pub fn build_twitch_emote_url(emote_id: &str) -> String {
        format!("{}/{}/default/dark/1.0", TWITCH_EMOTES_CDN, emote_id)
    }

    // ─── Decoders ──────────────────────────────────────────────────────

    pub fn decode_bytes(bytes: &[u8], is_zero_width: bool) -> Option<SkiaAnimatedImage> {
        let data = Data::new_copy(bytes);

        // 1. Try Skia natively (This handles Twitch's animated GIFs)
        let codec = Codec::from_data(data.clone());
        if let Some(mut c) = codec {
            if c.get_frame_count() > 1 {
                let frame_count = c.get_frame_count();
                let mut frames = Vec::new();
                let mut frame_durations_ms = Vec::new();
                let mut total_duration_ms = 0;

                for i in 0..frame_count {
                    let options = Options {
                        frame_index: i,
                        ..unsafe { std::mem::zeroed() }
                    };
                    if let Ok(image) = c.get_image(None, Some(&options)) {
                        frames.push(image);
                        let duration = c
                            .get_frame_info(i)
                            .map(|info| info.duration as u32)
                            .unwrap_or(0)
                            .max(20);
                        frame_durations_ms.push(duration);
                        total_duration_ms += duration;
                    }
                }

                if !frames.is_empty() {
                    return Some(SkiaAnimatedImage {
                        frames,
                        frame_durations_ms,
                        total_duration_ms,
                        is_zero_width,
                    });
                }
            }
        }

        // 2. THE BYPASS: Pure-Rust Animated WebP Decoder
        // Skia on Windows drops WebPs, so we extract the frames manually
        if let Ok(decoder) = image::codecs::webp::WebPDecoder::new(std::io::Cursor::new(bytes)) {
            if let Ok(frames) = decoder.into_frames().collect::<Result<Vec<_>, _>>() {
                let mut skia_frames = Vec::new();
                let mut frame_durations_ms = Vec::new();
                let mut total_duration_ms = 0;

                for frame in frames {
                    // Extract the frame timing
                    let (num, den) = frame.delay().numer_denom_ms();
                    let duration = if den > 0 { num / den } else { 20 };
                    let duration = duration.max(20); // Enforce minimum 20ms

                    // Extract the raw RGBA pixels
                    let rgba_image = frame.into_buffer();
                    let width = rgba_image.width() as i32;
                    let height = rgba_image.height() as i32;
                    let raw_pixels = rgba_image.into_raw();

                    let info = skia_safe::ImageInfo::new(
                        (width, height),
                        skia_safe::ColorType::RGBA8888,
                        skia_safe::AlphaType::Unpremul,
                        None,
                    );

                    let pixel_data = Data::new_copy(&raw_pixels);

                    // Stamp the pixels into a Skia Image
                    if let Some(skia_img) =
                        images::raster_from_data(&info, pixel_data, (width * 4) as usize)
                    {
                        skia_frames.push(skia_img);
                        frame_durations_ms.push(duration);
                        total_duration_ms += duration;
                    }
                }

                if !skia_frames.is_empty() {
                    return Some(SkiaAnimatedImage {
                        frames: skia_frames,
                        frame_durations_ms,
                        total_duration_ms,
                        is_zero_width,
                    });
                }
            }
        }

        // 3. Fallback for Static Images (Badges, Static Emotes)
        if let Ok(dynamic_image) = image::load_from_memory(bytes) {
            let rgba_image = dynamic_image.into_rgba8();
            let width = rgba_image.width() as i32;
            let height = rgba_image.height() as i32;
            let raw_pixels = rgba_image.into_raw();

            let info = skia_safe::ImageInfo::new(
                (width, height),
                skia_safe::ColorType::RGBA8888,
                skia_safe::AlphaType::Unpremul,
                None,
            );

            let pixel_data = Data::new_copy(&raw_pixels);
            if let Some(skia_img) =
                images::raster_from_data(&info, pixel_data, (width * 4) as usize)
            {
                return Some(SkiaAnimatedImage {
                    frames: vec![skia_img],
                    frame_durations_ms: vec![0],
                    total_duration_ms: 0,
                    is_zero_width,
                });
            }
        }

        None
    }

    pub fn decode_badge_bytes(bytes: &[u8]) -> Option<Image> {
        let data = Data::new_copy(bytes);

        // Try Skia natively
        if let Some(img) = Image::from_encoded(data) {
            return Some(img);
        }

        // Badge Bypass
        if let Ok(dynamic_image) = image::load_from_memory(bytes) {
            let rgba_image = dynamic_image.into_rgba8();
            let width = rgba_image.width() as i32;
            let height = rgba_image.height() as i32;
            let raw_pixels = rgba_image.into_raw();

            let info = skia_safe::ImageInfo::new(
                (width, height),
                skia_safe::ColorType::RGBA8888,
                skia_safe::AlphaType::Unpremul,
                None,
            );

            let pixel_data = Data::new_copy(&raw_pixels);
            return images::raster_from_data(&info, pixel_data, (width * 4) as usize);
        }

        None
    }

    // ─── Lookup ────────────────────────────────────────────────────────

    pub fn get_emote(&self, key: &str) -> Option<&SkiaAnimatedImage> {
        self.emotes.get(key)
    }

    pub fn get_badge(&self, key: &str) -> Option<&Image> {
        self.badges.get(key)
    }

    pub fn is_zero_width(&self, key: &str) -> bool {
        self.zero_width_keys.contains(key)
    }
}

lazy_static! {
    pub static ref RENDER_ASSET_CACHE: Arc<RwLock<RenderAssetManager>> =
        Arc::new(RwLock::new(RenderAssetManager::new()));
}

#[allow(dead_code)]
pub async fn get_render_asset_cache() -> tokio::sync::RwLockReadGuard<'static, RenderAssetManager> {
    RENDER_ASSET_CACHE.read().await
}

// ─── Preload tasks ─────────────────────────────────────────────────────────

async fn preload_emote_task(
    key: String,
    url: String,
    is_zero_width: bool,
    manager: Arc<RwLock<RenderAssetManager>>,
) -> Result<(), String> {
    {
        let m = manager.read().await;
        if m.get_emote(&key).is_some() {
            return Ok(());
        }
    }

    let resp = match REQWEST_CLIENT.get(&url).send().await {
        Ok(r) => {
            if !r.status().is_success() {
                eprintln!("[preload][error] emote {} HTTP error: {}", key, r.status());
                return Err(format!("HTTP {}", r.status()));
            }
            r
        }
        Err(e) => {
            eprintln!("[preload][error] emote {} request error: {}", key, e);
            return Err(e.to_string());
        }
    };

    let bytes = match resp.bytes().await {
        Ok(b) => b.to_vec(),
        Err(e) => {
            eprintln!("[preload][error] emote {} bytes error: {}", key, e);
            return Err(e.to_string());
        }
    };

    if let Some(decoded) = RenderAssetManager::decode_bytes(&bytes, is_zero_width) {
        let mut m = manager.write().await;
        m.emotes.insert(key.clone(), decoded);
        if is_zero_width {
            m.zero_width_keys.insert(key.clone());
        }
        return Ok(());
    }

    eprintln!(
        "[preload][error] emote {} decode failed ({} bytes)",
        key,
        bytes.len()
    );
    Err("decode failed".to_string())
}

async fn preload_badge_task(
    key: String,
    url: String,
    manager: Arc<RwLock<RenderAssetManager>>,
) -> Result<(), String> {
    {
        let m = manager.read().await;
        if m.get_badge(&key).is_some() {
            return Ok(());
        }
    }

    let resp = match REQWEST_CLIENT.get(&url).send().await {
        Ok(r) => {
            if !r.status().is_success() {
                eprintln!("[preload][error] badge {} HTTP error: {}", key, r.status());
                return Err(format!("HTTP {}", r.status()));
            }
            r
        }
        Err(e) => {
            eprintln!("[preload][error] badge {} request error: {}", key, e);
            return Err(e.to_string());
        }
    };

    let bytes = match resp.bytes().await {
        Ok(b) => b.to_vec(),
        Err(e) => {
            eprintln!("[preload][error] badge {} bytes error: {}", key, e);
            return Err(e.to_string());
        }
    };

    if let Some(decoded) = RenderAssetManager::decode_badge_bytes(&bytes) {
        let mut m = manager.write().await;
        m.badges.insert(key.clone(), decoded);
        return Ok(());
    }

    eprintln!(
        "[preload][error] badge {} decode failed ({} bytes)",
        key,
        bytes.len()
    );
    Err("decode failed".to_string())
}

// ─── Tauri command ─────────────────────────────────────────────────────────

#[tauri::command]
pub async fn preload_render_assets(
    broadcaster_id: String,
    vod_id: String,
    app: AppHandle,
) -> Result<String, String> {
    let queue = job_queue::get_queue();
    let job_id = queue.submit(
        job_queue::JobType::Download,
        format!("assets-{}", broadcaster_id),
    );

    let app_clone = app.clone();
    let job_id_clone = job_id.clone();

    tauri::async_runtime::spawn(async move {
        if let Err(e) = run_preload(&job_id_clone, &broadcaster_id, &vod_id, &[], &app_clone).await
        {
            queue.fail(&job_id_clone, e.to_string(), &app_clone, "asset-preload");
        }
    });

    Ok(job_id)
}

pub async fn run_internal_preload(
    job_id: &str,
    broadcaster_id: &str,
    vod_id: &str,
    messages: &[crate::media::chat::models::FormattedMessage],
    app: &AppHandle,
) -> Result<(), String> {
    run_preload(job_id, broadcaster_id, vod_id, messages, app).await
}

async fn run_preload(
    job_id: &str,
    _broadcaster_id: &str,
    vod_id: &str,
    messages: &[crate::media::chat::models::FormattedMessage],
    app: &AppHandle,
) -> Result<(), String> {
    use std::collections::{HashMap, HashSet};

    let throttle = std::time::Duration::from_millis(200);
    let mut last_emit = std::time::Instant::now();
    let timeout_start = std::time::Instant::now();

    // Fetch badges
    let badge_set = match crate::media::chat::twitch::fetch_badges(vod_id).await {
        Ok(b) => b,
        Err(e) => return Err(format!("Failed to fetch badges: {}", e)),
    };

    // Only extract the emotes that actually appear in this clip's messages
    let mut custom_emotes_to_fetch = HashMap::new();
    let mut twitch_emote_ids = HashSet::new();

    for msg in messages {
        for frag in &msg.fragments {
            match frag {
                crate::media::chat::models::FormattedFragment::Custom {
                    id,
                    provider,
                    is_zero_width,
                    ..
                } => {
                    let key = format!("{}:{}", provider, id);
                    if !custom_emotes_to_fetch.contains_key(&key) {
                        custom_emotes_to_fetch
                            .insert(key, (id.clone(), provider.clone(), *is_zero_width));
                    }
                }
                crate::media::chat::models::FormattedFragment::Twitch { emote_id, .. } => {
                    twitch_emote_ids.insert(emote_id.clone());
                }
                _ => {}
            }
        }
    }

    let mut emote_tasks: Vec<(String, String, bool)> = Vec::new();

    for (key, (id, provider, is_zw)) in custom_emotes_to_fetch {
        let url = match provider.as_str() {
            "7TV" => format!("{}/{}/1x.webp", SEVENTV_CDN, id),
            "BTTV" => format!("{}/{}/1x", BTTV_CDN, id),
            "FFZ" => format!("{}/{}/1", FFZ_CDN, id),
            _ => String::new(),
        };
        if !url.is_empty() {
            emote_tasks.push((key, url, is_zw));
        }
    }

    for emote_id in twitch_emote_ids {
        let key = format!("twitch:{}", emote_id);
        let url = RenderAssetManager::build_twitch_emote_url(&emote_id);
        emote_tasks.push((key, url, false));
    }

    let mut badge_tasks: Vec<(String, String)> = Vec::new();

    if let Some(global_badges) = &badge_set.global_badges {
        for badge in global_badges {
            let key = format!("{}--{}", badge.set_id, badge.version);
            let url = RenderAssetManager::build_badge_url(badge);
            badge_tasks.push((key, url));
        }
    }

    if let Some(channel_badges) = &badge_set.channel_badges {
        for badge in channel_badges {
            let key = format!("{}--{}", badge.set_id, badge.version);
            let url = RenderAssetManager::build_badge_url(badge);
            badge_tasks.push((key, url));
        }
    }

    if let Some(cheer_badges) = &badge_set.channel_cheer_badges {
        for badge in cheer_badges {
            let key = format!("cheer:{}", badge.minimum_cheer_amount);
            let url = RenderAssetManager::build_cheer_badge_url(badge);
            if !url.is_empty() {
                badge_tasks.push((key, url));
            }
        }
    }

    eprintln!(
        "[preload] total assets: {} emotes, {} badges",
        emote_tasks.len(),
        badge_tasks.len()
    );
    let total = emote_tasks.len() + badge_tasks.len();
    if total == 0 {
        return Err("No assets to preload".to_string());
    }

    let manager = RENDER_ASSET_CACHE.clone();

    let mut emote_handles = Vec::new();
    for (key, url, is_zw) in emote_tasks {
        let m = Arc::clone(&manager);
        let handle = tauri::async_runtime::spawn(preload_emote_task(key, url, is_zw, m));
        emote_handles.push(handle);
    }

    let mut badge_handles = Vec::new();
    for (key, url) in badge_tasks {
        let m = Arc::clone(&manager);
        let handle = tauri::async_runtime::spawn(preload_badge_task(key, url, m));
        badge_handles.push(handle);
    }

    let mut loaded = 0u32;
    let mut failed = 0u32;

    let all_handles: Vec<_> = emote_handles.into_iter().chain(badge_handles).collect();
    let mut completed = 0u32;

    let total_timeout = std::time::Duration::from_secs(60);

    for handle in all_handles {
        if timeout_start.elapsed() >= total_timeout {
            eprintln!("[preload] timeout reached after {} assets", completed);
            break;
        }

        let remaining = total_timeout.saturating_sub(timeout_start.elapsed());
        if remaining.is_zero() {
            break;
        }

        match tokio::time::timeout(remaining, handle).await {
            Ok(Ok(Ok(_))) => {
                loaded += 1;
            }
            Ok(Ok(Err(e))) => {
                eprintln!("[preload][error] asset error: {}", e);
                failed += 1;
            }
            Ok(Err(e)) => {
                eprintln!("[preload][error] asset join error: {}", e);
                failed += 1;
            }
            Err(_) => {
                eprintln!("[preload][error] asset timeout");
                failed += 1;
            }
        }

        completed += 1;
        emit_progress_if_needed(
            &job_id,
            app,
            completed,
            total as u32,
            &mut last_emit,
            throttle,
        );
    }

    eprintln!(
        "[preload] complete: loaded={} failed={} total={}",
        loaded, failed, total
    );

    let result_payload = AssetPreloadCompletePayload {
        job_id: job_id.to_string(),
        loaded,
        total: total as u32,
        failed,
    };

    if timeout_start.elapsed() >= total_timeout {
        let _ = app.emit("asset-preload-timeout", &result_payload);
    } else {
        let _ = app.emit("asset-preload-complete", &result_payload);
    }

    Ok(())
}

fn emit_progress_if_needed(
    job_id: &str,
    app: &AppHandle,
    completed: u32,
    total: u32,
    last_emit: &mut std::time::Instant,
    throttle: std::time::Duration,
) {
    let now = std::time::Instant::now();
    if now.duration_since(*last_emit) >= throttle {
        *last_emit = now;
        let progress = (5.0 + (completed as f32 / total.max(1) as f32) * 15.0).min(20.0) as u8;
        crate::media::job_queue::get_queue().update_progress(job_id, progress, app);
        let payload = AssetProgressPayload {
            job_id: job_id.to_string(),
            loaded: completed,
            total,
        };
        let _ = app.emit("asset-preload-progress", &payload);
    }
}
