function isVideoUrl(url: string): boolean {
  return url.includes('cloudfront.net') || url.includes('.ttvnw.net') || /^https:\/\/vod-[\w-]+\.twitch\.tv/i.test(url);
}

export const nativeFetch = window.fetch.bind(window);

export function setupNetworkInterceptor(proxyPort: number) {
  const proxied = (url: string) => `http://127.0.0.1:${proxyPort}/proxy?url=${encodeURIComponent(url)}`;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString();

    if (isVideoUrl(url)) {
      return nativeFetch(proxied(url), init);
    }

    return nativeFetch(input, init);
  };
}
