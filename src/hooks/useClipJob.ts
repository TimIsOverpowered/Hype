import { save } from '@tauri-apps/plugin-dialog';
import { parse as hlsParse } from 'hls-parser';
import { useCallback, useRef, useState } from 'react';
import { useJobQueue } from '../contexts/JobQueueContext';
import { toHHMMSS } from '../utils/time';

type JobType = 'clip' | 'download';

interface UseClipJobResult {
  jobType: JobType;
  startClip: (
    vodId: string,
    m3u8Url: string,
    startSeconds: number,
    durationSeconds: number,
    streamerName: string,
  ) => Promise<void>;
  startDownload: (vodId: string, m3u8Url: string, durationSeconds: number, streamerName: string) => Promise<void>;
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
  const { submitJob } = useJobQueue();
  const [jobType, setJobType] = useState<JobType>('clip');
  const cancelledRef = useRef(false);

  const runJob = useCallback(
    async (m3u8Url: string, startSeconds: number, durationSeconds: number, type: JobType, defaultName: string) => {
      cancelledRef.current = false;
      setJobType(type);

      const isFmp4 = await detectFmp4(m3u8Url);

      const outputPath = await save({
        defaultPath: defaultName,
        filters: [{ name: 'Video', extensions: ['mp4'] }],
      });

      if (!outputPath) {
        return;
      }

      await submitJob(type, m3u8Url, durationSeconds, outputPath, isFmp4, startSeconds);
    },
    [submitJob],
  );

  const startClip = useCallback(
    (vodId: string, m3u8Url: string, startSeconds: number, durationSeconds: number, streamerName: string) => {
      const startHMS = toHHMMSS(Math.floor(startSeconds)).replace(/:/g, '-');
      const endHMS = toHHMMSS(Math.floor(startSeconds + durationSeconds)).replace(/:/g, '-');
      const defaultName = `${streamerName}-${vodId}-clip-${startHMS}-${endHMS}.mp4`;
      return runJob(m3u8Url, startSeconds, durationSeconds, 'clip', defaultName);
    },
    [runJob],
  );

  const startDownload = useCallback(
    (vodId: string, m3u8Url: string, durationSeconds: number, streamerName: string) => {
      const defaultName = `${streamerName}-${vodId}.mp4`;
      return runJob(m3u8Url, 0, durationSeconds, 'download', defaultName);
    },
    [runJob],
  );

  return { jobType, startClip, startDownload };
}
