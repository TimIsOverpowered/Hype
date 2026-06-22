import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { hmsValid, toHHMMSS, toSeconds } from '../../utils/time';

interface ClipBarProps {
  readonly vodId: string;
  readonly m3u8Url: string;
  readonly duration: number;
  readonly currentTime: number;
  readonly clipStart: string;
  readonly clipEnd: string;
  readonly onClip: (
    vodId: string,
    m3u8Url: string,
    startSeconds: number,
    durationSeconds: number,
    includeChat: boolean,
  ) => void;
  readonly onDownload: () => void;
  readonly onSetStart: (hms: string) => void;
  readonly onSetEnd: (hms: string) => void;
}

export default function ClipBar({
  currentTime,
  vodId,
  clipStart,
  clipEnd,
  onClip,
  onDownload,
  onSetStart,
  onSetEnd,
}: ClipBarProps) {
  const [includeChat, setIncludeChat] = useState(false);

  const handleClip = useCallback(() => {
    if (!hmsValid(clipStart)) {
      toast.error('Invalid start time', { description: 'Use HH:MM:SS format.' });
      return;
    }
    if (!hmsValid(clipEnd)) {
      toast.error('Invalid end time', { description: 'Use HH:MM:SS format.' });
      return;
    }
    const startSec = toSeconds(clipStart);
    const endSec = toSeconds(clipEnd);
    if (startSec >= endSec) {
      toast.error('Invalid range', { description: 'Start time must be before end time.' });
      return;
    }
    onClip(vodId, '', startSec, endSec - startSec, includeChat);
  }, [clipStart, clipEnd, onClip, vodId, includeChat]);

  const handleSetStart = useCallback(() => {
    onSetStart(toHHMMSS(Math.floor(currentTime)));
  }, [currentTime, onSetStart]);

  const handleSetEnd = useCallback(() => {
    onSetEnd(toHHMMSS(Math.floor(currentTime)));
  }, [currentTime, onSetEnd]);

  return (
    <div className="flex w-full flex-col gap-2 rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Start */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-text-hint">Start</span>
          <input
            type="text"
            value={clipStart}
            onChange={(e) => onSetStart(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            className="w-20 rounded-md border border-border bg-background px-2 py-1 text-xs text-text-primary outline-none transition-colors focus:border-primary"
          />
          <button
            type="button"
            onClick={handleSetStart}
            className="rounded-md bg-surface-elevated p-1.5 text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
            title="Set from current player time"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <title>Set from current</title>
              <path d="M3 3v18h18" />
              <path d="M18.7 8l-6.6 6-3.3-3" />
            </svg>
          </button>
        </div>

        {/* End */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-text-hint">End</span>
          <input
            type="text"
            value={clipEnd}
            onChange={(e) => onSetEnd(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            className="w-20 rounded-md border border-border bg-background px-2 py-1 text-xs text-text-primary outline-none transition-colors focus:border-primary"
          />
          <button
            type="button"
            onClick={handleSetEnd}
            className="rounded-md bg-surface-elevated p-1.5 text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
            title="Set from current player time"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <title>Set from current</title>
              <path d="M3 3v18h18" />
              <path d="M18.7 8l-6.6 6-3.3-3" />
            </svg>
          </button>
        </div>

        <div className="h-6 w-px bg-border" />

        {/* Clip button */}
        <button
          type="button"
          onClick={handleClip}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <title>Clip selection</title>
            <path d="M7 2v20" />
            <path d="M17 2v20" />
            <path d="M2 12h20" />
            <path d="M2 7l5 5-5 5" />
            <path d="M22 7l-5 5 5 5" />
          </svg>
          Clip
        </button>

        {/* Chat Toggle */}
        <div className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
          <input
            type="checkbox"
            checked={includeChat}
            onChange={(e) => setIncludeChat(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Chat Render
        </div>

        <div className="flex-1" />

        {/* Download VOD button */}
        <button
          type="button"
          onClick={onDownload}
          className="flex items-center gap-1.5 rounded-md bg-surface-elevated px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary ml-auto"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <title>Download VOD</title>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download VOD
        </button>
      </div>
    </div>
  );
}
