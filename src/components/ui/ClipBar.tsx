import { Clock, Download, Minus, MonitorSmartphone, Plus, Scissors, Video } from 'lucide-react';
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
  readonly showGraph: boolean;
  readonly onToggleGraph: () => void;
  readonly onClip: (
    vodId: string,
    startSeconds: number,
    durationSeconds: number,
    includeChat: boolean,
    isVertical?: boolean,
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
  showGraph,
  onToggleGraph,
  onClip,
  onDownload,
  onSetStart,
  onSetEnd,
}: ClipBarProps) {
  const [includeChat, setIncludeChat] = useState(false);
  const [isVertical, setIsVertical] = useState(false);

  // --- Calculations ---
  const startSec = hmsValid(clipStart) ? toSeconds(clipStart) : 0;
  const endSec = hmsValid(clipEnd) ? toSeconds(clipEnd) : 0;
  const clipDuration = endSec > startSec ? endSec - startSec : 0;

  // --- Core Handlers ---
  const handleClip = useCallback(() => {
    if (!hmsValid(clipStart)) {
      toast.error('Invalid start time', { description: 'Use HH:MM:SS format.' });
      return;
    }
    if (!hmsValid(clipEnd)) {
      toast.error('Invalid end time', { description: 'Use HH:MM:SS format.' });
      return;
    }
    if (startSec >= endSec) {
      toast.error('Invalid range', { description: 'Start time must be before end time.' });
      return;
    }
    onClip(vodId, startSec, endSec - startSec, includeChat, isVertical);
  }, [clipStart, clipEnd, onClip, vodId, includeChat, isVertical, startSec, endSec]);

  const handleSetStart = useCallback(() => {
    onSetStart(toHHMMSS(Math.floor(currentTime)));
  }, [currentTime, onSetStart]);

  const handleSetEnd = useCallback(() => {
    onSetEnd(toHHMMSS(Math.floor(currentTime)));
  }, [currentTime, onSetEnd]);

  // --- Nudge Handlers ---
  const adjustTime = useCallback(
    (field: 'start' | 'end', deltaSeconds: number) => {
      if (field === 'start') {
        if (!hmsValid(clipStart)) return;
        const newStart = Math.max(0, toSeconds(clipStart) + deltaSeconds);
        onSetStart(toHHMMSS(newStart));
      } else {
        if (!hmsValid(clipEnd)) return;
        const newEnd = Math.max(0, toSeconds(clipEnd) + deltaSeconds);
        onSetEnd(toHHMMSS(newEnd));
      }
    },
    [clipStart, clipEnd, onSetStart, onSetEnd],
  );

  return (
    <div className="flex w-full flex-wrap items-center gap-4 rounded-xl border border-border bg-surface p-3 shadow-sm">
      {/* 1. Start Time Controls */}
      <div className="flex items-center gap-1.5">
        <span className="mr-1 text-xs font-medium text-text-hint">Start</span>
        <button
          type="button"
          onClick={() => adjustTime('start', -30)}
          className="flex items-center rounded bg-surface-elevated px-1.5 py-1 text-[10px] font-medium text-text-secondary transition-colors hover:bg-white/10 hover:text-text-primary"
          title="Subtract 30 seconds"
        >
          <Minus size={10} className="mr-0.5" /> 30s
        </button>

        <div className="flex items-center gap-1 rounded-md border border-border bg-background p-1 focus-within:border-primary transition-colors">
          <input
            type="text"
            value={clipStart}
            onChange={(e) => onSetStart(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            className="w-[72px] bg-transparent px-1.5 text-center text-xs font-mono text-text-primary outline-none"
            placeholder="00:00:00"
          />
          <button
            type="button"
            onClick={handleSetStart}
            className="rounded p-1 text-text-hint transition-colors hover:bg-white/10 hover:text-text-primary"
            title="Set to current player time"
          >
            <Clock size={14} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => adjustTime('start', 30)}
          className="flex items-center rounded bg-surface-elevated px-1.5 py-1 text-[10px] font-medium text-text-secondary transition-colors hover:bg-white/10 hover:text-text-primary"
          title="Add 30 seconds"
        >
          <Plus size={10} className="mr-0.5" /> 30s
        </button>
      </div>

      {/* 2. End Time Controls */}
      <div className="flex items-center gap-1.5">
        <span className="mr-1 ml-2 text-xs font-medium text-text-hint">End</span>
        <button
          type="button"
          onClick={() => adjustTime('end', -30)}
          className="flex items-center rounded bg-surface-elevated px-1.5 py-1 text-[10px] font-medium text-text-secondary transition-colors hover:bg-white/10 hover:text-text-primary"
          title="Subtract 30 seconds"
        >
          <Minus size={10} className="mr-0.5" /> 30s
        </button>

        <div className="flex items-center gap-1 rounded-md border border-border bg-background p-1 focus-within:border-primary transition-colors">
          <input
            type="text"
            value={clipEnd}
            onChange={(e) => onSetEnd(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            className="w-[72px] bg-transparent px-1.5 text-center text-xs font-mono text-text-primary outline-none"
            placeholder="00:00:00"
          />
          <button
            type="button"
            onClick={handleSetEnd}
            className="rounded p-1 text-text-hint transition-colors hover:bg-white/10 hover:text-text-primary"
            title="Set to current player time"
          >
            <Clock size={14} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => adjustTime('end', 30)}
          className="flex items-center rounded bg-surface-elevated px-1.5 py-1 text-[10px] font-medium text-text-secondary transition-colors hover:bg-white/10 hover:text-text-primary"
          title="Add 30 seconds"
        >
          <Plus size={10} className="mr-0.5" /> 30s
        </button>
      </div>

      <div className="hidden h-6 w-px bg-border xl:block" />

      {/* 3. Live Duration Pill */}
      <div
        className={`flex items-center justify-center rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide transition-colors ${
          clipDuration > 0 ? 'bg-primary/20 text-primary' : 'bg-white/5 text-text-hint'
        }`}
        title="Resulting Clip Duration"
      >
        {clipDuration > 0 ? `${toHHMMSS(clipDuration)}` : '--:--:--'}
      </div>

      {/* 4. Clip Button */}
      <button
        type="button"
        onClick={handleClip}
        disabled={clipDuration <= 0}
        className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-md shadow-primary/20 transition-all hover:bg-primary-hover active:scale-95 disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none"
      >
        <Scissors size={16} />
        Clip
      </button>

      {/* 5. Chat Renderer Toggle */}
      <label className="group relative inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary">
        <input
          type="checkbox"
          checked={includeChat}
          onChange={(e) => setIncludeChat(e.target.checked)}
          className="peer sr-only"
        />
        <div className="h-4 w-7 rounded-full bg-border transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-3 after:w-3 after:rounded-full after:bg-text-secondary after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-3 peer-checked:after:bg-text-primary" />
        <span className="flex items-center gap-1.5">
          <Video size={14} className={includeChat ? 'text-primary' : ''} />
          Chat Renderer
        </span>
      </label>

      {/* 7. Vertical Clip Toggle */}
      <label className="group relative inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary">
        <input
          type="checkbox"
          checked={isVertical}
          onChange={(e) => setIsVertical(e.target.checked)}
          className="peer sr-only"
        />
        <div className="h-4 w-7 rounded-full bg-border transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-3 after:w-3 after:rounded-full after:bg-text-secondary after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-3 peer-checked:after:bg-text-primary" />
        <span className="flex items-center gap-1.5">
          <MonitorSmartphone size={14} className={isVertical ? 'text-primary' : ''} />
          Vertical (9:16)
        </span>
      </label>

      {/* 8. Download Full VOD */}
      <button
        type="button"
        onClick={onDownload}
        className="flex items-center gap-1.5 rounded-lg bg-surface-elevated px-3 py-2 text-xs font-medium text-text-secondary transition-all hover:bg-white/10 hover:text-text-primary"
        title="Download the entire VOD"
      >
        <Download size={14} />
        Download VOD
      </button>

      <div className="flex-1" />

      {/* 7. Toggle Graph + Settings */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onToggleGraph}
          className={`flex items-center justify-center rounded-lg p-2 text-xs font-medium transition-all ${
            showGraph
              ? 'bg-primary/20 text-primary hover:bg-primary/30'
              : 'bg-surface-elevated text-text-secondary hover:bg-white/10 hover:text-text-primary'
          }`}
          title={showGraph ? 'Hide Graph' : 'Show Graph'}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <title>Toggle Graph</title>
            <line x1="4" y1="20" x2="4" y2="4" />
            <line x1="9" y1="20" x2="9" y2="9" />
            <line x1="14" y1="20" x2="14" y2="14" />
            <line x1="19" y1="20" x2="19" y2="11" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('open-global-settings', { detail: 'chat-render' }))}
          className="flex items-center justify-center rounded-lg p-2 text-xs font-medium text-text-secondary transition-all hover:bg-white/10 hover:text-text-primary"
          title="Chat Renderer Settings"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <title>Chat Renderer Settings</title>
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1.74-1v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>
    </div>
  );
}
