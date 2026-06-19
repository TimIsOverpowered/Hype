import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

const createStats = () => ({
  aborted: false,
  loaded: 0,
  retry: 0,
  total: 0,
  chunkCount: 0,
  bwEstimate: 0,
  loading: { start: 0, first: 0, end: 0 },
  parsing: { start: 0, end: 0 },
  buffering: { start: 0, first: 0, end: 0 },
});

export class TauriHlsLoader {
  // biome-ignore lint/suspicious/noExplicitAny: hls.js loader types
  context: any;
  // biome-ignore lint/suspicious/noExplicitAny: hls.js loader types
  callbacks: any;
  // biome-ignore lint/suspicious/noExplicitAny: hls.js loader types
  stats: any;
  controller: AbortController | null = null;
  isFinished: boolean = false;

  // biome-ignore lint/suspicious/noExplicitAny: hls.js loader types
  constructor(_config: any) {
    this.stats = createStats();
  }

  // biome-ignore lint/suspicious/noExplicitAny: hls.js loader signature
  load(context: any, _config: any, callbacks: any) {
    this.context = context;
    this.callbacks = callbacks;
    this.controller = new AbortController();
    this.isFinished = false;

    if (context.frag?.stats) {
      this.stats = context.frag.stats;
    } else if (context.stats) {
      this.stats = context.stats;
    }

    if (!this.stats.loading) this.stats.loading = { start: 0, first: 0, end: 0 };
    if (!this.stats.parsing) this.stats.parsing = { start: 0, end: 0 };
    if (!this.stats.buffering) this.stats.buffering = { start: 0, first: 0, end: 0 };

    this.stats.loading.start = performance.now();

    tauriFetch(context.url, {
      method: 'GET',
      signal: this.controller.signal,
    })
      .then(async (response) => {
        this.stats.loading.first = Math.max(this.stats.loading.start, performance.now());

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} - ${response.statusText}`);
        }

        const buffer = await response.arrayBuffer();

        if (this.stats.aborted) {
          return;
        }

        this.isFinished = true;

        this.stats.loading.end = Math.max(this.stats.loading.first, performance.now());
        this.stats.loaded = buffer.byteLength;
        this.stats.total = buffer.byteLength;

        const isText = context.url.includes('.m3u8') || context.responseType === 'text';
        const data = isText ? new TextDecoder().decode(buffer) : buffer;

        setTimeout(() => {
          if (this.callbacks?.onSuccess) {
            this.callbacks.onSuccess({ url: response.url || context.url, data }, this.stats, context);
          }
        }, 0);
      })
      .catch((error: unknown) => {
        if (this.stats.aborted || (error instanceof Error && error.name === 'AbortError')) {
          return;
        }

        const message = error instanceof Error ? error.message : String(error);

        if (message.includes('resource id') || message.includes('invalid')) {
          return;
        }

        console.error(`[Tauri Loader] Error:`, message);

        if (this.callbacks?.onError) {
          this.callbacks.onError({ code: 0, text: message }, context, null, this.stats);
        }
      });
  }

  abort() {
    if (this.stats.aborted) return;

    this.stats.aborted = true;

    if (this.controller && !this.isFinished) {
      try {
        this.controller.abort();
      } catch {
        console.warn('[Tauri Loader] Ignored abort error');
      }
    }

    if (this.callbacks?.onAbort) {
      this.callbacks.onAbort(this.stats, this.context, null);
    }
  }

  destroy() {
    this.stats.aborted = true;

    if (this.controller && !this.isFinished) {
      try {
        this.controller.abort();
      } catch {
        // silent
      }
    }

    this.callbacks = null;
    this.context = null;
  }
}
