import {
  BufferTarget,
  Conversion,
  HLS_FORMATS,
  Input,
  Mp4OutputFormat,
  Output as OutputClass,
  UrlSource,
} from 'mediabunny';

/**
 * Clip a Twitch VOD from an HLS (.m3u8) stream using MediaBunny WebCodecs.
 *
 * Matches v1.0 `clip(start, end, m3u8, progressBar, path)` behavior:
 * - Seek to `startSeconds`
 * - Clip for `durationSeconds`
 * - Stream-copy (no re-encoding)
 * - Return MP4 as Blob
 *
 * @example
 * const blob = await clipVod(m3u8Url, 120, 30, (p) => setProgress(p));
 * await writeFile('clip.mp4', new File([blob], 'clip.mp4'));
 */
export async function clipVod(
  m3u8Url: string,
  startSeconds: number,
  durationSeconds: number,
  onProgress: (percent: number) => void,
): Promise<Blob> {
  const input = new Input({
    source: new UrlSource(m3u8Url),
    formats: HLS_FORMATS,
  });

  const output = new OutputClass({
    format: new Mp4OutputFormat(),
    target: new BufferTarget(),
  });

  const conversion = await Conversion.init({
    input,
    output,
    trim: {
      start: startSeconds,
      end: startSeconds + durationSeconds,
    },
  });

  if (!conversion.isValid) {
    const reasons = conversion.discardedTracks.map((t) => `${t.track.name ?? 'unknown'}: ${t.reason}`).join('; ');
    throw new Error(`Cannot clip: ${reasons}`);
  }

  conversion.onProgress = (progress: number) => {
    onProgress(Math.round(progress * 100));
  };

  await conversion.execute();

  const buffer = output.target.buffer;

  if (!buffer) {
    throw new Error('Conversion produced no output buffer');
  }

  const blob = new Blob([buffer], { type: 'video/mp4' });

  return blob;
}

/**
 * Download a full Twitch VOD from an HLS (.m3u8) stream using MediaBunny WebCodecs.
 *
 * Matches v1.0 `downloadVod(m3u8, duration, progressBar, path)` behavior:
 * - No seek — consume entire stream
 * - Stream-copy (no re-encoding)
 * - Return MP4 as Blob
 *
 * @example
 * const blob = await downloadVod(m3u8Url, 3600, (p) => setProgress(p));
 * await writeFile('vod.mp4', new File([blob], 'vod.mp4'));
 */
export async function downloadVod(
  m3u8Url: string,
  durationSeconds: number,
  onProgress: (percent: number) => void,
): Promise<Blob> {
  const input = new Input({
    source: new UrlSource(m3u8Url),
    formats: HLS_FORMATS,
  });

  const output = new OutputClass({
    format: new Mp4OutputFormat(),
    target: new BufferTarget(),
  });

  const conversion = await Conversion.init({
    input,
    output,
  });

  if (!conversion.isValid) {
    const reasons = conversion.discardedTracks.map((t) => `${t.track.name ?? 'unknown'}: ${t.reason}`).join('; ');
    throw new Error(`Cannot download: ${reasons}`);
  }

  const startTime = performance.now();
  conversion.onProgress = (progress: number) => {
    const elapsed = (performance.now() - startTime) / 1000;
    if (elapsed > 0 && durationSeconds > 0) {
      const eta = elapsed / progress - elapsed;
      if (eta > durationSeconds * 3) {
        onProgress(0);
        throw new Error('Download appears stuck, aborting');
      }
    }
    onProgress(Math.min(100, Math.round(progress * 100)));
  };

  await conversion.execute();

  const buffer = output.target.buffer;

  if (!buffer) {
    throw new Error('Conversion produced no output buffer');
  }

  const blob = new Blob([buffer], { type: 'video/mp4' });

  return blob;
}
