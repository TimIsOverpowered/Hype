import {
  isHLSProvider,
  MediaPlayer,
  type MediaPlayerInstance,
  MediaProvider,
  type MediaProviderAdapter,
  type MediaProviderChangeEvent,
} from '@vidstack/react';
import { DefaultVideoLayout, defaultLayoutIcons } from '@vidstack/react/player/layouts/default';
import Hls from 'hls.js/light';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

interface VodPlayerProps {
  readonly vodId: string;
  readonly m3u8Url: string;
  readonly onTimeUpdate?: (time: number) => void;
  readonly startTime?: number;
  readonly autoPlay?: boolean;
  readonly muted?: boolean;
  readonly aspectRatio?: string;
  readonly onDuration?: (duration: number) => void;
  readonly onError?: (error: string | null) => void;
  readonly onSeekable?: (time: number) => void;
  readonly streamType?: 'on-demand' | 'live' | 'live:dvr' | 'll-live' | 'll-live:dvr';
}

export interface VodPlayerHandle {
  readonly seek: (time: number) => void;
  readonly play: () => void;
  readonly pause: () => void;
}

const VodPlayer = forwardRef<VodPlayerHandle, VodPlayerProps>(function VodPlayer(props, ref) {
  const {
    m3u8Url,
    startTime,
    autoPlay,
    muted: initialMuted,
    aspectRatio,
    onDuration: onDurationProp,
    onError: onErrorProp,
    onSeekable: onSeekableProp,
    streamType,
    onTimeUpdate: onTimeUpdateProp,
  } = props;

  const playerInstanceRef = useRef<MediaPlayerInstance>(null);
  const timeUpdateThrottleRef = useRef<number>(0);

  const onProviderChange = (provider: MediaProviderAdapter | null, _event: MediaProviderChangeEvent) => {
    if (isHLSProvider(provider)) {
      provider.library = Hls;
    }
  };

  useImperativeHandle(ref, () => ({
    seek: (time: number) => {
      const player = playerInstanceRef.current;
      if (player) {
        player.currentTime = time;
      }
    },
    play: () => {
      const player = playerInstanceRef.current;
      if (player) {
        player.play();
      }
    },
    pause: () => {
      const player = playerInstanceRef.current;
      if (player) {
        player.pause();
      }
    },
  }));

  useEffect(() => {
    const player = playerInstanceRef.current;
    if (!player) return;

    const handleTimeUpdate = () => {
      const now = performance.now();
      if (now - timeUpdateThrottleRef.current < 100) return;
      timeUpdateThrottleRef.current = now;
      onTimeUpdateProp?.(player.currentTime);
    };

    const onDurationChange = () => {
      const dur = player.duration;
      if (!Number.isNaN(dur)) {
        onDurationProp?.(dur);
      }
    };

    const onSeeked = () => {
      onSeekableProp?.(player.currentTime);
    };

    const onErrorEvent = () => {
      const msg = 'Playback error occurred';
      onErrorProp?.(msg);
    };

    player.addEventListener('timeupdate', handleTimeUpdate as unknown as EventListener);
    player.addEventListener('durationchange', onDurationChange as unknown as EventListener);
    player.addEventListener('seeked', onSeeked as unknown as EventListener);
    player.addEventListener('error', onErrorEvent as unknown as EventListener);

    return () => {
      player.removeEventListener('timeupdate', handleTimeUpdate as unknown as EventListener);
      player.removeEventListener('durationchange', onDurationChange as unknown as EventListener);
      player.removeEventListener('seeked', onSeeked as unknown as EventListener);
      player.removeEventListener('error', onErrorEvent as unknown as EventListener);
    };
  }, [onDurationProp, onErrorProp, onSeekableProp, onTimeUpdateProp]);

  return (
    <div className="relative w-full overflow-hidden bg-black rounded-lg select-none">
      <MediaPlayer
        src={m3u8Url}
        ref={playerInstanceRef}
        aspectRatio={aspectRatio}
        autoPlay={autoPlay ?? false}
        muted={initialMuted ?? false}
        streamType={streamType ?? 'on-demand'}
        currentTime={startTime}
        crossOrigin="anonymous"
        onProviderChange={onProviderChange}
      >
        <MediaProvider />
        <DefaultVideoLayout icons={defaultLayoutIcons} />
      </MediaPlayer>
    </div>
  );
});

export default VodPlayer;
