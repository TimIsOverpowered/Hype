import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchM3u8, getChapters, getVod, getVodToken } from './api/twitch';
import ChatReplay from './components/chat/ChatReplay';
import VodGraph from './components/graph/VodGraph';
import VodPlayer, { type VodPlayerHandle } from './components/player/VodPlayer';
import type { WorkerEmoteData } from './types/graph';
import type { BttvEmote, FfzEmote, SevenTVEmote } from './types/twitch';

const BASE_BTTV_EMOTE_API = 'https://api.betterttv.net/3';
const BASE_FFZ_EMOTE_API = 'https://api.frankerfacez.com/v1';
const BASE_7TV_EMOTE_API = 'https://7tv.io/v3';

function App() {
  const [vodId, setVodId] = useState('');
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
        const data = await response.json();
        if (!abortController.signal.aborted && data && typeof data === 'object') {
          const d = data as { sets?: Record<string, { emoticons: FfzEmote[] }>; room?: { set?: number } };
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
    if (!vodId.trim()) return;

    setIsLoading(true);
    setError(null);
    setM3u8Url('');
    setVodInfo(null);

    try {
      const vod = await getVod(vodId.trim());

      const token = await getVodToken(vodId.trim());
      const m3u8 = await fetchM3u8(vodId.trim(), token.value, token.signature);

      const chapters = await getChapters(vodId.trim());
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

  return (
    <div className="flex h-screen w-screen flex-col bg-[#0e0e10] text-[#f0f0f5]">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[#222230] px-4 py-3">
        <input
          type="text"
          placeholder="Enter VOD ID..."
          value={vodId}
          onChange={(e) => setVodId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && loadVod()}
          className="flex-1 rounded border border-[#222230] bg-[#16161e] px-3 py-1.5 text-sm text-[#f0f0f5] placeholder-[#adadb8] outline-none focus:border-[#008080]"
        />
        <button
          type="button"
          onClick={loadVod}
          disabled={isLoading || !vodId.trim()}
          className="rounded bg-[#008080] px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#006666] disabled:opacity-50"
        >
          {isLoading ? 'Loading...' : 'Load'}
        </button>
      </div>

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
              <p className="text-lg font-medium text-[#adadb8]">Enter a VOD ID to get started</p>
              <p className="mt-1 text-sm text-[#6b6b7b]">Twitch VOD ID goes in the field above</p>
            </div>
          </div>
        )}
      </div>

      {/* Graph */}
      {m3u8Url && vodInfo && (
        <div className="border-t border-[#222230] p-3">
          <VodGraph
            vodId={vodInfo.id}
            playerRef={
              playerRef as React.RefObject<{ seek: (t: number) => void; play: () => void; pause: () => void } | null>
            }
            emoteData={emoteData}
            duration={duration}
            messageThreshold={25}
            searchThreshold={10}
            searchTerm=""
          />
        </div>
      )}

      {error && (
        <div className="border-t border-red-900/50 bg-red-950/30 px-4 py-2">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}

export default App;
