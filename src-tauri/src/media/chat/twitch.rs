use std::collections::HashMap;


use regex::Regex;
use serde::Serialize;
use serde_json::json;

use crate::media::chat::emotes::EMOTE_CACHE;
use crate::media::chat::models::{
    BadgeSet, CachedEmote, ChatBadge, CheerBadge, FormattedFragment, FormattedMessage, TwitchBadge,
};

const BACKUP_CLIENT_ID: &str = "kd1unb4b3q4t58fwlpcbzcbnm76a8fp";
const PRIMARY_CLIENT_ID: &str = "kimne78kx3ncx6brgo4mv6wki5h1ko";

pub async fn fetch_badges(vod_id: &str) -> Result<BadgeSet, String> {
    let client = reqwest::Client::new();

    let payload = json!({
        "operationName": "VideoComments",
        "variables": {
            "videoID": vod_id,
            "hasVideoID": true,
        },
        "extensions": {
            "persistedQuery": {
                "version": 1,
                "sha256Hash": "be06407e8d7cda72f2ee086ebb11abb6b062a7deb8985738e648090904d2f0eb"
            }
        }
    });

    let res = client
        .post("https://gql.twitch.tv/gql")
        .header("Client-Id", PRIMARY_CLIENT_ID)
        .header("Content-Type", "text/plain;charset=UTF-8")
        .json(&payload)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;

    if let Some(errors) = json.get("errors").and_then(|e| e.as_array()) {
        let messages: Vec<String> = errors
            .iter()
            .filter_map(|e| e["message"].as_str().map(|s| s.to_string()))
            .collect();
        return Err(format!("GQL errors: {}", messages.join(", ")));
    }

    let data = json.get("data").ok_or("No data in response")?;

    let global_badges: Option<Vec<TwitchBadge>> =
        data.get("badges").and_then(|b| b.as_array()).map(|arr| {
            arr.iter()
                .map(|b| TwitchBadge {
                    set_id: b["setID"].as_str().unwrap_or("").to_string(),
                    version: b["version"].as_str().unwrap_or("").to_string(),
                    image_1x: b["image1x"].as_str().unwrap_or("").to_string(),
                    image_2x: b["image2x"].as_str().unwrap_or("").to_string(),
                    image_4x: b["image4x"].as_str().unwrap_or("").to_string(),
                })
                .collect()
        });

    let video = data.get("video");
    let owner = video.and_then(|v| v.get("owner"));
    let broadcast_badges: Option<Vec<TwitchBadge>> = owner
        .and_then(|o| o.get("broadcastBadges"))
        .and_then(|b| b.as_array())
        .map(|arr| {
            arr.iter()
                .map(|b| TwitchBadge {
                    set_id: b["setID"].as_str().unwrap_or("").to_string(),
                    version: b["version"].as_str().unwrap_or("").to_string(),
                    image_1x: b["image1x"].as_str().unwrap_or("").to_string(),
                    image_2x: b["image2x"].as_str().unwrap_or("").to_string(),
                    image_4x: b["image4x"].as_str().unwrap_or("").to_string(),
                })
                .collect()
        });

    let cheer_badges: Option<Vec<CheerBadge>> = owner
        .and_then(|o| o.get("cheer"))
        .and_then(|c| c.as_array())
        .map(|arr| {
            arr.iter()
                .map(|b| CheerBadge {
                    image_1x: b["image1x"].as_str().unwrap_or("").to_string(),
                    image_2x: b["image2x"].as_str().unwrap_or("").to_string(),
                    image_4x: b["image4x"].as_str().unwrap_or("").to_string(),
                    can_show_globally: b["canShowGlobally"].as_bool().unwrap_or(false),
                    minimum_cheer_amount: b["minimumCheerAmount"].as_u64().unwrap_or(0),
                })
                .collect()
        });

    Ok(BadgeSet {
        global_badges,
        channel_badges: broadcast_badges,
        channel_cheer_badges: cheer_badges,
    })
}

#[derive(Serialize, Clone)]
pub struct ChatBatchResponse {
    pub messages: Vec<FormattedMessage>,
    pub next_cursor: Option<String>,
}

