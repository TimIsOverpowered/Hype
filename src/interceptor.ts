import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

function isVideoUrl(url: string): boolean {
  return url.includes('cloudfront.net') || url.includes('.ttvnw.net') || /^https:\/\/vod-[\w-]+\.twitch\.tv/i.test(url);
}

export function setupNetworkInterceptor() {
  const origFetch = window.fetch;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString();

    if (isVideoUrl(url)) {
      return tauriFetch(url, init);
    }

    return origFetch(input, init);
  };
}
