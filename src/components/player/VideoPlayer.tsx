import Hls from 'hls.js';
import {
  Check,
  ChevronLeft,
  Library,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  Play,
  Settings,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { TheatreModeIcon } from '../../assets/icons';
import { TIME_UPDATE_THROTTLE_MS } from '../../constants/ui';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useAutoHideControls, useTooltipControls } from '../../hooks/usePlayerControls';
import { usePlayerSettings } from '../../hooks/usePlayerSettings';
import { TauriHlsLoader } from '../../media/TauriHlsLoader';
import type { M3u8Variant } from '../../types/twitch';
import { formatTime, getCurrentChapter, humanizeDuration } from '../../utils/time';

interface ChapterInfo {
  readonly positionMilliseconds: number;
  readonly durationMilliseconds: number;
  readonly game?: string;
  readonly boxArtURL?: string;
}

interface VideoPlayerProps {
  readonly vodId: string;
  readonly m3u8Url: string;
  readonly chapters?: readonly ChapterInfo[];
  readonly onTimeUpdate?: (time: number) => void;
  readonly startTime?: number;
  readonly autoPlay?: boolean;
  readonly muted?: boolean;
  readonly aspectRatio?: string;
  readonly onDuration?: (duration: number) => void;
  readonly onError?: (error: string | null) => void;
  readonly onSeekable?: (time: number) => void;
  readonly onPlay?: () => void;
  readonly onPause?: () => void;
  readonly onEnded?: () => void;
  readonly onWaiting?: () => void;
  readonly onPlaying?: () => void;
  readonly streamType?: 'on-demand' | 'live' | 'live:dvr' | 'll-live' | 'll-live:dvr';
  readonly variants?: readonly M3u8Variant[];
  readonly onQualityChange?: (variant: M3u8Variant) => void;
  readonly theatreMode?: boolean;
  readonly onToggleTheatreMode?: () => void;
}

export interface VideoPlayerHandle {
  readonly seek: (time: number) => void;
  readonly play: () => void;
  readonly pause: () => void;
  readonly currentTime: number;
}

const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3];
const CIRCLE_START_ANGLE = 135;
const CIRCLE_END_ANGLE = 405;
const CIRCLE_RANGE = CIRCLE_END_ANGLE - CIRCLE_START_ANGLE;

function getSpeedIndex(speed: number): number {
  const idx = PLAYBACK_RATES.indexOf(speed);
  return idx >= 0 ? idx : 4;
}

function getAngleForSpeed(speed: number): number {
  const idx = getSpeedIndex(speed);
  return CIRCLE_START_ANGLE + (idx / (PLAYBACK_RATES.length - 1)) * CIRCLE_RANGE;
}

