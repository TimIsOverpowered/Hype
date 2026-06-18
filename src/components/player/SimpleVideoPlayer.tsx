import Hls from 'hls.js';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { TauriHlsLoader } from '../../media/TauriHlsLoader';

interface SimpleVideoPlayerProps {
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

export interface SimpleVideoPlayerHandle {
  readonly seek: (time: number) => void;
  readonly play: () => void;
  readonly pause: () => void;
}

const SimpleVideoPlayer = forwardRef<SimpleVideoPlayerHandle, SimpleVideoPlayerProps>(
  function SimpleVideoPlayer(props, ref) {
    const {
      m3u8Url,
      autoPlay,
      muted: initialMuted,
      aspectRatio,
      onDuration: onDurationProp,
      onError: onErrorProp,
      onSeekable: onSeekableProp,
      onTimeUpdate: onTimeUpdateProp,
    } = props;

    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);

    useImperativeHandle(ref, () => ({
      seek: (time: number) => {
        const video = videoRef.current;
        if (video) {
          video.currentTime = time;
        }
      },
      play: () => {
        const video = videoRef.current;
        if (video) {
          video.play();
        }
      },
      pause: () => {
        const video = videoRef.current;
        if (video) {
          video.pause();
        }
      },
    }));

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      const handleTimeUpdate = () => {
        onTimeUpdateProp?.(video.currentTime);
      };

      const handleDurationChange = () => {
        if (!Number.isNaN(video.duration)) {
          onDurationProp?.(video.duration);
        }
      };

      const handleSeeked = () => {
        onSeekableProp?.(video.currentTime);
      };

      const handleError = () => {
        onErrorProp?.(video.error?.message ?? 'Playback error occurred');
      };

      video.addEventListener('timeupdate', handleTimeUpdate);
      video.addEventListener('durationchange', handleDurationChange);
      video.addEventListener('seeked', handleSeeked);
      video.addEventListener('error', handleError);

      return () => {
        video.removeEventListener('timeupdate', handleTimeUpdate);
        video.removeEventListener('durationchange', handleDurationChange);
        video.removeEventListener('seeked', handleSeeked);
        video.removeEventListener('error', handleError);
      };
    }, [onTimeUpdateProp, onDurationProp, onErrorProp, onSeekableProp]);

    useEffect(() => {
      const video = videoRef.current;
      if (!video || !m3u8Url) return;

      let hls: Hls | null = null;

      if (Hls.isSupported()) {
        hls = new Hls({
          loader: TauriHlsLoader,
          enableWorker: false,
        });
        hlsRef.current = hls;

        hls.loadSource(m3u8Url);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (autoPlay) {
            video.play().catch(() => {});
          }
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
        video.src = m3u8Url;
        if (autoPlay) {
          video.play().catch(() => {});
        }
      }

      return () => {
        hls?.destroy();
        hlsRef.current = null;
        video.src = '';
      };
    }, [m3u8Url, autoPlay, onErrorProp]);

    const aspectStyle = aspectRatio ? { aspectRatio } : {};

    return (
      <div className="relative h-full w-full overflow-hidden bg-black select-none">
        <video
          ref={videoRef}
          className="h-full w-full"
          style={aspectStyle}
          autoPlay={autoPlay ?? false}
          muted={initialMuted ?? false}
          controls
          crossOrigin="anonymous"
        />
      </div>
    );
  },
);

export default SimpleVideoPlayer;
