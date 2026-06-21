import { invoke } from '@tauri-apps/api/core';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getVod, getVodToken, resolveM3u8 } from '../api/twitch';
import { getToken } from '../auth';
import ChatReplay from '../components/chat/ChatReplay';
import VodGraph from '../components/graph/VodGraph';
import VideoPlayer, { type VideoPlayerHandle } from '../components/player/VideoPlayer';
import ClipBar from '../components/ui/ClipBar';
import DownloadVodModal from '../components/ui/DownloadVodModal';
import { useChatSettings } from '../hooks/useChatSettings';
import { useClipJob } from '../hooks/useClipJob';
import type { SerializedEmoteSet } from '../types/graph';
import type { M3u8Variant } from '../types/twitch';
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
  const chatSettings = useChatSettings();
  const [theatreMode, setTheatreMode] = useState(() => {
    const saved = safeLocalStorage.getItem('theatre-mode');
    return saved === 'true';
  });
  const [variants, setVariants] = useState<M3u8Variant[]>([]);
  const [emotesLoaded, setEmotesLoaded] = useState(false);

  const { startClip, startDownload } = useClipJob();

  const emoteDataRef = useRef<SerializedEmoteSet>({
    bttv: [],
    ffz: [],
    seventv: [],
  });

  useEffect(() => {
    if (!broadcasterId) return;

    const abortController = new AbortController();

    const loadEmotes = async () => {
      try {
        const data = await invoke<SerializedEmoteSet>('fetch_emotes', { broadcasterId });
        if (!abortController.signal.aborted) {
          emoteDataRef.current = data;
          setEmotesLoaded(true);
        }
      } catch {
        // ignore
      }
    };

    loadEmotes();

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
    (vodId: string, _m3u8Url: string, startSeconds: number, durationSeconds: number, includeChat: boolean) => {
      startClip(vodId, m3u8Url, startSeconds, durationSeconds, vodInfo?.broadcasterName ?? '', {
        includeChat,
        broadcasterId: broadcasterId ?? '',
        vodId: vodId,
      });
    },
    [startClip, m3u8Url, vodInfo, broadcasterId],
  );

  const handleDownload = useCallback(
    (selectedM3u8Url: string, includeChat: boolean) => {
      setShowDownloadModal(false);
      startDownload(vodId, selectedM3u8Url, vodInfo?.lengthSeconds ?? 0, vodInfo?.broadcasterName ?? '', {
        includeChat,
        broadcasterId: broadcasterId ?? '',
        vodId: vodId,
      });
    },
    [startDownload, vodId, vodInfo, broadcasterId],
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
