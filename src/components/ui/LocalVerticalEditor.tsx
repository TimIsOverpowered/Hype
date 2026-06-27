import { convertFileSrc } from '@tauri-apps/api/core';
import { Maximize, Minimize2, Pause, Play, Square, Volume2, VolumeX, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Rnd } from 'react-rnd';
import { usePlayerSettings } from '../../hooks/usePlayerSettings';
import { formatTime } from '../../utils/time';
import { ConfirmDialog, useConfirm } from '../settings/ConfirmDialog';

interface CropBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface LocalVerticalEditorProps {
  readonly localMp4Path: string;
  readonly onClose: () => void;
  readonly onConfirm: (
    mode: 'stacked' | 'full',
    camBox: CropBox,
    gameBox: CropBox,
    singleBox: CropBox,
    fitMode: boolean,
  ) => void;
}

// Master inner canvas dimensions (16:9 ratio)
const C_WIDTH = 720;
const C_HEIGHT = 405;

export default function LocalVerticalEditor({ localMp4Path, onClose, onConfirm }: LocalVerticalEditorProps) {
  const videoSrc = localMp4Path ? convertFileSrc(localMp4Path) : undefined;
  const { showConfirm, config: confirmConfig, handleConfirm, handleCancel: cancelConfirm } = useConfirm();

  // Pull default volume settings from LocalStorage
  const playerSettings = usePlayerSettings();

  const masterRef = useRef<HTMLVideoElement>(null);
  const slaveTopRef = useRef<HTMLVideoElement>(null);
  const slaveBottomRef = useRef<HTMLVideoElement>(null);
  const portraitContainerRef = useRef<HTMLDivElement>(null);

  // Layout & UI States
  const [isEditing, setIsEditing] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'stacked' | 'full'>('stacked');
  const [isFitMode, setIsFitMode] = useState(false);
  const [splitRatio, setSplitRatio] = useState(40);

  // Player States
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(playerSettings.volume);
  const [isMuted, setIsMuted] = useState(false);

  const volumeRef = useRef(playerSettings.volume);
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  // Dynamic Aspect Ratios
  const camAspect = 180 / (320 * (splitRatio / 100));
  const gameAspect = 180 / (320 * ((100 - splitRatio) / 100));

  // Initialize boxes to be comfortably centered and strictly within bounds
  const [camBox, setCamBox] = useState<CropBox>({ x: 50, y: 20, w: 160, h: 160 / camAspect });
  const [gameBox, setGameBox] = useState<CropBox>({ x: 250, y: 60, w: 260, h: 260 / gameAspect });
  const [singleBox, setSingleBox] = useState<CropBox>({ x: 246, y: 0, w: 227.8, h: 405 });

  // Snapshot State (for reverting edits if Cancel is clicked)
  const [snapshot, setSnapshot] = useState({ cam: camBox, game: gameBox, single: singleBox, split: splitRatio });

  // Pause any other background players on the site
  useEffect(() => {
    document.querySelectorAll('video').forEach((v) => {
      if (v !== masterRef.current && v !== slaveTopRef.current && v !== slaveBottomRef.current) {
        v.pause();
      }
    });
  }, []);

  // --- CUSTOM PLAYER LOGIC ---
  useEffect(() => {
    const video = masterRef.current;
    if (!video) return;

    // Apply LocalStorage Volume and Auto-Play immediately on mount
    video.volume = volumeRef.current / 100;
    video.play().catch(console.error);
    setIsPlaying(true);

    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onDurationChange = () => setDuration(video.duration);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, []); // Run ONCE on mount

  const togglePlayPause = useCallback(() => {
    const video = masterRef.current;
    if (!video) return;
    video.paused ? video.play() : video.pause();
  }, []);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (masterRef.current) masterRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = Number(e.target.value);
    setVolume(vol);
    setIsMuted(vol === 0);
    if (masterRef.current) masterRef.current.volume = vol;
  };

  const toggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    if (masterRef.current) masterRef.current.volume = nextMute ? 0 : volume;
  };

  const syncPlay = useCallback(() => {
    slaveTopRef.current?.play();
    slaveBottomRef.current?.play();
  }, []);

  const syncPause = useCallback(() => {
    slaveTopRef.current?.pause();
    slaveBottomRef.current?.pause();
  }, []);

  const syncSeek = useCallback(() => {
    const time = masterRef.current?.currentTime ?? 0;
    if (slaveTopRef.current) slaveTopRef.current.currentTime = time;
    if (slaveBottomRef.current) slaveBottomRef.current.currentTime = time;
  }, []);

  // --- EDIT WORKFLOW ---
  const handleStartEdit = () => {
    setSnapshot({ cam: camBox, game: gameBox, single: singleBox, split: splitRatio });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setCamBox(snapshot.cam);
    setGameBox(snapshot.game);
    setSingleBox(snapshot.single);
    setSplitRatio(snapshot.split);

    // Sync the native DOM back instantly on discard
    updatePreviewDom('cam', snapshot.cam);
    updatePreviewDom('game', snapshot.game);
    updatePreviewDom('single', snapshot.single);

    setIsEditing(false);
  };

  const handleApplyEdit = () => {
    setIsEditing(false);
  };

  // --- STRICT BOUNDARY CLAMPING MATH ---
  const clampBox = useCallback((x: number, y: number, w: number, aspect: number): CropBox => {
    const MAX_W = C_WIDTH;
    const MAX_H = C_HEIGHT;

    let newW = Math.max(40, w);
    let newH = newW / aspect;

    if (newH > MAX_H) {
      newH = MAX_H;
      newW = newH * aspect;
    }
    if (newW > MAX_W) {
      newW = MAX_W;
      newH = newW / aspect;
    }

    let newX = x;
    let newY = y;

    // Push the box safely inwards if it overflows layout bounds
    if (newX + newW > MAX_W) newX = MAX_W - newW;
    if (newY + newH > MAX_H) newY = MAX_H - newH;
    if (newX < 0) newX = 0;
    if (newY < 0) newY = 0;

    return { x: newX, y: newY, w: newW, h: newH };
  }, []);

  // --- DIRECT DOM MANIPULATION FOR 144HZ REAL-TIME DRAGGING ---
  const updatePreviewDom = (type: 'cam' | 'game' | 'single', box: CropBox) => {
    const videoEl = type === 'game' ? slaveBottomRef.current : slaveTopRef.current;
    if (videoEl) {
      videoEl.style.width = `${(C_WIDTH / box.w) * 100}%`;
      videoEl.style.height = `${(C_HEIGHT / box.h) * 100}%`;
      videoEl.style.left = `${-(box.x / box.w) * 100}%`;
      videoEl.style.top = `${-(box.y / box.h) * 100}%`;
    }
  };

  // --- SLIDER DRAG LOGIC ---
  const handlePillMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!portraitContainerRef.current) return;

    const rect = portraitContainerRef.current.getBoundingClientRect();

    const onMouseMove = (moveEvent: MouseEvent) => {
      let newRatio = ((moveEvent.clientY - rect.top) / rect.height) * 100;
      newRatio = Math.max(5, Math.min(newRatio, 95));
      setSplitRatio(newRatio);

      const newCamAspect = 180 / (320 * (newRatio / 100));
      const newGameAspect = 180 / (320 * ((100 - newRatio) / 100));

      setCamBox((prev) => {
        const clamped = clampBox(prev.x, prev.y, prev.w, newCamAspect);
        updatePreviewDom('cam', clamped);
        return clamped;
      });

      setGameBox((prev) => {
        const clamped = clampBox(prev.x, prev.y, prev.w, newGameAspect);
        updatePreviewDom('game', clamped);
        return clamped;
      });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleStyle = {
    width: '8px',
    height: '8px',
    backgroundColor: '#ffffff',
    border: '1px solid rgba(0,0,0,0.3)',
  };

  const DraggableBox = ({
    type,
    box,
    setBox,
    color,
    aspect,
  }: {
    type: 'cam' | 'game' | 'single';
    box: CropBox;
    setBox: React.Dispatch<React.SetStateAction<CropBox>>;
    color: string;
    aspect: number;
  }) => {
    return (
      <Rnd
        bounds="parent"
        lockAspectRatio={aspect}
        minWidth={40}
        size={{ width: box.w, height: box.h }}
        position={{ x: box.x, y: box.y }}
        // Bypasses React core loop during live interaction to avoid mouse binding drops
        onDrag={(_e, d) => updatePreviewDom(type, { x: d.x, y: d.y, w: box.w, h: box.h })}
        onResize={(_e, _dir, ref, _d, pos) =>
          updatePreviewDom(type, {
            x: pos.x,
            y: pos.y,
            w: parseFloat(ref.style.width),
            h: parseFloat(ref.style.height),
          })
        }
        // Commits layout state changes smoothly at transaction completion
        onDragStop={(_e, d) => setBox(clampBox(d.x, d.y, box.w, aspect))}
        onResizeStop={(_e, _dir, ref, _d, pos) => setBox(clampBox(pos.x, pos.y, parseFloat(ref.style.width), aspect))}
        className={`absolute border-2 ${color} cursor-move`}
        resizeHandleClasses={{}}
        resizeHandleStyles={{
          bottomRight: { ...handleStyle, bottom: '-4px', right: '-4px' },
          bottomLeft: { ...handleStyle, bottom: '-4px', left: '-4px' },
          topRight: { ...handleStyle, top: '-4px', right: '-4px' },
          topLeft: { ...handleStyle, top: '-4px', left: '-4px' },
        }}
      />
    );
  };

  const getSlaveStyle = (box: CropBox) => ({
    width: `${(C_WIDTH / box.w) * 100}%`,
    height: `${(C_HEIGHT / box.h) * 100}%`,
    left: `${-(box.x / box.w) * 100}%`,
    top: `${-(box.y / box.h) * 100}%`,
    position: 'absolute' as const,
  });

  const handleSave = useCallback(() => {
    const toPct = (b: CropBox) => ({
      x: (b.x / C_WIDTH) * 100,
      y: (b.y / C_HEIGHT) * 100,
      w: (b.w / C_WIDTH) * 100,
      h: (b.h / C_HEIGHT) * 100,
    });
    onConfirm(layoutMode, toPct(camBox), toPct(gameBox), toPct(singleBox), isFitMode);
  }, [layoutMode, camBox, gameBox, singleBox, isFitMode, onConfirm]);

  const handleMainCancel = useCallback(async () => {
    const confirmed = await showConfirm({
      title: 'Discard Clip?',
      message: 'Are you sure you want to exit? Any changes to your clip will be lost.',
      confirmLabel: 'Discard Clip',
      cancelLabel: 'Keep Editing',
    });
    if (!confirmed) return;

    onClose();
  }, [showConfirm, onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="flex flex-col w-[992px] max-w-[95vw] bg-surface rounded-xl shadow-2xl border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-surface-elevated">
          <h1 className="text-sm font-semibold text-text-primary">Create Vertical Clip</h1>
          <button
            type="button"
            onClick={handleMainCancel}
            className="rounded p-1 text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex p-5 gap-6 bg-background justify-center items-start border-b border-border">
          {/* LEFT: MASTER VIDEO (16:9) */}
          <div className="flex flex-col shrink-0">
            <h2 className="mb-2 text-sm font-bold text-text-primary">Landscape Version</h2>

            {/* Box-content ensures the inner canvas is EXACTLY 720x405 */}
            <div
              className="relative bg-black rounded-lg overflow-hidden border border-border shadow-inner"
              style={{ width: 720, height: 405, boxSizing: 'content-box' }}
            >
              <video
                ref={masterRef}
                src={videoSrc || undefined}
                className="h-full w-full object-contain pointer-events-none"
                loop
                onPlay={syncPlay}
                onPause={syncPause}
                onSeeked={syncSeek}
                onTimeUpdate={syncSeek}
              >
                <track kind="captions" />
              </video>

              {isEditing && (
                <div className="absolute inset-0 cursor-default" onClick={(e) => e.stopPropagation()}>
                  {layoutMode === 'stacked' && (
                    <>
                      <DraggableBox
                        type="cam"
                        box={camBox}
                        setBox={setCamBox}
                        color="border-pink-500"
                        aspect={camAspect}
                      />
                      <DraggableBox
                        type="game"
                        box={gameBox}
                        setBox={setGameBox}
                        color="border-cyan-400"
                        aspect={gameAspect}
                      />
                    </>
                  )}
                  {layoutMode === 'full' && !isFitMode && (
                    <DraggableBox
                      type="single"
                      box={singleBox}
                      setBox={setSingleBox}
                      color="border-cyan-400"
                      aspect={9 / 16}
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: SLAVE PREVIEW (9:16) */}
          <div className="flex flex-col shrink-0">
            <h2 className="mb-2 text-sm font-bold text-text-primary flex justify-between items-center">
              Portrait Version
            </h2>

            {/* Box-content ensures the inner canvas is EXACTLY 202.5x360 */}
            <div
              ref={portraitContainerRef}
              className="relative bg-black rounded-lg overflow-hidden border border-border shadow-inner pointer-events-none"
              style={{ width: 202.5, height: 360, boxSizing: 'content-box' }}
            >
              {layoutMode === 'full' && isFitMode && (
                <video
                  ref={slaveTopRef}
                  src={videoSrc || undefined}
                  muted
                  className="absolute inset-0 w-full h-full object-contain"
                />
              )}

              {layoutMode === 'full' && !isFitMode && (
                <video
                  ref={slaveTopRef}
                  src={videoSrc || undefined}
                  muted
                  className="max-w-none object-fill"
                  style={getSlaveStyle(singleBox)}
                />
              )}

              {layoutMode === 'stacked' && (
                <div className="flex flex-col h-full w-full relative">
                  <div
                    className={`relative w-full overflow-hidden ${isEditing ? 'border-b-[2px] border-pink-500' : ''}`}
                    style={{ height: `${splitRatio}%` }}
                  >
                    <video
                      ref={slaveTopRef}
                      src={videoSrc || undefined}
                      muted
                      className="max-w-none object-fill"
                      style={getSlaveStyle(camBox)}
                    />
                  </div>

                  {isEditing && (
                    <div
                      className="absolute left-1/2 -translate-x-1/2 z-20 w-12 h-5 bg-background rounded-full flex items-center justify-center gap-1 shadow-lg border border-border cursor-ns-resize hover:bg-surface-elevated transition-colors pointer-events-auto"
                      style={{ top: `calc(${splitRatio}% - 10px)` }}
                      onMouseDown={handlePillMouseDown}
                    >
                      <div className="w-1 h-1 bg-text-hint rounded-full" />
                      <div className="w-1 h-1 bg-text-hint rounded-full" />
                      <div className="w-1 h-1 bg-text-hint rounded-full" />
                    </div>
                  )}

                  <div
                    className={`relative w-full overflow-hidden ${isEditing ? 'border-t-[2px] border-cyan-400' : ''}`}
                    style={{ height: `${100 - splitRatio}%` }}
                  >
                    <video
                      ref={slaveBottomRef}
                      src={videoSrc || undefined}
                      muted
                      className="max-w-none object-fill"
                      style={getSlaveStyle(gameBox)}
                    />
                  </div>
                </div>
              )}

              {layoutMode === 'full' && (
                <button
                  type="button"
                  onClick={() => setIsFitMode(!isFitMode)}
                  className={`absolute top-2 right-2 rounded p-1.5 shadow border z-20 pointer-events-auto transition-colors ${
                    isFitMode
                      ? 'bg-primary border-primary text-white'
                      : 'bg-surface border-border text-text-primary hover:bg-surface-elevated'
                  }`}
                  title={isFitMode ? 'Revert to crop' : 'Fit to screen'}
                >
                  {isFitMode ? <Minimize2 size={14} /> : <Maximize size={14} />}
                </button>
              )}
            </div>

            {/* Exactly 45px total height to align flush with the Landscape container */}
            <div className="flex flex-col justify-end w-full" style={{ height: 45 }}>
              {!isEditing ? (
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="w-full h-8 rounded-full text-xs font-semibold bg-surface-elevated border border-border text-text-primary hover:bg-white/10 transition-colors"
                >
                  Edit
                </button>
              ) : (
                <div className="flex gap-2 justify-center transition-opacity duration-200">
                  <button
                    type="button"
                    onClick={() => {
                      setLayoutMode('full');
                      setIsFitMode(false);
                    }}
                    className={`flex items-center justify-center h-8 w-12 rounded-md border-2 transition-colors ${
                      layoutMode === 'full'
                        ? 'border-primary text-primary bg-primary/10'
                        : 'border-border text-text-secondary hover:text-text-primary'
                    }`}
                    title="Full Layout"
                  >
                    <Square size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setLayoutMode('stacked')}
                    className={`flex items-center justify-center h-8 w-12 rounded-md border-2 transition-colors ${
                      layoutMode === 'stacked'
                        ? 'border-primary text-primary bg-primary/10'
                        : 'border-border text-text-secondary hover:text-text-primary'
                    }`}
                    title="Stacked Layout"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      focusable="false"
                      aria-hidden="true"
                      role="presentation"
                    >
                      <path
                        fill="currentColor"
                        fillRule="evenodd"
                        d="M6 4h8v5H6V4Zm0 7v5h8v-5H6Zm8-9H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Custom Player Control Footer */}
        <div className="flex flex-col px-5 py-4 bg-surface-elevated">
          <div className="flex items-center gap-3 mb-3">
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              step="any"
              onChange={handleSeek}
              className="w-full h-1.5 appearance-none rounded-lg accent-primary cursor-pointer transition-all"
              style={{
                background: `linear-gradient(to right, var(--color-primary) ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.1) ${(currentTime / (duration || 1)) * 100}%)`,
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 transition-opacity opacity-100">
              <button
                type="button"
                onClick={togglePlayPause}
                className="text-text-primary hover:text-primary transition-colors"
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </button>

              <div className="flex items-center gap-2 group">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="text-text-primary hover:text-primary transition-colors"
                >
                  {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-16 h-1.5 appearance-none rounded-lg accent-primary cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, var(--color-primary) ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.1) ${(isMuted ? 0 : volume) * 100}%)`,
                  }}
                />
              </div>

              <span className="text-xs font-medium text-text-primary tabular-nums">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-5 py-2 rounded-lg text-sm font-semibold text-text-primary bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyEdit}
                    className="px-5 py-2 rounded-lg bg-primary text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
                  >
                    Apply
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleMainCancel}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    className="px-6 py-2 rounded-lg bg-primary text-sm font-semibold text-white shadow-md shadow-primary/20 transition-all hover:bg-primary-hover active:scale-95"
                  >
                    Save Clip
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {confirmConfig && <ConfirmDialog config={confirmConfig} onConfirm={handleConfirm} onCancel={cancelConfirm} />}
    </div>
  );
}
