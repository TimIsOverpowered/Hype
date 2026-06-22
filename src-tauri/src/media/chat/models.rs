use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "type")]
pub enum FormattedFragment {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "twitch")]
    Twitch { emote_id: String, text: String },
    #[serde(rename = "custom")]
    Custom {
        id: String,
        code: String,
        name: String,
        provider: String,
        is_zero_width: bool,
        width: Option<u32>,
        height: Option<u32>,
    },
    #[serde(rename = "emoji")]
    Emoji { text: String },
    #[serde(rename = "url")]
    Url { text: String },
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FormattedMessage {
    pub id: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    #[serde(rename = "userColor")]
    pub user_color: String,
    #[serde(rename = "contentOffsetSeconds")]
    pub content_offset_seconds: f64,
    pub badges: Option<Vec<ChatBadge>>,
    pub fragments: Vec<FormattedFragment>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ChatBadge {
    #[serde(rename = "setID")]
    pub set_id: String,
    pub version: String,
}

#[derive(Clone, Debug)]
pub struct CachedEmote {
    pub id: String,
    pub code: String,
    pub name: String,
    pub provider: String,
    pub is_zero_width: bool,
    pub width: Option<u32>,
    pub height: Option<u32>,
}

// ─── Serialized emotes (returned to frontend) ──────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SerializedEmote {
    pub id: String,
    pub code: String,
    pub name: String,
    pub provider: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub width: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub height: Option<u32>,
}

#[derive(Serialize, Clone, Debug)]
pub struct SerializedEmoteSet {
    pub bttv: Vec<SerializedEmote>,
    pub ffz: Vec<SerializedEmote>,
    pub seventv: Vec<SerializedEmote>,
}

// ─── Badges ────────────────────────────────────────────────────────────────

#[derive(Serialize, Clone, Debug)]
pub struct BadgeSet {
    pub global_badges: Option<Vec<TwitchBadge>>,
    pub channel_badges: Option<Vec<TwitchBadge>>,
    pub channel_cheer_badges: Option<Vec<CheerBadge>>,
}

#[derive(Serialize, Clone, Debug)]
pub struct TwitchBadge {
    #[serde(rename = "setID")]
    pub set_id: String,
    pub version: String,
    pub image_1x: String,
    pub image_2x: String,
    pub image_4x: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct CheerBadge {
    pub image_1x: String,
    pub image_2x: String,
    pub image_4x: String,
    pub can_show_globally: bool,
    pub minimum_cheer_amount: u64,
}

// ─── Graph types ───────────────────────────────────────────────────────────

#[derive(Serialize, Clone, Debug)]
pub struct TopEmote {
    pub name: String,
    pub count: u64,
}

#[derive(Serialize, Clone, Debug)]
pub struct TopSpike {
    pub time: f64,
    pub duration: String,
    pub messages: u64,
}

#[derive(Serialize, Clone, Debug)]
pub struct GraphDataPoint {
    pub x: f64,
    pub y: u64,
    pub duration: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subs: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub emotes: Option<Vec<TopEmote>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub messages: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub game: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
pub struct ChapterEntry {
    #[serde(rename = "positionMilliseconds")]
    pub position_milliseconds: u64,
    #[serde(rename = "durationMilliseconds")]
    pub duration_milliseconds: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub game: Option<String>,
    #[serde(rename = "boxArtURL", skip_serializing_if = "Option::is_none")]
    pub box_art_url: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
pub struct GraphResult {
    pub data: Vec<GraphDataPoint>,
    #[serde(rename = "computedThreshold")]
    pub computed_threshold: u64,
    pub percentile: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chapters: Option<Vec<ChapterEntry>>,
    #[serde(rename = "totalMessages", skip_serializing_if = "Option::is_none")]
    pub total_messages: Option<u64>,
    #[serde(rename = "topEmotes", skip_serializing_if = "Option::is_none")]
    pub top_emotes: Option<Vec<TopEmote>>,
    #[serde(rename = "topSpikes", skip_serializing_if = "Option::is_none")]
    pub top_spikes: Option<Vec<TopSpike>>,
}

#[derive(Serialize, Clone, Debug)]
pub struct ClipDataPoint {
    pub x: f64,
    pub y: u64,
    pub duration: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub slug: Option<String>,
    #[serde(rename = "clipDuration", skip_serializing_if = "Option::is_none")]
    pub clip_duration: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub views: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub game: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
pub struct ClipsResult {
    pub data: Vec<ClipDataPoint>,
    #[serde(rename = "totalViews")]
    pub total_views: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chapters: Option<Vec<ChapterEntry>>,
}

// ─── Input types (from frontend) ───────────────────────────────────────────

#[derive(Deserialize, Clone, Debug)]
pub struct WorkerEmoteData {
    pub bttv: Vec<SerializedEmote>,
    pub ffz: Vec<SerializedEmote>,
    pub seventv: Vec<SerializedEmote>,
}

#[derive(Deserialize, Clone, Debug)]
pub struct ChapterPayload {
    pub node: ChapterNodePayload,
}

#[derive(Deserialize, Clone, Debug)]
pub struct ChapterNodePayload {
    #[serde(rename = "positionMilliseconds")]
    pub position_milliseconds: u64,
    #[serde(rename = "durationMilliseconds")]
    pub duration_milliseconds: u64,
    pub details: ChapterDetailsPayload,
}

#[derive(Deserialize, Clone, Debug)]
pub struct ChapterDetailsPayload {
    pub game: Option<ChapterGamePayload>,
}

#[derive(Deserialize, Clone, Debug)]
pub struct ChapterGamePayload {
    #[serde(rename = "displayName")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub display_name: Option<String>,
    #[serde(rename = "boxArtURL")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub box_art_url: Option<String>,
}

#[derive(Deserialize, Clone, Debug)]
pub struct AggregatePayload {
    pub logs: Vec<String>,
    pub duration: f64,
    pub interval: f64,
    pub emotes: WorkerEmoteData,
    pub threshold: f64,
    #[serde(rename = "searchType")]
    pub search_type: String,
    #[serde(rename = "searchTerm", default)]
    pub search_term: Option<String>,
    #[serde(default)]
    pub chapters: Option<Vec<ChapterPayload>>,
}

#[derive(Deserialize, Clone, Debug)]
pub struct AggregateClipsPayload {
    pub clips: Vec<ClipPayload>,
    pub chapters: Option<Vec<ChapterPayload>>,
}

#[derive(Deserialize, Clone, Debug)]
pub struct ClipPayload {
    pub vod_offset: f64,
    pub title: String,
    pub views: u64,
    pub slug: String,
    pub duration: f64,
}

// ─── Chat Render Configuration ──────────────────────────────────────────────

#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ChatRenderConfig {
    pub width: i32,
    pub height: i32,
    pub fps: i32,
    pub generate_mask: bool,
    pub background_color: String,
    pub font_family: String,
    pub font_color: String,
    pub font_size: f32,
    pub show_badges: bool,
    pub enable_bttv: bool,
    pub enable_ffz: bool,
    pub enable7tv: bool,
    pub ignored_users: String,
    pub banned_words: String,
}
