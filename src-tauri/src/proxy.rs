use axum::{
    body::Body,
    extract::Query,
    http::{header, HeaderMap, StatusCode, Response},
    response::IntoResponse,
    routing::get,
    Router,
};
use std::{collections::HashMap, sync::OnceLock};

static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

fn client() -> &'static reqwest::Client {
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .pool_max_idle_per_host(8)
            .build()
            .unwrap()
    })
}

async fn proxy(
    Query(params): Query<HashMap<String, String>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let Some(url) = params.get("url") else {
        return (StatusCode::BAD_REQUEST, "missing url").into_response();
    };

    let mut req = client().get(url);
    if let Some(range) = headers.get(header::RANGE) {
        req = req.header(header::RANGE, range);
    }

    let upstream = match req.send().await {
        Ok(r) => r,
        Err(e) => return (StatusCode::BAD_GATEWAY, e.to_string()).into_response(),
    };

    let status = upstream.status();
    let content_type = upstream.headers().get(header::CONTENT_TYPE).cloned();
    let content_range = upstream.headers().get(header::CONTENT_RANGE).cloned();
    let final_url = upstream.url().to_string();

    let mut resp = Response::builder()
        .status(status)
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header("x-final-url", final_url);
    if let Some(ct) = content_type {
        resp = resp.header(header::CONTENT_TYPE, ct);
    }
    if let Some(cr) = content_range {
        resp = resp.header(header::CONTENT_RANGE, cr);
    }

    resp.body(Body::from_stream(upstream.bytes_stream())).unwrap()
}

static PORT: OnceLock<u16> = OnceLock::new();

pub fn init() -> u16 {
    *PORT.get_or_init(|| {
        let std_listener = std::net::TcpListener::bind("127.0.0.1:0")
            .expect("failed to bind proxy listener");
        std_listener
            .set_nonblocking(true)
            .expect("failed to set nonblocking");
        let port = std_listener.local_addr().unwrap().port();

        tauri::async_runtime::spawn(async move {
            let listener = tokio::net::TcpListener::from_std(std_listener)
                .expect("failed to convert listener");
            let app = Router::new().route("/proxy", get(proxy));
            if let Err(e) = axum::serve(listener, app).await {
                eprintln!("[proxy] server exited: {e}");
            }
        });

        port
    })
}

#[tauri::command]
pub fn get_proxy_port() -> u16 {
    init()
}
