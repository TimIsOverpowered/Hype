use std::collections::HashMap;
use std::sync::Arc;

use lazy_static::lazy_static;
use serde_json::Value;
use tokio::sync::RwLock;

use crate::media::chat::models::CachedEmote;

lazy_static! {
    pub static ref EMOTE_CACHE: Arc<RwLock<HashMap<String, HashMap<String, CachedEmote>>>> =
        Arc::new(RwLock::new(HashMap::new()));
}

const SEVENTV_ZERO_WIDTH_FLAG: u64 = 1 << 8;

pub async fn init_channel_emotes(broadcaster_id: &str) -> Result<(), String> {
    let mut cache = EMOTE_CACHE.write().await;
    if cache.contains_key(broadcaster_id) {
        return Ok(());
    }

    let mut channel_emotes = HashMap::new();
    let client = reqwest::Client::new();

    fetch_seventv(&client, broadcaster_id, &mut channel_emotes).await;
    fetch_seventv_global(&client, &mut channel_emotes).await;
    fetch_bttv(&client, broadcaster_id, &mut channel_emotes).await;
    fetch_ffz(&client, broadcaster_id, &mut channel_emotes).await;

    cache.insert(broadcaster_id.to_string(), channel_emotes);
    Ok(())
}

async fn fetch_seventv(
    client: &reqwest::Client,
    broadcaster_id: &str,
    channel_emotes: &mut HashMap<String, CachedEmote>,
) {
    let url = format!("https://7tv.io/v3/users/twitch/{}", broadcaster_id);
    let res = match client.get(&url).send().await {
        Ok(r) => r,
        Err(_) => return,
    };

    let json = match res.json::<Value>().await {
        Ok(j) => j,
        Err(_) => return,
    };

    let emotes = match json["emote_set"]["emotes"].as_array() {
        Some(e) => e,
        None => return,
    };

    for emote in emotes {
        let id = emote["id"].as_str().unwrap_or("").to_string();
        let name = emote["name"].as_str().unwrap_or("").to_string();
        let flags = emote["flags"].as_u64().unwrap_or(0);
        let is_zero_width = (flags & SEVENTV_ZERO_WIDTH_FLAG) != 0;

        let width = emote["data"]["host"]["files"]
            .get(0)
            .and_then(|f| f["width"].as_u64())
            .map(|w| w as u32);
        let height = emote["data"]["host"]["files"]
            .get(0)
            .and_then(|f| f["height"].as_u64())
            .map(|h| h as u32);

        channel_emotes.insert(
            name.clone(),
            CachedEmote {
                id,
                code: name.clone(),
                name,
                provider: "7TV".to_string(),
                is_zero_width,
                width,
                height,
            },
        );
    }
}

async fn fetch_seventv_global(
    client: &reqwest::Client,
    channel_emotes: &mut HashMap<String, CachedEmote>,
) {
    let url = "https://7tv.io/v3/emote-sets/global";
    let res = match client.get(url).send().await {
        Ok(r) => r,
        Err(_) => return,
    };

    let json = match res.json::<Value>().await {
        Ok(j) => j,
        Err(_) => return,
    };

    let emotes = match json["emotes"].as_array() {
        Some(e) => e,
        None => return,
    };

    for emote in emotes {
        let id = emote["id"].as_str().unwrap_or("").to_string();
        let name = emote["name"].as_str().unwrap_or("").to_string();
        let flags = emote["flags"].as_u64().unwrap_or(0);
        let is_zero_width = (flags & SEVENTV_ZERO_WIDTH_FLAG) != 0;

        let width = emote["data"]["host"]["files"]
            .get(0)
            .and_then(|f| f["width"].as_u64())
            .map(|w| w as u32);
        let height = emote["data"]["host"]["files"]
            .get(0)
            .and_then(|f| f["height"].as_u64())
            .map(|h| h as u32);

        channel_emotes.insert(
            name.clone(),
            CachedEmote {
                id,
                code: name.clone(),
                name,
                provider: "7TV".to_string(),
                is_zero_width,
                width,
                height,
            },
        );
    }
}

