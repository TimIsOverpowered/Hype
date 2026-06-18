import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { useCallback, useRef, useState } from 'react';
import { ELAPSED_TIMER_INTERVAL_MS, VIDEO_FILE_EXTENSIONS } from '../constants/ui';
import { clipVod, downloadVod } from '../media/clipper';
import { toHHMMSS } from '../utils/time';

type JobType = 'clip' | 'download';

interface UseClipJobResult {
  progress: number;
  isRunning: boolean;
  error: string | null;
  elapsed: number;
  startClip: (m3u8Url: string, startSeconds: number, durationSeconds: number) => Promise<void>;
  startDownload: (m3u8Url: string, durationSeconds: number) => Promise<void>;
  cancel: () => void;
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

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    clearTimer();
  }, [clearTimer]);

  const saveFile = useCallback(async (blob: Blob, defaultName: string): Promise<void> => {
    const filePath = await save({
      defaultPath: defaultName,
      filters: [{ name: 'Video', extensions: VIDEO_FILE_EXTENSIONS }],
    });

    if (!filePath) {
      return;
    }

    const buffer = await blob.arrayBuffer();
    await writeFile(filePath, new Uint8Array(buffer));
  }, []);

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

      try {
        let blob: Blob;

        if (jobType === 'clip') {
          blob = await clipVod(m3u8Url, startSeconds, durationSeconds, (p) => {
            if (cancelledRef.current) throw new Error('Cancelled');
            setProgress(Math.min(p, 100));
          });
        } else {
          blob = await downloadVod(m3u8Url, durationSeconds, (p) => {
            if (cancelledRef.current) throw new Error('Cancelled');
            setProgress(Math.min(p, 100));
          });
        }

        if (cancelledRef.current) return;

        await saveFile(blob, defaultName);

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
      }
    },
    [clearTimer, saveFile],
  );

  const startClip = useCallback(
    (m3u8Url: string, startSeconds: number, durationSeconds: number) => {
      const startHMS = toHHMMSS(Math.floor(startSeconds));
      const endHMS = toHHMMSS(Math.floor(startSeconds + durationSeconds));
      const defaultName = `clip-${startHMS}-${endHMS}.mp4`;
      return runJob(m3u8Url, startSeconds, durationSeconds, 'clip', defaultName);
    },
    [runJob],
  );

  const startDownload = useCallback(
    (m3u8Url: string, durationSeconds: number) => {
      const defaultName = `vod-${toHHMMSS(Math.floor(durationSeconds))}.mp4`;
      return runJob(m3u8Url, 0, durationSeconds, 'download', defaultName);
    },
    [runJob],
  );

  return { progress, isRunning, error, elapsed, startClip, startDownload, cancel };
}
