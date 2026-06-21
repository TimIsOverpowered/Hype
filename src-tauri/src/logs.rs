use reqwest::Client;
use std::sync::OnceLock;
use zstd::stream::decode_all;

static HTTP_CLIENT: OnceLock<Client> = OnceLock::new();

fn client() -> &'static Client {
    HTTP_CLIENT.get_or_init(|| {
        Client::builder()
            .timeout(std::time::Duration::from_secs(120))
            .build()
            .unwrap()
    })
}

#[tauri::command]
pub async fn fetch_vod_logs(vod_id: String, token: String) -> Result<Vec<String>, String> {
    let resp = client()
        .get(format!("https://api.hype.lol/v1/vods/{}/logs", vod_id))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| format!("Failed to fetch logs: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("API returned status: {}", resp.status()));
    }

    let compressed = resp
        .bytes()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    let decompressed = decode_all(&compressed[..])
        .map_err(|e| format!("ZSTD decompression failed: {}", e))?;

    let text = String::from_utf8(decompressed)
        .map_err(|e| format!("Invalid UTF-8 in logs: {}", e))?;

    Ok(text.lines().filter(|l| !l.is_empty()).map(String::from).collect())
}
