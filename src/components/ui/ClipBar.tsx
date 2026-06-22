import { Clock, Download, Minus, Plus, Scissors, Video } from 'lucide-react';
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
    onClip(vodId, '', startSec, endSec - startSec, includeChat);
  }, [clipStart, clipEnd, onClip, vodId, includeChat, startSec, endSec]);

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

      <div className="flex-1" />

      {/* 6. Download Full VOD */}
      <div className="border-l border-border pl-4">
        <button
          type="button"
          onClick={onDownload}
          className="flex items-center gap-1.5 rounded-lg bg-surface-elevated px-3 py-2 text-xs font-medium text-text-secondary transition-all hover:bg-white/10 hover:text-text-primary"
          title="Download the entire VOD"
        >
          <Download size={14} />
          Download VOD
        </button>
      </div>
    </div>
  );
}
