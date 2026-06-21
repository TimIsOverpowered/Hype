import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getVod, getVodToken, resolveM3u8 } from '../api/twitch';
import { getToken } from '../auth';
import ChatReplay from '../components/chat/ChatReplay';
import VodGraph from '../components/graph/VodGraph';
import VideoPlayer, { type VideoPlayerHandle } from '../components/player/VideoPlayer';
import ChatSettingsModal from '../components/ui/ChatSettingsModal';
import ClipBar from '../components/ui/ClipBar';
import DownloadVodModal from '../components/ui/DownloadVodModal';
import { BTTV_API_BASE, FFZ_API_BASE, SEVENTV_API_BASE } from '../constants/emotes';
import { useChatSettings } from '../hooks/useChatSettings';
import { useClipJob } from '../hooks/useClipJob';
import type { BttvEmote, FfzEmote, M3u8Variant, SevenTVEmote } from '../types/twitch';
import { safeLocalStorage } from '../utils/safeLocalStorage';

export default function VODPage() {
  const { vodId: paramVodId } = useParams() as { vodId: string };
  const [vodId] = useState(paramVodId);
  const [error, setError] = useState<string | null>(null);

  const [m3u8Url, setM3u8Url] = useState('');
  const [vodInfo, setVodInfo] = useState<{
    id: string;
    title: string;
    lengthSeconds: number;
    broadcasterName: string;
  } | null>(null);
  const [broadcasterId, setBroadcasterId] = useState<string | undefined>();
  const [isWhitelisted, setIsWhitelisted] = useState<boolean | undefined>(undefined);

  const playerRef = useRef<VideoPlayerHandle>(null);
  const [playerState, setPlayerState] = useState<number>(-1);
  const [currentTime, setCurrentTime] = useState(0);
  const [clipStart, setClipStart] = useState('00:00:00');
  const [clipEnd, setClipEnd] = useState('00:00:00');

  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [showChatSettings, setShowChatSettings] = useState(false);
  const chatSettings = useChatSettings();
  const [theatreMode, setTheatreMode] = useState(() => {
    const saved = safeLocalStorage.getItem('theatre-mode');
    return saved === 'true';
  });
  const [variants, setVariants] = useState<M3u8Variant[]>([]);
  const [emotesLoaded, setEmotesLoaded] = useState(false);

  const { startClip, startDownload } = useClipJob();

  const emoteDataRef = useRef({
    bttv: [] as BttvEmote[],
    ffz: [] as FfzEmote[],
    seventv: [] as SevenTVEmote[],
  });

  useEffect(() => {
    if (!broadcasterId) return;

    const abortController = new AbortController();

    const loadBTTVGlobalEmotes = async () => {
      try {
        const response = await fetch(`${BTTV_API_BASE}/cached/emotes/global`, { signal: abortController.signal });
        const data = await response.json();
        if (!abortController.signal.aborted && Array.isArray(data)) {
          emoteDataRef.current.bttv = [...emoteDataRef.current.bttv, ...data];
        }
      } catch {
        // ignore
      }
    };

    const loadBTTVChannelEmotes = async () => {
      try {
        const response = await fetch(`${BTTV_API_BASE}/cached/users/twitch/${broadcasterId}`, {
          signal: abortController.signal,
        });
        const data = await response.json();
        if (!abortController.signal.aborted && data && typeof data === 'object') {
          const d = data as { sharedEmotes?: BttvEmote[]; channelEmotes?: BttvEmote[] };
          const combined = [...(d.sharedEmotes ?? []), ...(d.channelEmotes ?? [])];
          emoteDataRef.current.bttv = [...emoteDataRef.current.bttv, ...combined];
        }
      } catch {
        // ignore
      }
    };

    const loadFFZEmotes = async () => {
      try {
        const response = await fetch(`${FFZ_API_BASE}/room/id/${broadcasterId}`, { signal: abortController.signal });
        const raw = await response.json();
        if (!abortController.signal.aborted && raw && typeof raw === 'object') {
          const d = raw as { sets?: Record<string, { emoticons: FfzEmote[] }>; room?: { set?: number } };
          const emoticons = d.sets?.[String(d.room?.set)]?.emoticons ?? [];
          emoteDataRef.current.ffz = emoticons;
        }
      } catch {
        // ignore
      }
    };

    const load7TVEmotes = async () => {
      try {
        const response = await fetch(`${SEVENTV_API_BASE}/users/twitch/${broadcasterId}`, {
          signal: abortController.signal,
        });
        const data = await response.json();
        if (!abortController.signal.aborted && data && typeof data === 'object') {
          const d = data as { emote_set?: { emotes: SevenTVEmote[] } };
          const emotes = d.emote_set?.emotes ?? [];
          for (const emote of emotes) {
            const file = (emote as { data?: { host?: { files?: Array<{ width?: number; height?: number }> } } })?.data
              ?.host?.files?.[0];
            if (file) {
              (emote as unknown as SevenTVEmote & { width?: number; height?: number }).width = file.width;
              (emote as unknown as SevenTVEmote & { width?: number; height?: number }).height = file.height;
            }
          }
          emoteDataRef.current.seventv = emotes;
        }
      } catch {
        // ignore
      }
    };

    const load7TVGlobalEmotes = async () => {
      try {
        const response = await fetch(`${SEVENTV_API_BASE}/emote-sets/global`, {
          signal: abortController.signal,
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await response.json();
        if (!abortController.signal.aborted && data && typeof data === 'object') {
          const d = data as { emotes: SevenTVEmote[] };
          const emotes = d.emotes ?? [];
          for (const emote of emotes) {
            const file = (emote as { data?: { host?: { files?: Array<{ width?: number; height?: number }> } } })?.data
              ?.host?.files?.[0];
            if (file) {
              (emote as unknown as SevenTVEmote & { width?: number; height?: number }).width = file.width;
              (emote as unknown as SevenTVEmote & { width?: number; height?: number }).height = file.height;
            }
          }
          emoteDataRef.current.seventv = [...emoteDataRef.current.seventv, ...emotes];
        }
      } catch {
        // ignore
      }
    };

    const loadAll = async () => {
      await Promise.all([
        loadBTTVGlobalEmotes(),
        loadBTTVChannelEmotes(),
        loadFFZEmotes(),
        load7TVEmotes(),
        load7TVGlobalEmotes(),
      ]);
      if (!abortController.signal.aborted) {
        setEmotesLoaded(true);
      }
    };
    loadAll();

    return () => abortController.abort();
  }, [broadcasterId]);

  const loadVod = useCallback(async () => {
    const id = vodId.trim();
    if (!id) return;

    setError(null);
    setM3u8Url('');
    setVodInfo(null);

    try {
      const vod = await getVod(id);
      const token = await getVodToken(id);
      const { m3u8Url: m3u8, variants: m3u8Variants } = await resolveM3u8(
        id,
        token.value,
        token.signature,
        vod.previewThumbnailURL,
      );
      setVodInfo({
        id: vod.id,
        title: vod.title,
        lengthSeconds: vod.lengthSeconds,
        broadcasterName: vod.creator.login ?? '',
      });
      setM3u8Url(m3u8);
      setVariants(m3u8Variants);
      setBroadcasterId(vod.creator.id);

      const wlRes = await fetch(`https://api.hype.lol/v1/whitelist?twitchId=${vod.creator.id}`);
      if (wlRes.ok) {
        const wlData = await wlRes.json();
        setIsWhitelisted(!!(wlData.data && wlData.data.length > 0));
      } else {
        setIsWhitelisted(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load VOD');
    }
  }, [vodId]);

  useEffect(() => {
    if (paramVodId) {
      loadVod();
    }
  }, [paramVodId, loadVod]);

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleClip = useCallback(
    (vodId: string, _m3u8Url: string, startSeconds: number, durationSeconds: number) => {
      startClip(vodId, m3u8Url, startSeconds, durationSeconds, vodInfo?.broadcasterName ?? '');
    },
    [startClip, m3u8Url, vodInfo],
  );

  const handleDownload = useCallback(
    (selectedM3u8Url: string) => {
      setShowDownloadModal(false);
      startDownload(vodId, selectedM3u8Url, vodInfo?.lengthSeconds ?? 0, vodInfo?.broadcasterName ?? '');
    },
    [startDownload, vodId, vodInfo],
  );

  const toggleTheatreMode = useCallback(() => {
    setTheatreMode((prev) => {
      const next = !prev;
      if (next) {
        document.body.classList.add('theatre-mode');
      } else {
        document.body.classList.remove('theatre-mode');
      }
      safeLocalStorage.setItem('theatre-mode', String(next));
      return next;
    });
  }, []);

  if (!getToken()) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-background p-6">
        <p className="text-text-secondary">You must be logged in to view this page.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-background">
      {/* Player + Chat row */}
      <div
        className={`relative flex w-full ${chatSettings.chatOnLeft ? 'flex-row-reverse' : ''} ${theatreMode ? 'h-full' : 'h-[50%]'}`}
      >
        <div className="flex min-w-0 flex-1 flex-col bg-black">
          <VideoPlayer
            vodId={vodId || ''}
            m3u8Url={m3u8Url}
            ref={playerRef}
            autoPlay
            onTimeUpdate={handleTimeUpdate}
            onPause={() => setPlayerState(2)}
            onEnded={() => setPlayerState(0)}
            onWaiting={() => setPlayerState(3)}
            onPlay={() => setPlayerState(1)}
            onPlaying={() => setPlayerState(1)}
            streamType="on-demand"
            variants={variants}
            theatreMode={theatreMode}
            onToggleTheatreMode={toggleTheatreMode}
          />
        </div>
        <ChatReplay
          vodId={vodId || ''}
          broadcasterId={broadcasterId}
          playerRef={playerRef as React.RefObject<unknown>}
          userChatDelay={0}
          playerState={playerState}
          showChat={showChat}
          setShowChat={setShowChat}
          onOpenSettings={() => setShowChatSettings(true)}
          chatSettings={chatSettings}
        />
        {!showChat && (
          <button
            type="button"
            onClick={() => setShowChat(!showChat)}
            className={`absolute top-2 z-50 flex cursor-pointer items-center justify-center border border-border bg-surface p-1.5 text-text-primary shadow-xl transition-all hover:bg-surface-elevated hover:text-text-primary ${
              chatSettings.chatOnLeft ? 'left-2 rounded-r-lg' : 'right-2 rounded-l-lg'
            }`}
            title="Expand Chat"
          >
            {chatSettings.chatOnLeft ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        )}
      </div>

      {/* Clip bar + Graph + Job progress — hidden in theatre mode */}
      <div className="theatre-hide flex min-h-0 flex-1 flex-col">
        <ClipBar
          vodId={vodId || ''}
          m3u8Url={m3u8Url || ''}
          duration={vodInfo?.lengthSeconds ?? 0}
          currentTime={currentTime}
          clipStart={clipStart}
          clipEnd={clipEnd}
          onClip={handleClip}
          onDownload={() => setShowDownloadModal(true)}
          onSetStart={setClipStart}
          onSetEnd={setClipEnd}
        />
        <ChatSettingsModal
          open={showChatSettings}
          onClose={() => setShowChatSettings(false)}
          chatSettings={chatSettings}
        />
        <DownloadVodModal
          open={showDownloadModal}
          onClose={() => setShowDownloadModal(false)}
          onDownload={handleDownload}
          vodId={vodId || ''}
          vodTitle={vodInfo?.title ?? ''}
          duration={vodInfo?.lengthSeconds ?? 0}
          variants={variants}
          isLoading={false}
        />
        <div className="border-t border-border p-3 flex flex-1 flex-col min-h-0">
          <VodGraph
            vodId={vodId || ''}
            playerRef={
              playerRef as React.RefObject<{
                seek: (t: number) => void;
                play: () => void;
                pause: () => void;
              } | null>
            }
            emoteData={emoteDataRef}
            emotesLoaded={emotesLoaded}
            duration={vodInfo?.lengthSeconds ?? 0}
            currentTime={currentTime}
            isWhitelisted={isWhitelisted}
            onClipStart={(hms: string) => setClipStart(hms)}
            onClipEnd={(hms: string) => setClipEnd(hms)}
          />
        </div>
      </div>

      {error && (
        <div className="border-t border-red-900/50 bg-red-950/30 px-4 py-2">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}
