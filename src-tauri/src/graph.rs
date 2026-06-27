use std::collections::HashMap;

use crate::media::chat::emotes::count_emotes_in_message;
use crate::media::chat::models::{
    AggregateClipsPayload, AggregatePayload, ChapterEntry, ChapterPayload, ClipDataPoint,
    ClipPayload, ClipsResult, GraphDataPoint, GraphResult, SerializedEmote, TopEmote, TopSpike,
};
use crate::utils::{parse_timecode, to_hhmmss};

const MIN_LOG_LINE_LENGTH: usize = 10;
const TOP_EMOTES_COUNT: usize = 5;
const SPIKE_PROXIMITY_LIMIT: f64 = 120.0;

struct ChapterEntryInternal {
    position_milliseconds: u64,
    duration_milliseconds: u64,
    game: Option<String>,
    box_art_url: Option<String>,
}

fn build_chapter_lookup(chapters: &Option<Vec<ChapterPayload>>) -> Vec<ChapterEntryInternal> {
    chapters
        .iter()
        .flat_map(|v| v.as_slice())
        .map(|c| ChapterEntryInternal {
            position_milliseconds: c.node.position_milliseconds,
            duration_milliseconds: c.node.duration_milliseconds,
            game: c
                .node
                .details
                .game
                .as_ref()
                .and_then(|g| g.display_name.clone()),
            box_art_url: c
                .node
                .details
                .game
                .as_ref()
                .and_then(|g| g.box_art_url.clone()),
        })
        .collect()
}

fn get_game_for_timestamp(
    timestamp_ms: u64,
    chapter_lookup: &[ChapterEntryInternal],
) -> Option<String> {
    let mut lo = 0usize;
    let mut hi = chapter_lookup.len().saturating_sub(1);
    while lo <= hi {
        let mid = lo + (hi - lo) / 2;
        let chapter = &chapter_lookup[mid];
        if timestamp_ms < chapter.position_milliseconds {
            hi = mid.saturating_sub(1);
        } else if timestamp_ms >= chapter.position_milliseconds + chapter.duration_milliseconds {
            lo = mid + 1;
        } else {
            return chapter.game.clone();
        }
    }
    None
}

fn parse_log_line(line: &str) -> Option<(f64, String, String)> {
    let bracket_open = line.find('[')?;
    let bracket_close = line.find(']')?;

    let time_str = &line[bracket_open + 1..bracket_close];
    let timestamp = parse_timecode(time_str);

    let after_bracket = &line[bracket_close + 1..];
    let colon_index = after_bracket.find(": ")?;

    let username = after_bracket[1..colon_index].trim().to_string();
    let message = after_bracket[colon_index + 2..].trim().to_string();

    Some((timestamp, username, message))
}

fn build_emote_lookup(
    bttv: &[SerializedEmote],
    ffz: &[SerializedEmote],
    seventv: &[SerializedEmote],
) -> HashMap<String, ()> {
    let capacity = bttv.len() + ffz.len() + seventv.len();
    let mut lookup = HashMap::with_capacity(capacity);

    for emote in bttv {
        lookup.insert(emote.code.clone(), ());
    }

    for emote in ffz {
        lookup.entry(emote.code.clone()).or_insert(());
    }

    for emote in seventv {
        lookup.entry(emote.name.clone()).or_insert(());
    }

    lookup
}

fn percentile(sorted: &[u64], p: f64) -> f64 {
    if sorted.is_empty() {
        return 0.0;
    }
    if sorted.len() == 1 {
        return sorted[0] as f64;
    }
    let index = (p / 100.0) * (sorted.len() as f64 - 1.0);
    let lower = index.floor() as usize;
    let upper = index.ceil() as usize;
    let lower = lower.min(sorted.len() - 1);
    let upper = upper.min(sorted.len() - 1);
    if lower == upper {
        return sorted[lower] as f64;
    }
    let weight = index - lower as f64;
    sorted[lower] as f64 * (1.0 - weight) + sorted[upper] as f64 * weight
}

struct BucketData {
    messages: u64,
    subs: u64,
    emotes: HashMap<String, u64>,
    search_matches: u64,
    game: Option<String>,
}

