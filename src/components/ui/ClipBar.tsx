import { useState } from 'react';
import { hmsValid, toHHMMSS, toSeconds } from '../../utils/time';

interface ClipBarProps {
  readonly vodId: string;
  readonly m3u8Url: string;
  readonly duration: number;
  readonly currentTime: number;
  readonly onClip: (vodId: string, m3u8Url: string, startSeconds: number, durationSeconds: number) => void;
  readonly onDownload: () => void;
  readonly isProcessing: boolean;
}

export default function ClipBar({ currentTime, vodId, onClip, onDownload, isProcessing }: ClipBarProps) {
  const [startStr, setStartStr] = useState('00:00:00');
  const [endStr, setEndStr] = useState('00:00:00');

  const handleClip = () => {
    if (!hmsValid(startStr) || !hmsValid(endStr)) return;
    const startSec = toSeconds(startStr);
    const endSec = toSeconds(endStr);
    if (startSec >= endSec) return;
    onClip(vodId, '', startSec, endSec - startSec);
  };

  return (
    <div className="flex w-full flex-col gap-2 rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Start */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-text-hint">Start</span>
          <input
            type="text"
            value={startStr}
            onChange={(e) => setStartStr(e.target.value)}
            className="w-20 rounded-md border border-border bg-background px-2 py-1 text-xs text-text-primary outline-none transition-colors focus:border-primary"
          />
          <button
            type="button"
            onClick={() => setStartStr(toHHMMSS(Math.floor(currentTime)))}
            className="rounded-md bg-surface-elevated p-1.5 text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
            title="Set from current player time"
            disabled={isProcessing}
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
            value={endStr}
            onChange={(e) => setEndStr(e.target.value)}
            className="w-20 rounded-md border border-border bg-background px-2 py-1 text-xs text-text-primary outline-none transition-colors focus:border-primary"
          />
          <button
            type="button"
            onClick={() => setEndStr(toHHMMSS(Math.floor(currentTime)))}
            className="rounded-md bg-surface-elevated p-1.5 text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
            title="Set from current player time"
            disabled={isProcessing}
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
          disabled={
            isProcessing || !hmsValid(startStr) || !hmsValid(endStr) || toSeconds(startStr) >= toSeconds(endStr)
          }
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

        {/* Download VOD button */}
        <button
          type="button"
          onClick={onDownload}
          disabled={isProcessing}
          className="flex items-center gap-1.5 rounded-md bg-surface-elevated px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
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
