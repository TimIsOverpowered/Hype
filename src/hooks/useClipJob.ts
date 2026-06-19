import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { save } from '@tauri-apps/plugin-dialog';
import { parse as hlsParse } from 'hls-parser';
import { useCallback, useRef, useState } from 'react';
import { ELAPSED_TIMER_INTERVAL_MS } from '../constants/ui';
import { toHHMMSS } from '../utils/time';

type JobType = 'clip' | 'download';

interface ProgressPayload {
  percent: number;
  elapsed: number;
  eta: number;
}

interface UseClipJobResult {
  progress: number;
  isRunning: boolean;
  error: string | null;
  elapsed: number;
  startClip: (vodId: string, m3u8Url: string, startSeconds: number, durationSeconds: number) => Promise<void>;
  startDownload: (m3u8Url: string, durationSeconds: number) => Promise<void>;
  cancel: () => void;
}

async function detectFmp4(m3u8Url: string): Promise<boolean> {
  const response = await fetch(m3u8Url);
  const content = await response.text();
  const parsed = hlsParse(content);
  if (!('segments' in parsed)) return false;
  const mediaPlaylist = parsed as typeof parsed & {
    segments: Array<{ uri?: string; map?: { uri?: string } }>;
  };
  return mediaPlaylist.segments.some((seg) => seg.map?.uri != null && seg.map.uri !== '');
}

export function useClipJob(): UseClipJobResult {
  const [progress, setProgress] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const cancelledRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cancel = useCallback(async () => {
    cancelledRef.current = true;
    clearTimer();
    try {
      await invoke('cancel_job');
    } catch {
      // Ignore cancel errors
    }
  }, [clearTimer]);

  const runJob = useCallback(
    async (m3u8Url: string, startSeconds: number, durationSeconds: number, jobType: JobType, defaultName: string) => {
      cancelledRef.current = false;
      setIsRunning(true);
      setError(null);
      setProgress(0);
      setElapsed(0);

      clearTimer();
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, ELAPSED_TIMER_INTERVAL_MS);

      const isFmp4 = await detectFmp4(m3u8Url);

      const outputPath = await save({
        defaultPath: defaultName,
        filters: [{ name: 'Video', extensions: ['mp4'] }],
      });

      if (!outputPath) {
        setIsRunning(false);
        clearTimer();
        return;
      }

      const unlistenProgress = await listen<ProgressPayload>(
        jobType === 'clip' ? 'clip-progress' : 'download-progress',
        (event) => {
          if (cancelledRef.current) return;
          const p = event.payload;
          setProgress(Math.min(p.percent, 100));

          if (p.percent > 0 && p.elapsed > 0 && durationSeconds > 0) {
            const eta = p.elapsed / p.percent - p.elapsed;
            if (eta > durationSeconds * 3) {
              cancelledRef.current = true;
              setError('Download appears stuck, aborting');
              setIsRunning(false);
              clearTimer();
              cancel();
              return;
            }
          }
        },
      );

      const unlistenError = await listen<string>(jobType === 'clip' ? 'clip-error' : 'download-error', (event) => {
        if (cancelledRef.current) return;
        setError(event.payload);
        setIsRunning(false);
        clearTimer();
      });

      try {
        if (jobType === 'clip') {
          await invoke('clip_vod', {
            m3u8Url,
            start: startSeconds,
            duration: durationSeconds,
            outputPath,
            isFmp4,
          });
        } else {
          await invoke('download_vod', {
            m3u8Url,
            duration: durationSeconds,
            outputPath,
            isFmp4,
          });
        }

        if (cancelledRef.current) return;

        setProgress(100);
        setIsRunning(false);
      } catch (err) {
        if (cancelledRef.current) {
          setError(null);
          setIsRunning(false);
          return;
        }
        const msg = err instanceof Error ? err.message : 'Job failed';
        setError(msg);
        setIsRunning(false);
      } finally {
        clearTimer();
        await unlistenProgress();
        await unlistenError();
      }
    },
    [cancel, clearTimer],
  );

  const startClip = useCallback(
    (vodId: string, m3u8Url: string, startSeconds: number, durationSeconds: number) => {
      const startHMS = toHHMMSS(Math.floor(startSeconds)).replace(/:/g, '-');
      const endHMS = toHHMMSS(Math.floor(startSeconds + durationSeconds)).replace(/:/g, '-');
      const defaultName = `${vodId}-clip-${startHMS}-${endHMS}.mp4`;
      return runJob(m3u8Url, startSeconds, durationSeconds, 'clip', defaultName);
    },
    [runJob],
  );

  const startDownload = useCallback(
    (m3u8Url: string, durationSeconds: number) => {
      const defaultName = `vod-${toHHMMSS(Math.floor(durationSeconds)).replace(/:/g, '-')}.mp4`;
      return runJob(m3u8Url, 0, durationSeconds, 'download', defaultName);
    },
    [runJob],
  );

  return { progress, isRunning, error, elapsed, startClip, startDownload, cancel };
}