pub async fn fetch_and_parse_comments(
    vod_id: &str,
    broadcaster_id: &str,
    offset_seconds: Option<f64>,
    cursor: Option<String>,
) -> Result<ChatBatchResponse, String> {
    let client = reqwest::Client::new();

    let variables = if let Some(c) = cursor {
        json!({ "videoID": vod_id, "cursor": c })
    } else {
        json!({ "videoID": vod_id, "contentOffsetSeconds": offset_seconds.map(|o| o.floor() as i32).unwrap_or(0) })
    };

    let payload = json!({
        "operationName": "VideoCommentsByOffsetOrCursor",
        "variables": variables,
        "extensions": {
            "persistedQuery": {
                "version": 1,
                "sha256Hash": "b70a3591ff0f4e0313d126c6a1502d79a1c02baebb288227c582044aa76adf6a"
            }
        }
    });

    let res = client
        .post("https://gql.twitch.tv/gql")
        .header("Client-Id", BACKUP_CLIENT_ID)
        .header("Content-Type", "text/plain;charset=UTF-8")
        .json(&payload)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;

    if let Some(errors) = json.get("errors").and_then(|e| e.as_array()) {
        let messages: Vec<String> = errors
            .iter()
            .filter_map(|e| e["message"].as_str().map(|s| s.to_string()))
            .collect();
        return Err(format!("GQL errors: {}", messages.join(", ")));
    }

    let mut messages = Vec::new();
    let mut next_cursor = None;

    let cache = EMOTE_CACHE.read().await;
    let emote_dict = cache.get(broadcaster_id);

    let edges = match json
        .get("data")
        .and_then(|d| d.get("video"))
        .and_then(|v| v.get("comments"))
        .and_then(|c| c.get("edges"))
        .and_then(|e| e.as_array())
    {
        Some(e) => e,
        None => {
            return Ok(ChatBatchResponse {
                messages,
                next_cursor,
            })
        }
    };

    for edge in edges {
        let node = match edge.get("node") {
            Some(n) => n,
            None => continue,
        };

        let id = node["id"].as_str().unwrap_or("").to_string();
        let display_name = node["commenter"]["displayName"]
            .as_str()
            .unwrap_or("Unknown")
            .to_string();
        let user_color = node["message"]["userColor"]
            .as_str()
            .unwrap_or("")
            .to_string();
        let offset = node["contentOffsetSeconds"].as_f64().unwrap_or(0.0);

        let mut badges = Vec::new();
        if let Some(user_badges) = node["message"]["userBadges"].as_array() {
            for b in user_badges {
                badges.push(ChatBadge {
                    set_id: b["setID"].as_str().unwrap_or("").to_string(),
                    version: b["version"].as_str().unwrap_or("").to_string(),
                });
            }
        }

        let formatted_fragments = parse_fragments(
            node["message"]["fragments"]
                .as_array()
                .map(|v| v.as_slice()),
            emote_dict,
        );

        messages.push(FormattedMessage {
            id,
            display_name,
            user_color,
            content_offset_seconds: offset,
            badges: Some(badges),
            fragments: formatted_fragments,
        });
    }

    if let Some(last_edge) = edges.last() {
        next_cursor = last_edge["cursor"].as_str().map(|s| s.to_string());
    }

    Ok(ChatBatchResponse {
        messages,
        next_cursor,
    })
}

fn is_url(word: &str) -> bool {
    word.starts_with("http://") || word.starts_with("https://")
}

// Highly specific Regex that extracts individual emojis while preserving valid Zero-Width Joiner (ZWJ) sequences
static EMOJI_RE: std::sync::LazyLock<Regex> = std::sync::LazyLock::new(|| {
    Regex::new(r"(?x)
        (?:
            [\p{Emoji_Presentation}\p{Extended_Pictographic}]
            [\x{1F3FB}-\x{1F3FF}]?
            \x{FE0F}?
        )
        (?:
            \x{200D}
            (?:
                [\p{Emoji_Presentation}\p{Extended_Pictographic}\x{2640}\x{2642}]
                [\x{1F3FB}-\x{1F3FF}]?
                \x{FE0F}?
            )
        )*
    ").unwrap()
});

// Intercepts a word block (like "LUL😂😂") and cleanly separates the text from the emojis
fn split_emojis_and_text(text: &str) -> Vec<FormattedFragment> {
    let mut result = Vec::new();
    let mut last_end = 0;

    for mat in EMOJI_RE.find_iter(text) {
        let start = mat.start();
        let end = mat.end();

        if start > last_end {
            result.push(FormattedFragment::Text {
                text: text[last_end..start].to_string(),
            });
        }

        result.push(FormattedFragment::Emoji {
            text: mat.as_str().to_string(),
        });

        last_end = end;
    }

    if last_end < text.len() {
        result.push(FormattedFragment::Text {
            text: text[last_end..].to_string(),
        });
    }

    result
}

fn parse_fragments(
    fragments: Option<&[serde_json::Value]>,
    emote_dict: Option<&HashMap<String, CachedEmote>>,
) -> Vec<FormattedFragment> {
    let Some(fragments_array) = fragments else {
        return Vec::new();
    };

    let mut result = Vec::new();

    for frag in fragments_array {
        let text = frag["text"].as_str().unwrap_or("").to_string();
        if text.is_empty() {
            continue;
        }

        if frag.get("emote").and_then(|e| e.get("emoteID")).is_some() {
            let emote_id = frag["emote"]["emoteID"].as_str().unwrap_or("").to_string();
            result.push(FormattedFragment::Twitch { emote_id, text });
            continue;
        }

        let words: Vec<&str> = text.split_whitespace().collect();
        if words.is_empty() {
            result.push(FormattedFragment::Text { text });
            continue;
        }

        for (i, word) in words.iter().enumerate() {
            if is_url(word) {
                result.push(FormattedFragment::Url {
                    text: word.to_string(),
                });
                if i < words.len() - 1 {
                    result.push(FormattedFragment::Text {
                        text: " ".to_string(),
                    });
                }
                continue;
            } else if let Some(dict) = emote_dict {
                if let Some(cached_emote) = dict.get(*word) {
                    result.push(FormattedFragment::Custom {
                        id: cached_emote.id.clone(),
                        code: cached_emote.code.clone(),
                        name: cached_emote.name.clone(),
                        provider: cached_emote.provider.clone(),
                        is_zero_width: cached_emote.is_zero_width,
                        width: cached_emote.width,
                        height: cached_emote.height,
                    });
                    if i < words.len() - 1 {
                        result.push(FormattedFragment::Text {
                            text: " ".to_string(),
                        });
                    }
                    continue;
                }
            }

            // Not a URL and not a Custom Emote -> Send through the Emoji extractor
            let parts = split_emojis_and_text(word);
            result.extend(parts);

            if i < words.len() - 1 {
                result.push(FormattedFragment::Text {
                    text: " ".to_string(),
                });
            }
        }
    }

    result
}