function getSpeedForAngle(angle: number): number {
  const normalized = (angle - CIRCLE_START_ANGLE + 360) % 360;
  const clamped = Math.max(0, Math.min(CIRCLE_RANGE, normalized));
  const ratio = clamped / CIRCLE_RANGE;
  const idx = Math.round(ratio * (PLAYBACK_RATES.length - 1));
  return PLAYBACK_RATES[Math.max(0, Math.min(PLAYBACK_RATES.length - 1, idx))];
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(function VideoPlayer(props, ref) {
  const {
    m3u8Url,
    autoPlay,
    muted: initialMuted,
    aspectRatio,
    onDuration: onDurationProp,
    onError: onErrorProp,
    onSeekable: onSeekableProp,
    onTimeUpdate: onTimeUpdateProp,
    onPlay: onPlayProp,
    onPause: onPauseProp,
    onEnded: onEndedProp,
    onWaiting: onWaitingProp,
    onPlaying: onPlayingProp,
    variants,
    onQualityChange,
    theatreMode = false,
    onToggleTheatreMode,
    chapters,
  } = props;

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const playerSettings = usePlayerSettings();
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(playerSettings.volume);
  const [isMuted, setIsMuted] = useState(playerSettings.muted);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isBuffering, setIsBuffering] = useState(false);
  const [source, setSource] = useState(m3u8Url);
  const lastTimeUpdateRef = useRef(0);

  useEffect(() => {
    setVolume(playerSettings.volume);
  }, [playerSettings.volume]);

  useEffect(() => {
    setIsMuted(playerSettings.muted);
  }, [playerSettings.muted]);

  const { showControls } = useAutoHideControls({
    isPlaying,
    isMenuOpen: false,
    playerContainerRef: containerRef,
  });

  const currentChapter = useMemo(() => getCurrentChapter(currentTime, chapters), [currentTime, chapters]);

  const tooltipControls = useTooltipControls({ duration, chapters: chapters ?? undefined });
  const [settingsAnchorEl, setSettingsAnchorEl] = useState<HTMLElement | null>(null);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [menuMaxHeight, setMenuMaxHeight] = useState(400);
  const settingsMenuRef = useRef<HTMLDivElement>(null);

  const handleCloseSettings = useCallback(() => {
    setSettingsAnchorEl(null);
    setShowQualityMenu(false);
  }, []);

  const [showChaptersMenu, setShowChaptersMenu] = useState(false);
  const chaptersAnchorEl = useRef<HTMLButtonElement>(null);
  const chaptersMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (showChaptersMenu) {
        if (chaptersAnchorEl.current?.contains(e.target as Node)) return;
        if (chaptersMenuRef.current?.contains(e.target as Node)) return;
        setShowChaptersMenu(false);
      }
      if (settingsMenuRef.current || settingsAnchorEl) {
        if (settingsMenuRef.current?.contains(e.target as Node)) return;
        const settingsBtn = e.target as HTMLElement | null;
        if (settingsBtn?.closest('[title="Settings"]')) return;
        handleCloseSettings();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showChaptersMenu, settingsAnchorEl, handleCloseSettings]);

  const [showSpeedCircle, setShowSpeedCircle] = useState(false);
  const [speedCirclePos, setSpeedCirclePos] = useState({ x: 0, y: 0 });
  const [speedDragAngle, setSpeedDragAngle] = useState<number | null>(null);
  const speedCircleRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    seek: (time: number) => {
      const video = videoRef.current;
      if (video) video.currentTime = time;
    },
    play: () => {
      const video = videoRef.current;
      if (video) video.play();
    },
    pause: () => {
      const video = videoRef.current;
      if (video) video.pause();
    },
    get currentTime() {
      return videoRef.current?.currentTime ?? 0;
    },
  }));

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const now = performance.now();
      if (now - lastTimeUpdateRef.current >= TIME_UPDATE_THROTTLE_MS) {
        lastTimeUpdateRef.current = now;
        setCurrentTime(video.currentTime);
        onTimeUpdateProp?.(video.currentTime);
      }
    };
    const handleDurationChange = () => {
      if (!Number.isNaN(video.duration)) setDuration(video.duration);
    };
    const handleSeeked = () => {
      onSeekableProp?.(video.currentTime);
    };
    const handleError = () => {
      onErrorProp?.(video.error?.message ?? 'Playback error occurred');
    };
    const handlePlay = () => {
      setIsPlaying(true);
      onPlayProp?.();
    };
    const handlePause = () => {
      setIsPlaying(false);
      onPauseProp?.();
    };
    const handleEnded = () => {
      setIsPlaying(false);
      onEndedProp?.();
    };
    const handleWaiting = () => {
      setIsBuffering(true);
      onWaitingProp?.();
    };
    const handlePlaying = () => {
      setIsBuffering(false);
      onPlayingProp?.();
    };
    const handleLoadedMetadata = () => {
      if (video.duration && !Number.isNaN(video.duration)) {
        setDuration(video.duration);
        onDurationProp?.(video.duration);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('error', handleError);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('error', handleError);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [
    onTimeUpdateProp,
    onDurationProp,
    onErrorProp,
    onSeekableProp,
    onPlayProp,
    onPauseProp,
    onEndedProp,
    onWaitingProp,
    onPlayingProp,
  ]);

  useEffect(() => {
    setSource(m3u8Url);
  }, [m3u8Url]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !source) return;

    let hls: Hls | null = null;
    if (Hls.isSupported()) {
      hls = new Hls({
        loader: TauriHlsLoader,
        enableWorker: true,
        lowLatencyMode: false,
        maxBufferLength: 30,
        maxMaxBufferLength: 600,
        maxBufferSize: 60 * 1000 * 1000,
        backBufferLength: 30,
      });
      hlsRef.current = hls;
      hls.loadSource(source);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (autoPlay) video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          onErrorProp?.(`HLS error: ${data.details}`);
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls?.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls?.recoverMediaError();
              break;
            default:
              hls?.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = source;
      if (autoPlay) video.play().catch(() => {});
    }
    return () => {
      hls?.destroy();
      hlsRef.current = null;
      video.src = '';
    };
  }, [source, autoPlay, onErrorProp]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = isMuted ? 0 : volume / 100;
  }, [volume, isMuted]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = playbackSpeed;
  }, [playbackSpeed]);

  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.paused ? video.play() : video.pause();
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((v) => {
      const next = !v;
      playerSettings.setMuted(next);
      return next;
    });
  }, [playerSettings]);

  const handleVolumeChange = useCallback(
    (_e: Event, val: number | number[]) => {
      const v = typeof val === 'number' ? val : val[0];
      setVolume(v);
      playerSettings.setVolume(v);
      if (v > 0) setIsMuted(false);
    },
    [playerSettings],
  );

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  useKeyboardShortcuts({
    playerRef: videoRef,
    toggleFullscreen,
    toggleMute,
    togglePlayPause,
  });

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const handleQualitySelect = useCallback(
    (variant: M3u8Variant) => {
      if (source === variant.uri) return;
      setSource(variant.uri);
      onQualityChange?.(variant);
    },
    [source, onQualityChange],
  );

  const handleSpeedCircleEnter = useCallback((e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setSpeedCirclePos({ x: rect.left + rect.width / 2, y: rect.top });
    setShowSpeedCircle(true);
  }, []);

  const handleSpeedCircleLeave = useCallback(() => {
    setShowSpeedCircle(false);
  }, []);

  const handleSpeedCircleMove = useCallback((e: React.MouseEvent) => {
    if (!speedCircleRef.current) return;
    const rect = speedCircleRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const angle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI) + 90;
    const clamped = (angle + 360) % 360;
    setSpeedDragAngle(clamped);
  }, []);

  const handleSpeedCircleClick = useCallback((e: React.MouseEvent) => {
    if (!speedCircleRef.current) return;
    const rect = speedCircleRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const angle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI) + 90;
    const clamped = (angle + 360) % 360;
    const speed = getSpeedForAngle(clamped);
    setPlaybackSpeed(speed);
    setShowSpeedCircle(false);
  }, []);

  const displayAngle = speedDragAngle ?? getAngleForSpeed(playbackSpeed);

  const circleRadius = 40;
  const circleCx = 50;
  const circleCy = 50;
  const fullArc = describeArc(circleCx, circleCy, circleRadius, CIRCLE_START_ANGLE, CIRCLE_END_ANGLE);
  const activeArc =
    displayAngle <= CIRCLE_END_ANGLE && displayAngle >= CIRCLE_START_ANGLE
      ? describeArc(circleCx, circleCy, circleRadius, CIRCLE_START_ANGLE, displayAngle)
      : fullArc;

  const thumbPos = polarToCartesian(circleCx, circleCy, circleRadius, displayAngle);

  const aspectStyle = aspectRatio ? { aspectRatio } : {};

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-black select-none">
      <video
        ref={videoRef}
        className="h-full w-full"
        style={aspectStyle}
        autoPlay={autoPlay ?? false}
        muted={initialMuted ?? false}
        crossOrigin="anonymous"
        playsInline
        onClick={togglePlayPause}
        onDoubleClick={toggleFullscreen}
      />

      {source && (
        <>
          <div
            onClick={togglePlayPause}
            onDoubleClick={toggleFullscreen}
            className={`pointer-events-none absolute inset-0 flex cursor-pointer items-center justify-center transition-opacity duration-200 ${
              isPlaying ? 'opacity-0 delay-75' : 'opacity-100 delay-75'
            }`}
            style={{ background: 'rgba(0,0,0,0.5)' }}
          >
            <Play className="h-[15%] max-h-[72px] min-h-[32px] w-[15%] max-w-[72px] min-w-[32px] translate-x-1 text-text-primary drop-shadow-2xl" />
          </div>

          <div
            className="absolute right-0 bottom-0 left-0 flex flex-col justify-end"
            style={{
              minHeight: 60,
              maxHeight: '30vh',
              transition: 'opacity 0.3s ease',
              opacity: showControls ? 1 : 0,
              pointerEvents: showControls ? 'auto' : 'none',
            }}
          >
            <div className="flex flex-col rounded-t-xl bg-surface/85 px-2 pb-2 backdrop-blur-md" style={{ gap: '4px' }}>
              <div className="group relative flex w-full items-center">
                <div
                  ref={tooltipControls.progressTooltipRef}
                  className="pointer-events-none absolute bottom-full mb-3 -translate-x-1/2 transform rounded border-border bg-surface px-2 py-1 text-xs font-medium whitespace-nowrap text-text-primary opacity-0 shadow-md transition-opacity"
                  style={{ left: '0px' }}
                />
                <div
                  className="relative flex h-4 w-full cursor-pointer items-center"
                  onMouseDown={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                    const time = percent * duration;
                    const video = videoRef.current;
                    if (video) video.currentTime = time;
                  }}
                  onMouseMove={tooltipControls.handleProgressMouseMove}
                  onMouseLeave={tooltipControls.handleProgressMouseLeave}
                  onTouchStart={(e) => {
                    e.preventDefault();
                  }}
                  onTouchMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const touch = e.touches[0];
                    const percent = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
                    const time = percent * duration;
                    const video = videoRef.current;
                    if (video) video.currentTime = time;
                    tooltipControls.handleProgressTouchMove(e);
                  }}
                  onTouchEnd={tooltipControls.handleProgressTouchEnd}
                  style={{ contain: 'layout style' }}
                >
                  {chapters && chapters.length > 0 ? (
                    chapters.map((ch) => {
                      const chapterStart = ch.positionMilliseconds / 1000;
                      const chapterDuration = ch.durationMilliseconds / 1000;
                      const fillPct =
                        currentTime >= chapterStart && currentTime < chapterStart + chapterDuration
                          ? ((currentTime - chapterStart) / chapterDuration) * 100
                          : currentTime >= chapterStart + chapterDuration
                            ? 100
                            : 0;
                      const widthPct = duration ? (chapterDuration / duration) * 100 : 0;
                      return (
                        <div
                          key={ch.positionMilliseconds}
                          className="relative flex h-full items-center"
                          style={{ width: `${widthPct}%` }}
                        >
                          <div className="absolute inset-x-0 h-2 rounded-full bg-white/10 transition-all group-hover:h-2.5" />
                          <div
                            className="absolute inset-y-0 left-0 h-2 rounded-full bg-primary transition-all group-hover:h-2.5"
                            style={{ width: `${fillPct}%` }}
                          />
                        </div>
                      );
                    })
                  ) : (
                    <div className="relative flex h-full w-full items-center">
                      <div className="absolute inset-x-0 h-1.5 rounded-full bg-white/10 transition-all group-hover:h-2" />
                      <div
                        className="absolute inset-y-0 left-0 h-1.5 rounded-full bg-primary transition-all group-hover:h-2"
                        style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center" style={{ gap: '6px' }}>
                  <button
                    type="button"
                    onClick={togglePlayPause}
                    className="flex items-center justify-center text-text-primary transition-colors hover:text-primary"
                    title={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? (
                      <Pause className="h-5 w-5 sm:h-6 sm:w-6" />
                    ) : (
                      <Play className="h-5 w-5 sm:h-6 sm:w-6" />
                    )}
                  </button>

                  <div className="group/volume flex items-center" style={{ gap: '6px' }}>
                    <button
                      type="button"
                      onClick={toggleMute}
                      className="flex items-center justify-center text-text-primary transition-colors hover:text-primary"
                      title={isMuted ? 'Unmute' : 'Mute'}
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX className="h-5 w-5 sm:h-6 sm:w-6" />
                      ) : (
                        <Volume2 className="h-5 w-5 sm:h-6 sm:w-6" />
                      )}
                    </button>

                    <div className="relative flex h-6 items-center">
                      <div
                        ref={tooltipControls.volumeTooltipRef}
                        className="pointer-events-none absolute bottom-full mb-3 -translate-x-1/2 transform rounded border-border bg-surface px-2 py-1 text-xs font-medium whitespace-nowrap text-text-primary opacity-0 shadow-md transition-opacity"
                        style={{ left: '0px' }}
                      />
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={isMuted ? 0 : volume}
                        step="any"
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          handleVolumeChange(e.nativeEvent, val);
                        }}
                        onMouseDown={tooltipControls.handleVolumeMouseDown}
                        onMouseUp={tooltipControls.handleVolumeMouseUp}
                        onMouseMove={tooltipControls.handleVolumeMouseMove}
                        onMouseLeave={tooltipControls.handleVolumeMouseLeave}
                        onTouchStart={tooltipControls.handleVolumeMouseDown}
                        onTouchEnd={tooltipControls.handleVolumeTouchEnd}
                        onTouchMove={tooltipControls.handleVolumeTouchMove}
                        className="h-1.5 w-12 min-w-[3rem] cursor-pointer appearance-none rounded-lg accent-primary transition-all sm:w-[70px] sm:min-w-[70px]"
                        style={{
                          background: `linear-gradient(to right, var(--color-primary) ${isMuted ? 0 : volume}%, rgba(232,121,168,0.3) ${isMuted ? 0 : volume}%)`,
                        }}
                      />
                    </div>
                  </div>

                  <span className="ml-1 text-[11px] font-medium tracking-wide text-text-primary/90 tabular-nums sm:ml-2 sm:text-[13px]">
                    {`${formatTime(currentTime)} / ${formatTime(duration)}`}
                  </span>
                  {currentChapter && (
                    <>
                      <span className="mx-1 text-[11px] text-text-primary/40 sm:mx-1.5">•</span>
                      <span className="truncate max-w-[120px] text-[11px] font-medium text-text-primary/60 sm:max-w-[180px] sm:text-[13px]">
                        {currentChapter}
                      </span>
                    </>
                  )}
                </div>

                <div className="relative flex items-center" style={{ gap: '6px' }}>
                  <button
                    ref={chaptersAnchorEl}
                    type="button"
                    onClick={() => setShowChaptersMenu((v) => !v)}
                    className="flex items-center justify-center text-text-primary transition-colors hover:text-primary"
                    title="Chapters"
                  >
                    <Library className="h-5 w-5 sm:h-6 sm:w-6" />
                  </button>
                  <div className="relative">
                    <button
                      type="button"
                      onMouseEnter={handleSpeedCircleEnter}
                      onMouseLeave={handleSpeedCircleLeave}
                      onClick={() => {
                        const nextIdx = (PLAYBACK_RATES.indexOf(playbackSpeed) + 1) % PLAYBACK_RATES.length;
                        setPlaybackSpeed(PLAYBACK_RATES[nextIdx]);
                      }}
                      className="flex items-center justify-center rounded px-1.5 py-1 text-text-primary text-xs font-medium transition-colors hover:text-primary"
                      title="Playback Speed"
                    >
                      {playbackSpeed}x
                    </button>

                    {showSpeedCircle && (
                      <div
                        ref={speedCircleRef}
                        className="absolute bottom-full right-0 z-50 cursor-crosshair"
                        style={{
                          transform: `translate(${Math.min(speedCirclePos.x, window.innerWidth - 120)}px, ${speedCirclePos.y - 10}px)`,
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleSpeedCircleMove(e);
                        }}
                        onMouseMove={handleSpeedCircleMove}
                        onMouseUp={(e) => {
                          e.stopPropagation();
                          handleSpeedCircleClick(e);
                        }}
                      >
                        <svg
                          width={100}
                          height={100}
                          className="drop-shadow-xl"
                          role="img"
                          aria-label="Playback speed selector"
                        >
                          <title>Speed: {playbackSpeed}x</title>
                          <defs>
                            <filter id="speedGlow">
                              <feGaussianBlur stdDeviation="2" result="blur" />
                              <feMerge>
                                <feMergeNode in="blur" />
                                <feMergeNode in="SourceGraphic" />
                              </feMerge>
                            </filter>
                          </defs>
                          <path
                            d={fullArc}
                            fill="none"
                            stroke="rgba(232,121,168,0.2)"
                            strokeWidth="4"
                            strokeLinecap="round"
                          />
                          <path
                            d={activeArc}
                            fill="none"
                            stroke="var(--color-primary)"
                            strokeWidth="4"
                            strokeLinecap="round"
                            filter="url(#speedGlow)"
                          />
                          {PLAYBACK_RATES.map((rate, i) => {
                            const angle = CIRCLE_START_ANGLE + (i / (PLAYBACK_RATES.length - 1)) * CIRCLE_RANGE;
                            const pos = polarToCartesian(circleCx, circleCy, circleRadius + 8, angle);
                            const isActive = Math.abs(rate - playbackSpeed) < 0.01;
                            return (
                              <text
                                key={rate}
                                x={pos.x}
                                y={pos.y}
                                textAnchor="middle"
                                dominantBaseline="central"
                                fill={isActive ? 'var(--color-primary)' : 'var(--color-text-hint)'}
                                fontSize="7"
                                fontWeight={isActive ? 'bold' : 'normal'}
                                className="pointer-events-none select-none"
                              >
                                {rate}
                              </text>
                            );
                          })}
                          <circle
                            cx={thumbPos.x}
                            cy={thumbPos.y}
                            r="5"
                            fill="var(--color-primary)"
                            stroke="#fff"
                            strokeWidth="1.5"
                            className="pointer-events-none"
                          />
                          <text
                            x={circleCx}
                            y={circleCy}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fill="var(--color-text-primary)"
                            fontSize="12"
                            fontWeight="bold"
                            className="pointer-events-none select-none"
                          >
                            {playbackSpeed}x
                          </text>
                        </svg>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      if (settingsAnchorEl && settingsAnchorEl === e.currentTarget) {
                        handleCloseSettings();
                      } else {
                        if (containerRef.current) {
                          const h = containerRef.current.clientHeight;
                          setMenuMaxHeight(Math.max(80, h - 90));
                        }
                        setSettingsAnchorEl(e.currentTarget);
                      }
                    }}
                    className="flex items-center justify-center text-text-primary transition-colors hover:text-primary"
                    title="Settings"
                  >
                    <Settings className="h-5 w-5 sm:h-6 sm:w-6" />
                  </button>

                  {onToggleTheatreMode && (
                    <button
                      type="button"
                      onClick={onToggleTheatreMode}
                      className="flex items-center justify-center text-text-primary transition-colors hover:text-primary"
                      title={theatreMode ? 'Exit Theatre Mode' : 'Theatre Mode'}
                    >
                      <TheatreModeIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    className="flex items-center justify-center text-text-primary transition-colors hover:text-primary"
                    title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                  >
                    {isFullscreen ? (
                      <Minimize className="h-5 w-5 sm:h-6 sm:w-6" />
                    ) : (
                      <Maximize className="h-5 w-5 sm:h-6 sm:w-6" />
                    )}
                  </button>

                  {showChaptersMenu && (
                    <div
                      ref={chaptersMenuRef}
                      className="absolute right-0 bottom-full mb-3 w-60 overflow-hidden rounded-xl border-border bg-surface shadow-xl"
                      style={{ animation: 'fadeIn 0.2s ease-out' }}
                    >
                      <div className="border-b border-[#222230] px-4 py-2.5">
                        <h3 className="text-center text-sm font-medium text-[#f0f0f5]">Chapters</h3>
                      </div>
                      <div
                        className="max-h-60 overflow-y-auto p-1.5"
                        style={{ scrollbarWidth: 'thin', scrollbarColor: '#222230 transparent' }}
                      >
                        {chapters?.map((ch) => (
                          <button
                            key={ch.positionMilliseconds}
                            type="button"
                            onClick={() => {
                              const video = videoRef.current;
                              if (video) video.currentTime = ch.positionMilliseconds / 1000;
                              setShowChaptersMenu(false);
                            }}
                            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all hover:bg-white/5"
                          >
                            <div className="flex h-[53px] w-[40px] shrink-0 items-center justify-center overflow-hidden rounded bg-border">
                              {ch.boxArtURL ? (
                                <img src={ch.boxArtURL} alt="" className="h-[53px] w-[40px] object-cover" />
                              ) : (
                                <Library className="h-5 w-5 text-text-muted" />
                              )}
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col">
                              <span className="break-words text-sm font-medium text-text-primary">
                                {ch.game || 'Unknown Chapter'}
                              </span>
                              <span className="text-xs text-text-muted">
                                {humanizeDuration(ch.durationMilliseconds)}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {settingsAnchorEl && (
                    <div
                      ref={settingsMenuRef}
                      className="absolute right-0 bottom-full mb-3 w-56 overflow-hidden rounded-xl border-border bg-surface shadow-xl"
                      style={{ maxHeight: `${menuMaxHeight}px`, animation: 'fadeIn 0.2s ease-out' }}
                    >
                      {showQualityMenu ? (
                        <div>
                          <button
                            type="button"
                            onClick={() => setShowQualityMenu(false)}
                            className="flex w-full items-center gap-2.5 border-b border-border px-4 py-2.5 text-left text-sm font-medium text-text-primary transition-colors hover:text-primary"
                          >
                            <ChevronLeft className="h-4 w-4" />
                            <span>Back</span>
                          </button>
                          <div
                            className="max-h-60 overflow-y-auto p-1.5"
                            style={{ scrollbarWidth: 'thin', scrollbarColor: '#222230 transparent' }}
                          >
                            {variants?.map((variant) => {
                              const isActive = source === variant.uri;
                              return (
                                <button
                                  type="button"
                                  key={variant.uri}
                                  onClick={() => {
                                    handleQualitySelect(variant);
                                    handleCloseSettings();
                                  }}
                                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-all ${
                                    isActive
                                      ? 'bg-primary/20 text-primary'
                                      : 'text-text-primary hover:bg-white/5 hover:text-primary'
                                  }`}
                                >
                                  <span className="font-medium">{variant.name}</span>
                                  {isActive && <Check className="h-4 w-4 shrink-0" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="p-1.5">
                          {variants && variants.length > 1 && (
                            <>
                              <button
                                type="button"
                                onClick={() => setShowQualityMenu(true)}
                                className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-medium text-text-primary transition-all hover:bg-white/5 hover:text-primary"
                              >
                                Quality
                                <span className="text-xs text-[#9ca3af]">{'>'}</span>
                              </button>
                              <hr className="my-1.5 border-border" />
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {isBuffering && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-text-primary/80" />
            </div>
          )}
        </>
      )}
    </div>
  );
});

export default VideoPlayer;