pub fn aggregate_logs(payload: AggregatePayload) -> GraphResult {
    let emote_lookup = build_emote_lookup(
        &payload.emotes.bttv,
        &payload.emotes.ffz,
        &payload.emotes.seventv,
    );
    let chapter_lookup = build_chapter_lookup(&payload.chapters);

    let mut buckets: HashMap<i64, BucketData> = HashMap::new();
    let mut total_messages: u64 = 0;
    let mut global_emotes: HashMap<String, u64> = HashMap::new();

    let search_lower: Option<String> = if payload.search_type == "search" {
        payload.search_term.as_deref().map(|s| s.to_lowercase())
    } else {
        None
    };

    for log in payload.logs {
        if log.len() < MIN_LOG_LINE_LENGTH {
            continue;
        }

        let Some((timestamp, username, message)) = parse_log_line(&log) else {
            continue;
        };

        let bucket_key = ((timestamp / payload.interval).floor() * payload.interval) as i64;
        if (bucket_key as f64) >= payload.duration {
            continue;
        }

        let bucket = buckets.entry(bucket_key).or_insert(BucketData {
            messages: 0,
            subs: 0,
            emotes: HashMap::new(),
            search_matches: 0,
            game: None,
        });

        if bucket.game.is_none() && !chapter_lookup.is_empty() {
            bucket.game = get_game_for_timestamp((bucket_key as u64) * 1000, &chapter_lookup);
        }

        bucket.messages += 1;
        total_messages += 1;

        if username == "twitchnotify" {
            bucket.subs += 1;
        }

        let emote_counts = count_emotes_in_message(&message, &emote_lookup);
        for (name, count) in &emote_counts {
            *bucket.emotes.entry(name.clone()).or_insert(0) += count;
            *global_emotes.entry(name.clone()).or_insert(0) += count;
        }

        if let Some(ref term) = search_lower {
            let words: Vec<&str> = message.split_whitespace().collect();
            for word in words {
                if word.to_lowercase() == *term {
                    bucket.search_matches += 1;
                }
            }
        }
    }

    // Top spikes
    let mut all_buckets: Vec<_> = buckets
        .iter()
        .map(|(&k, v)| (k as f64, v.messages))
        .collect();
    all_buckets.sort_by(|a, b| b.1.cmp(&a.1));

    let mut top_spikes: Vec<TopSpike> = Vec::new();
    for (x, messages) in &all_buckets {
        if *messages == 0 {
            continue;
        }
        let is_near = top_spikes
            .iter()
            .any(|s| (s.time - x).abs() < SPIKE_PROXIMITY_LIMIT);
        if !is_near {
            top_spikes.push(TopSpike {
                time: *x,
                duration: to_hhmmss(*x),
                messages: *messages,
            });
            if top_spikes.len() >= 10 {
                break;
            }
        }
    }
    top_spikes.sort_by(|a, b| b.messages.cmp(&a.messages));

    // Top emotes
    let mut overall_top_emotes: Vec<TopEmote> = global_emotes
        .iter()
        .map(|(name, count)| TopEmote {
            name: name.clone(),
            count: *count,
        })
        .collect();
    overall_top_emotes.sort_by(|a, b| b.count.cmp(&a.count));
    overall_top_emotes.truncate(15);

    let chapters: Vec<ChapterEntry> = chapter_lookup
        .iter()
        .map(|c| ChapterEntry {
            position_milliseconds: c.position_milliseconds,
            duration_milliseconds: c.duration_milliseconds,
            game: c.game.clone(),
            box_art_url: c.box_art_url.clone(),
        })
        .collect();

    let percentile_value = if payload.search_type != "search" {
        let mut counts: Vec<u64> = buckets.values().map(|v| v.messages).collect();
        counts.sort_unstable();
        percentile(&counts, 25.0)
    } else {
        0.0
    };

    let results: Vec<_> = if payload.search_type == "search" {
        let search_threshold = if payload.threshold > 0.0 {
            payload.threshold
        } else {
            1.0
        };

        buckets
            .iter()
            .filter(|(_, v)| v.search_matches >= search_threshold as u64)
            .map(|(&k, v)| (k as f64, v))
            .collect()
    } else {
        let effective_threshold = if payload.threshold > 0.0 {
            payload.threshold
        } else {
            percentile_value.max(1.0)
        };

        buckets
            .iter()
            .filter(|(_, v)| v.messages >= effective_threshold as u64)
            .map(|(&k, v)| (k as f64, v))
            .collect()
    };

    let mut results: Vec<(f64, &BucketData)> = results;
    results.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));

    let is_search = payload.search_type == "search";

    let data: Vec<GraphDataPoint> = results
        .iter()
        .map(|(x, v)| {
            let mut top_emotes: Vec<TopEmote> = v
                .emotes
                .iter()
                .map(|(name, count)| TopEmote {
                    name: name.clone(),
                    count: *count,
                })
                .collect();
            top_emotes.sort_by(|a, b| b.count.cmp(&a.count));
            top_emotes.truncate(TOP_EMOTES_COUNT);

            GraphDataPoint {
                x: *x,
                y: if is_search {
                    v.search_matches
                } else {
                    v.messages
                },
                duration: to_hhmmss(*x),
                subs: if v.subs > 0 { Some(v.subs) } else { None },
                emotes: if !top_emotes.is_empty() {
                    Some(top_emotes)
                } else {
                    None
                },
                messages: Some(if is_search {
                    v.search_matches
                } else {
                    v.messages
                }),
                game: v.game.clone(),
            }
        })
        .collect();

    let threshold = if payload.search_type == "search" {
        if payload.threshold > 0.0 {
            payload.threshold as u64
        } else {
            1
        }
    } else if payload.threshold > 0.0 {
        payload.threshold as u64
    } else {
        (percentile_value as u64).max(1)
    };

    let percentile_value = if payload.search_type == "search" {
        0
    } else {
        percentile_value as u64
    };

    let result = GraphResult {
        data,
        computed_threshold: threshold,
        percentile: percentile_value,
        chapters: Some(chapters),
        total_messages: Some(total_messages),
        top_emotes: if !overall_top_emotes.is_empty() {
            Some(overall_top_emotes)
        } else {
            None
        },
        top_spikes: if !top_spikes.is_empty() {
            Some(top_spikes)
        } else {
            None
        },
    };

    result
}

