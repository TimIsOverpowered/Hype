use serde::Serialize;

#[derive(Serialize, Clone, Debug)]
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

#[derive(Serialize, Clone, Debug)]
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

#[derive(Serialize, Clone, Debug)]
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
