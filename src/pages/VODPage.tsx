import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchM3u8, getChapters, getVod, getVodToken } from '../api/twitch';
import ChatReplay from '../components/chat/ChatReplay';
import VodGraph from '../components/graph/VodGraph';
import VodPlayer, { type VodPlayerHandle } from '../components/player/VodPlayer';
import type { WorkerEmoteData } from '../types/graph';
import type { BttvEmote, FfzEmote, SevenTVEmote } from '../types/twitch';

const BASE_BTTV_EMOTE_API = 'https://api.betterttv.net/3';
const BASE_FFZ_EMOTE_API = 'https://api.frankerfacez.com/v1';
const BASE_7TV_EMOTE_API = 'https://7tv.io/v3';

export default function VODPage() {
  const { vodId: paramVodId } = useParams() as { vodId: string };
  const [vodId, setVodId] = useState(paramVodId);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [m3u8Url, setM3u8Url] = useState('');
  const [vodInfo, setVodInfo] = useState<{ id: string; title: string; lengthSeconds: number } | null>(null);
  const [twitchId, setTwitchId] = useState<number | undefined>();

  const [bttvEmotes, setBttvEmotes] = useState<BttvEmote[]>([]);
  const [ffzEmotes, setFfzEmotes] = useState<FfzEmote[]>([]);
  const [seventvEmotes, setSeventvEmotes] = useState<SevenTVEmote[]>([]);

  const playerRef = useRef<VodPlayerHandle>(null);
  const [_playerState] = useState<number>(-1);
  const [duration, setDuration] = useState<number>(0);

  const emoteData: WorkerEmoteData = {
    bttv: bttvEmotes,
    ffz: ffzEmotes,
    seventv: seventvEmotes,
  };

  useEffect(() => {
    if (!twitchId) return;

    const abortController = new AbortController();

    const loadBTTVGlobalEmotes = async () => {
      try {
        const response = await fetch(`${BASE_BTTV_EMOTE_API}/cached/emotes/global`, { signal: abortController.signal });
        const data = await response.json();
        if (!abortController.signal.aborted && Array.isArray(data)) {
          setBttvEmotes((prev) => [...prev, ...data]);
        }
      } catch {
        // ignore
      }
    };

    const loadBTTVChannelEmotes = async () => {
      try {
        const response = await fetch(`${BASE_BTTV_EMOTE_API}/cached/users/twitch/${twitchId}`, {
          signal: abortController.signal,
        });
        const data = await response.json();
        if (!abortController.signal.aborted && data && typeof data === 'object') {
          const d = data as { sharedEmotes?: BttvEmote[]; channelEmotes?: BttvEmote[] };
          const combined = [...(d.sharedEmotes ?? []), ...(d.channelEmotes ?? [])];
          setBttvEmotes((prev) => [...prev, ...combined]);
        }
      } catch {
        // ignore
      }
    };

    const loadFFZEmotes = async () => {
      try {
        const response = await fetch(`${BASE_FFZ_EMOTE_API}/room/id/${twitchId}`, { signal: abortController.signal });
        const raw = await response.json();
        if (!abortController.signal.aborted && raw && typeof raw === 'object') {
          const d = raw as { sets?: Record<string, { emoticons: FfzEmote[] }>; room?: { set?: number } };
          const emoticons = d.sets?.[String(d.room?.set)]?.emoticons ?? [];
          setFfzEmotes(emoticons);
        }
      } catch {
        // ignore
      }
    };

    const load7TVEmotes = async () => {
      try {
        const response = await fetch(`${BASE_7TV_EMOTE_API}/users/twitch/${twitchId}`, {
          signal: abortController.signal,
        });
        const data = await response.json();
        if (!abortController.signal.aborted && data && typeof data === 'object') {
          const d = data as { emote_set?: { emotes: SevenTVEmote[] } };
          setSeventvEmotes(d.emote_set?.emotes ?? []);
        }
      } catch {
        // ignore
      }
    };

    const load7TVGlobalEmotes = async () => {
      try {
        const response = await fetch(`${BASE_7TV_EMOTE_API}/emote-sets/global`, {
          signal: abortController.signal,
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await response.json();
        if (!abortController.signal.aborted && data && typeof data === 'object') {
          const d = data as { emotes: SevenTVEmote[] };
          setSeventvEmotes((prev) => [...prev, ...(d.emotes ?? [])]);
        }
      } catch {
        // ignore
      }
    };

    loadBTTVGlobalEmotes();
    loadBTTVChannelEmotes();
    loadFFZEmotes();
    load7TVEmotes();
    load7TVGlobalEmotes();

    return () => abortController.abort();
  }, [twitchId]);

  const loadVod = useCallback(async () => {
    const id = vodId.trim();
    if (!id) return;

    setIsLoading(true);
    setError(null);
    setM3u8Url('');
    setVodInfo(null);

    try {
      const vod = await getVod(id);
      const token = await getVodToken(id);
      const m3u8 = await fetchM3u8(id, token.value, token.signature);
      const chapters = await getChapters(id);
      const firstChapter = chapters.find((c) => c.node.details.game);
      const gameId = firstChapter?.node.details.game?.id;

      setVodInfo({ id: vod.id, title: vod.title, lengthSeconds: vod.lengthSeconds });
      setM3u8Url(m3u8);
      if (gameId) {
        setTwitchId(Number(gameId));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load VOD');
    } finally {
      setIsLoading(false);
    }
  }, [vodId]);

  const handleDuration = useCallback((dur: number) => {
    setDuration(dur);
  }, []);

  useEffect(() => {
    if (paramVodId) {
      setVodId(paramVodId);
      loadVod();
    }
  }, [paramVodId, loadVod]);

  return (
    <div className="flex h-full flex-col bg-background">
      {isLoading && !m3u8Url ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-sm text-text-hint">Loading VOD...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Player + Chat row */}
          <div className="flex flex-1 gap-0 min-h-0">
            {m3u8Url && vodInfo ? (
              <>
                <div className="flex min-w-0 flex-1 flex-col items-center justify-center bg-black">
                  <VodPlayer
                    vodId={vodInfo.id}
                    m3u8Url={m3u8Url}
                    ref={playerRef}
                    onTimeUpdate={() => {}}
                    onDuration={handleDuration}
                    streamType="on-demand"
                  />
                </div>
                <ChatReplay
                  vodId={vodInfo.id}
                  twitchId={twitchId}
                  playerRef={playerRef as React.RefObject<unknown>}
                  userChatDelay={0}
                  playerState={_playerState}
                />
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <div className="text-center">
                  <p className="text-lg font-medium text-text-secondary">Enter a VOD ID to get started</p>
                  <p className="mt-1 text-sm text-text-hint">Twitch VOD ID goes in the field above</p>
                </div>
              </div>
            )}
          </div>

          {/* Graph */}
          {m3u8Url && vodInfo && (
            <div className="border-t border-border p-3">
              <VodGraph
                vodId={vodInfo.id}
                playerRef={
                  playerRef as React.RefObject<{
                    seek: (t: number) => void;
                    play: () => void;
                    pause: () => void;
                  } | null>
                }
                emoteData={emoteData}
                duration={duration}
                messageThreshold={25}
                searchThreshold={10}
                searchTerm=""
              />
            </div>
          )}
        </>
      )}

      {error && (
        <div className="border-t border-red-900/50 bg-red-950/30 px-4 py-2">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}