pub fn aggregate_clips(payload: AggregateClipsPayload) -> ClipsResult {
    let chapter_lookup = build_chapter_lookup(&payload.chapters);

    let mut clip_map: HashMap<i64, ClipPayload> = HashMap::new();
    for clip in &payload.clips {
        let key = clip.vod_offset as i64;
        let existing = clip_map.get(&key);
        match existing {
            Some(e) if clip.views > e.views => {
                clip_map.insert(key, clip.clone());
            }
            None => {
                clip_map.insert(key, clip.clone());
            }
            _ => {}
        }
    }

    let mut unique_clips: Vec<_> = clip_map.into_iter().collect();
    unique_clips.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));

    let data: Vec<ClipDataPoint> = unique_clips
        .iter()
        .map(|(vod_offset, clip)| {
            let game =
                get_game_for_timestamp((*vod_offset as f64 * 1000.0) as u64, &chapter_lookup);
            ClipDataPoint {
                x: *vod_offset as f64 - clip.duration,
                y: clip.views,
                duration: to_hhmmss(*vod_offset as f64 - clip.duration),
                title: Some(clip.title.clone()),
                slug: Some(clip.slug.clone()),
                clip_duration: Some(clip.duration as u64),
                views: Some(clip.views),
                game,
            }
        })
        .collect();

    let total_views: u64 = data.iter().map(|d| d.y).sum();

    let chapters: Vec<ChapterEntry> = chapter_lookup
        .iter()
        .map(|c| ChapterEntry {
            position_milliseconds: c.position_milliseconds,
            duration_milliseconds: c.duration_milliseconds,
            game: c.game.clone(),
            box_art_url: c.box_art_url.clone(),
        })
        .collect();

    ClipsResult {
        data,
        total_views,
        chapters: if chapters.is_empty() {
            None
        } else {
            Some(chapters)
        },
    }
}