async fn fetch_bttv_emotes(
    client: &reqwest::Client,
    url: &str,
    channel_emotes: &mut HashMap<String, CachedEmote>,
) -> Result<(), String> {
    let emotes: Vec<Value> = client
        .get(url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    for emote_val in emotes {
        let id = emote_val["id"].as_str().unwrap_or("").to_string();
        let code = emote_val["code"].as_str().unwrap_or("").to_string();
        let width = emote_val["width"].as_u64().map(|w| w as u32);
        let height = emote_val["height"].as_u64().map(|h| h as u32);

        channel_emotes.insert(
            code.clone(),
            CachedEmote {
                id,
                code: code.clone(),
                name: code,
                provider: "BTTV".to_string(),
                is_zero_width: false,
                width,
                height,
            },
        );
    }

    Ok(())
}

async fn fetch_bttv(
    client: &reqwest::Client,
    broadcaster_id: &str,
    channel_emotes: &mut HashMap<String, CachedEmote>,
) {
    let global_url = "https://api.betterttv.net/3/cached/emotes/global";
    let channel_url = format!(
        "https://api.betterttv.net/3/cached/users/twitch/{}",
        broadcaster_id
    );

    let _ = fetch_bttv_emotes(client, global_url, channel_emotes).await;

    let json = match client.get(&channel_url).send().await {
        Ok(r) => match r.json::<Value>().await {
            Ok(j) => j,
            Err(_) => return,
        },
        Err(_) => return,
    };

    if let Some(shared) = json["sharedEmotes"].as_array() {
        for emote_val in shared {
            let id = emote_val["id"].as_str().unwrap_or("").to_string();
            let code = emote_val["code"].as_str().unwrap_or("").to_string();
            let width = emote_val["width"].as_u64().map(|w| w as u32);
            let height = emote_val["height"].as_u64().map(|h| h as u32);

            channel_emotes.insert(
                code.clone(),
                CachedEmote {
                    id,
                    code: code.clone(),
                    name: code,
                    provider: "BTTV".to_string(),
                    is_zero_width: false,
                    width,
                    height,
                },
            );
        }
    }

    if let Some(channel) = json["channelEmotes"].as_array() {
        for emote_val in channel {
            let id = emote_val["id"].as_str().unwrap_or("").to_string();
            let code = emote_val["code"].as_str().unwrap_or("").to_string();
            let width = emote_val["width"].as_u64().map(|w| w as u32);
            let height = emote_val["height"].as_u64().map(|h| h as u32);

            channel_emotes.insert(
                code.clone(),
                CachedEmote {
                    id,
                    code: code.clone(),
                    name: code,
                    provider: "BTTV".to_string(),
                    is_zero_width: false,
                    width,
                    height,
                },
            );
        }
    }
}

async fn fetch_ffz(
    client: &reqwest::Client,
    broadcaster_id: &str,
    channel_emotes: &mut HashMap<String, CachedEmote>,
) {
    let url = format!("https://api.frankerfacez.com/v1/room/id/{}", broadcaster_id);

    let json = match client.get(&url).send().await {
        Ok(r) => match r.json::<Value>().await {
            Ok(j) => j,
            Err(_) => return,
        },
        Err(_) => return,
    };

    let room_set = json["room"]["set"].as_u64().unwrap_or(0) as u32;
    let set_key = room_set.to_string();
    let emoticons = match json["sets"][&set_key]["emoticons"].as_array() {
        Some(e) => e,
        None => return,
    };

    for emote in emoticons {
        let id = emote["id"].as_u64().map(|i| i.to_string()).unwrap_or_default();
        let name = emote["name"].as_str().unwrap_or("").to_string();
        let code = emote["name"].as_str().unwrap_or("").to_string();
        let width = emote["width"].as_u64().map(|w| w as u32);
        let height = emote["height"].as_u64().map(|h| h as u32);

        channel_emotes.insert(
            code.clone(),
            CachedEmote {
                id,
                code,
                name,
                provider: "FFZ".to_string(),
                is_zero_width: false,
                width,
                height,
            },
        );
    }
}
