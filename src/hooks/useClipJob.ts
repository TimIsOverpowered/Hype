import { save } from '@tauri-apps/plugin-dialog';
import { parse as hlsParse } from 'hls-parser';
import { useCallback, useRef, useState } from 'react';
import { useJobQueue } from '../contexts/JobQueueContext';
import { toHHMMSS } from '../utils/time';

interface ChatOptions {
  includeChat: boolean;
  broadcasterId: string;
  vodId: string;
}

interface UseClipJobResult {
  jobType: 'clip' | 'download' | 'chat-render';
  startClip: (
    vodId: string,
    m3u8Url: string,
    startSeconds: number,
    durationSeconds: number,
    streamerName: string,
    chatOptions?: ChatOptions,
  ) => Promise<void>;
  startDownload: (
    vodId: string,
    m3u8Url: string,
    durationSeconds: number,
    streamerName: string,
    chatOptions?: ChatOptions,
  ) => Promise<void>;
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
  const { submitJob, renderChatOverlay } = useJobQueue();
  const [jobType, setJobType] = useState<'clip' | 'download' | 'chat-render'>('clip');
  const cancelledRef = useRef(false);

  const runJob = useCallback(
    async (
      m3u8Url: string,
      startSeconds: number,
      durationSeconds: number,
      type: 'clip' | 'download',
      defaultName: string,
      chatOptions?: ChatOptions,
    ) => {
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

      if (chatOptions?.includeChat) {
        const chatPath = `${outputPath.replace(/\.[^/.]+$/, '')}_chat.webm`;
        await renderChatOverlay(
          chatOptions.vodId,
          chatOptions.broadcasterId,
          startSeconds,
          durationSeconds,
          chatPath,
          60,
        );
      }
    },
    [submitJob, renderChatOverlay],
  );

  const startClip = useCallback(
    (
      vodId: string,
      m3u8Url: string,
      startSeconds: number,
      durationSeconds: number,
      streamerName: string,
      chatOptions?: ChatOptions,
    ) => {
      const startHMS = toHHMMSS(Math.floor(startSeconds)).replace(/:/g, '-');
      const endHMS = toHHMMSS(Math.floor(startSeconds + durationSeconds)).replace(/:/g, '-');
      const defaultName = `${streamerName}-${vodId}-clip-${startHMS}-${endHMS}.mp4`;
      return runJob(m3u8Url, startSeconds, durationSeconds, 'clip', defaultName, chatOptions);
    },
    [runJob],
  );

  const startDownload = useCallback(
    (vodId: string, m3u8Url: string, durationSeconds: number, streamerName: string, chatOptions?: ChatOptions) => {
      const defaultName = `${streamerName}-${vodId}.mp4`;
      return runJob(m3u8Url, 0, durationSeconds, 'download', defaultName, chatOptions);
    },
    [runJob],
  );

  return { jobType, startClip, startDownload };
}
