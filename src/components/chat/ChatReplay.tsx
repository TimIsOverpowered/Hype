import { ChevronLeft, ChevronRight, Pause, Settings } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { getBadges, getComments } from '../../api/twitch';
import { BTTV_CDN_BASE, FFZ_CDN_BASE, SEVENTV_CDN_BASE, TWITCH_CDN_BASE } from '../../constants/emotes';
import {
  CHAT_BOTTOM_THRESHOLD,
  CHAT_FETCH_RETRIES,
  CHAT_INTERSECTION_MARGIN,
  CHAT_LOOP_INTERVAL_MS,
  CHAT_MAX_MESSAGES,
  CHAT_MAX_MESSAGES_AT_BOTTOM,
  CHAT_RETRY_DELAY_MS,
  CHAT_SCROLL_UP_THRESHOLD,
  CHAT_SKELETON_COUNT,
  CHAT_STATE_CHANGE_DELAY_MS,
  DEFAULT_CHAT_FONT_FAMILY,
  DEFAULT_CHAT_FONT_SIZE,
  DEFAULT_CHAT_WIDTH,
  DEFAULT_CHAT_WIDTH_MAX,
  DEFAULT_CHAT_WIDTH_MIN,
  LUMINANCE_B,
  LUMINANCE_G,
  LUMINANCE_R,
  MIN_USERNAME_LUMINANCE,
} from '../../constants/ui';
import type {
  ChatBadge,
  CommentNode,
  CustomEmoteFragment,
  EmojiFragment,
  FormattedFragment,
  FormattedMessage,
  IncomingWorkerMessage,
  OutgoingWorkerMessage,
  TextFragment,
  TwitchBadge,
  TwitchEmoteFragment,
  UrlFragment,
  WorkerEmoteData,
} from '../../types/twitch';
import { toHHMMSS } from '../../utils/time';
import MessageTooltip from './MessageTooltip';
import { Twemoji } from './Twemoji';

// ─── Types ─────────────────────────────────────────────────────────────────

interface ChatReplayProps {
  readonly vodId: string;
  readonly broadcasterId?: string;
  readonly playerRef: React.RefObject<unknown>;
  readonly userChatDelay: number;
  readonly playerState: number;
  readonly chatWidth?: number;
  readonly setChatWidth?: (w: number) => void;
  readonly showChat?: boolean;
  readonly setShowChat?: (v: boolean) => void;
  readonly emoteData?: WorkerEmoteData;
}

interface BadgeRef {
  readonly platform: 'twitch';
  readonly channelBadges: readonly TwitchBadge[] | null;
  readonly globalBadges: readonly TwitchBadge[] | null;
}

interface ChatEngineState {
  readonly messages: FormattedMessage[];
  readonly scrolling: boolean;
  readonly isLoading: boolean;
  readonly commentsCount: number;
  readonly chatRef: React.RefObject<HTMLDivElement | null>;
  readonly bottomAnchorRef: React.RefObject<HTMLDivElement | null>;
  readonly handleScroll: () => void;
  readonly scrollToBottom: () => void;
}

// ─── Username color adjustment ─────────────────────────────────────────────

function adjustUsernameColor(hex: string): string {
  if (!hex) return '#8a2be2';

  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);

  const luminance = LUMINANCE_R * r + LUMINANCE_G * g + LUMINANCE_B * b;

  if (luminance < MIN_USERNAME_LUMINANCE) {
    const mix = (90 - luminance) / 90;
    r = Math.round(r + (255 - r) * mix);
    g = Math.round(g + (255 - g) * mix);
    b = Math.round(b + (255 - b) * mix);
  }

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// ─── Fragment rendering helpers ────────────────────────────────────────────

function renderFragment(fragment: FormattedFragment, _keyPrefix: string, index: number): React.ReactNode {
  const key = `frag-${index}`;

  switch (fragment.type) {
    case 'text': {
      const f = fragment as TextFragment;
      return <span key={key}>{f.text}</span>;
    }

    case 'twitch': {
      const f = fragment as TwitchEmoteFragment;
      const src = `${TWITCH_CDN_BASE}/emoticons/v2/${f.emoteID}/default/dark/1.0`;
      const srcSet = `${TWITCH_CDN_BASE}/emoticons/v2/${f.emoteID}/default/dark/1.0 1x, ${TWITCH_CDN_BASE}/emoticons/v2/${f.emoteID}/default/dark/2.0 2x, ${TWITCH_CDN_BASE}/emoticons/v2/${f.emoteID}/default/dark/3.0 4x`;
      return (
        <MessageTooltip
          key={key}
          title={
            <div className="flex w-fit flex-col items-center">
              <img
                className="mb-[0.3rem] w-auto border-none align-top"
                src={`${TWITCH_CDN_BASE}/emoticons/v2/${f.emoteID}/default/dark/2.0`}
                alt=""
              />
              <p className="block text-xs">{`Emote: ${f.text}`}</p>
              <p className="block text-xs">Twitch Emotes</p>
            </div>
          }
        >
          <span style={{ display: 'inline-block', verticalAlign: 'middle' }}>
            <img
              src={src}
              srcSet={srcSet}
              alt=""
              style={{
                verticalAlign: 'middle',
                border: 'none',
                maxWidth: '100%',
                height: 'auto',
                minWidth: '28px',
                maxHeight: '32px',
              }}
            />{' '}
          </span>
        </MessageTooltip>
      );
    }

    case 'custom': {
      const f = fragment as CustomEmoteFragment;
      const isZeroWidth = f.isZeroWidth;
      const provider = f.provider;

      let src: string;
      let srcSet: string;
      let tooltipSrc: string;
      if (provider === '7TV') {
        src = `${SEVENTV_CDN_BASE}/${f.id}/1x.webp`;
        srcSet = `${SEVENTV_CDN_BASE}/${f.id}/1x.webp 1x, ${SEVENTV_CDN_BASE}/${f.id}/2x.webp 2x, ${SEVENTV_CDN_BASE}/${f.id}/3x.webp 3x, ${SEVENTV_CDN_BASE}/${f.id}/4x.webp 4x`;
        tooltipSrc = `${SEVENTV_CDN_BASE}/${f.id}/2x.webp`;
      } else if (provider === 'BTTV') {
        src = `${BTTV_CDN_BASE}/${f.id}/1x`;
        srcSet = `${BTTV_CDN_BASE}/${f.id}/1x 1x, ${BTTV_CDN_BASE}/${f.id}/2x 2x, ${BTTV_CDN_BASE}/${f.id}/3x 3x`;
        tooltipSrc = `${BTTV_CDN_BASE}/${f.id}/2x`;
      } else {
        src = `${FFZ_CDN_BASE}/${f.id}/1`;
        srcSet = `${FFZ_CDN_BASE}/${f.id}/1 1x, ${FFZ_CDN_BASE}/${f.id}/2 2x, ${FFZ_CDN_BASE}/${f.id}/4 4x`;
        tooltipSrc = `${FFZ_CDN_BASE}/${f.id}/2`;
      }

      const imgStyle: React.CSSProperties = {
        verticalAlign: 'middle',
        border: 'none',
        maxWidth: '100%',
        height: 'auto',
        minWidth: isZeroWidth ? '0px' : '28px',
        maxHeight: '32px',
      };

      if (isZeroWidth) {
        imgStyle.pointerEvents = 'none';
        imgStyle.position = 'absolute' as const;
        imgStyle.top = '50%';
        imgStyle.left = '50%';
        imgStyle.transform = 'translate(-50%, -50%)';
      }

      return (
        <MessageTooltip
          key={key}
          title={
            <div className="flex w-fit flex-col items-center">
              <img className="mb-[0.3rem] w-auto border-none align-top" src={tooltipSrc} alt={f.code} />
              <p className="block text-xs">{`Emote: ${f.code}`}</p>
              <p className="block text-xs">{`${provider} Emotes`}</p>
            </div>
          }
        >
          <span
            style={{
              display: 'inline-block',
              verticalAlign: 'middle',
              position: isZeroWidth ? ('relative' as const) : undefined,
            }}
          >
            <img src={src} srcSet={srcSet} alt="" style={imgStyle} />{' '}
          </span>
        </MessageTooltip>
      );
    }

    case 'emoji': {
      const f = fragment as EmojiFragment;
      return (
        <MessageTooltip
          key={key}
          title={
            <div className="flex w-fit flex-col items-center">
              <Twemoji options={{ className: 'twemoji' }}>{f.text}</Twemoji>
              <p className="block text-xs">Twitter Emotes</p>
            </div>
          }
        >
          <span style={{ display: 'inline-block', verticalAlign: 'middle' }}>
            <Twemoji options={{ className: 'twemoji' }}>{f.text}</Twemoji>
          </span>
        </MessageTooltip>
      );
    }

    case 'url': {
      const f = fragment as UrlFragment;
      const href = f.text.startsWith('http') ? f.text : `https://${f.text}`;
      return (
        <a key={key} href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
          {f.text}
        </a>
      );
    }

    default:
      return null;
  }
}

// ─── Badge rendering ───────────────────────────────────────────────────────

function renderBadges(
  textBadges: readonly ChatBadge[] | null,
  badgeData: BadgeRef | null,
  keyPrefix: string,
): React.ReactNode {
  if (!textBadges || !badgeData) return null;

  const { channelBadges, globalBadges } = badgeData;
  const wrapper: React.ReactNode[] = [];
  let badgeIdx = 0;

  for (const textBadge of textBadges) {
    const badgeId = textBadge.setID;
    const version = textBadge.version;

    const allBadges = [...(channelBadges ?? []), ...(globalBadges ?? [])];
    const badge = allBadges.find((b) => b.setID === badgeId && b.version === version);
    if (!badge) continue;

    wrapper.push(
      <img
        key={`${keyPrefix}-badge-${badgeId}-${version}-${badgeIdx}`}
        srcSet={`${badge.image1x} 1x, ${badge.image2x} 2x, ${badge.image4x} 4x`}
        src={badge.image1x}
        alt={`${badgeId} ${version}`}
        style={{
          display: 'inline-block',
          height: '1rem',
          minWidth: '1rem',
          margin: '0 0.2rem 0.1rem 0',
          backgroundPosition: '50%',
          verticalAlign: 'middle',
        }}
      />,
    );

    badgeIdx++;
  }

  if (wrapper.length === 0) return null;
  return <span style={{ display: 'inline' }}>{wrapper}</span>;
}

// ─── MemoizedComment ───────────────────────────────────────────────────────

interface MemoizedCommentProps {
  readonly message: FormattedMessage;
  readonly showTimestamp: boolean;
  readonly badgeData: BadgeRef | null;
  readonly fontFamily: string;
  readonly messageFontSize: number;
}

const MemoizedComment = memo(
  function MemoizedComment({ message, showTimestamp, badgeData, fontFamily, messageFontSize }: MemoizedCommentProps) {
    const adjustedColor = adjustUsernameColor(message.userColor);
    const keyPrefix = `msg-${message.id}`;

    return (
      <div
        className="chat-message-highlight flex w-full shrink-0 items-baseline px-2 py-1 transition-colors hover:bg-white/5"
        style={{ '--highlight-color': adjustedColor } as React.CSSProperties}
      >
        {showTimestamp && (
          <div
            className="mr-2 min-w-0 shrink-0 text-text-secondary"
            style={{ fontSize: `${Math.round(messageFontSize * 0.857)}px` }}
          >
            {toHHMMSS(message.contentOffsetSeconds)}
          </div>
        )}
        <div
          className="min-w-0 flex-1 leading-6 break-words text-text-primary"
          style={{ fontFamily, fontSize: `${messageFontSize}px` }}
        >
          {renderBadges(message.badges, badgeData, keyPrefix)}
          <span className="font-bold" style={{ color: adjustedColor }}>
            {message.displayName}
          </span>
          <span>: </span>
          <span style={{ display: 'inline' }}>
            {message.fragments.map((frag, i) => renderFragment(frag, keyPrefix, i))}
          </span>
        </div>
      </div>
    );
  },
  (prev, next) => {
    return (
      prev.message.id === next.message.id &&
      prev.showTimestamp === next.showTimestamp &&
      prev.fontFamily === next.fontFamily &&
      prev.messageFontSize === next.messageFontSize
    );
  },
);

// ─── Skeleton loader ───────────────────────────────────────────────────────

function ChatSkeleton(): React.ReactNode {
  const items = Array.from({ length: CHAT_SKELETON_COUNT }, (_, idx) => idx);
  return (
    <div className="flex flex-col gap-2 p-2">
      {items.map((idx) => (
        <div key={`skeleton-${String(idx)}`} className="flex items-center gap-2">
          <div className="h-3 w-12 rounded bg-white/5 animate-pulse" />
          <div className="h-3 w-16 rounded bg-white/10 animate-pulse" />
          <div className="h-3 w-px rounded bg-white/5 animate-pulse" />
          <div className="h-3 flex-1 rounded bg-white/5 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

// ─── ChatEngine hook ───────────────────────────────────────────────────────

function useChatEngine({
  vodId,
  playerRef,
  userChatDelay,
  playerState,
  emoteData,
  filterWords,
}: {
  readonly vodId: string;
  readonly playerRef: React.RefObject<unknown>;
  readonly userChatDelay: number;
  readonly playerState: number;
  readonly emoteData: WorkerEmoteData;
  readonly filterWords: readonly string[];
}): ChatEngineState {
  const [messages, setMessages] = useState<FormattedMessage[]>([]);
  const [scrolling, setScrolling] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [commentsCount, setCommentsCount] = useState(0);

  const commentsRef = useRef<CommentNode[]>([]);
  const cursorRef = useRef<string | null>(null);
  const loopRef = useRef<number | null>(null);
  const loopCbRef = useRef<(() => void) | undefined>(undefined);
  const playRef = useRef<number | null>(null);
  const chatRef = useRef<HTMLDivElement | null>(null);
  const stoppedAtIndexRef = useRef(0);
  const newMessagesRef = useRef<CommentNode[]>([]);
  const paginationAbortRef = useRef<AbortController | null>(null);
  const isFetchingNextRef = useRef(false);
  const lastFetchedCursorRef = useRef<string | null>(null);
  const isAutoScrollingRef = useRef(false);
  const isAtBottomRef = useRef(true);
  const lastScrollTopRef = useRef(0);
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);
  const scrollRAFRef = useRef<number | null>(null);
  const scrollingRef = useRef(scrolling);
  const hasFetchedRef = useRef(false);
  const workerRef = useRef<Worker | null>(null);

  // Worker setup
  useEffect(() => {
    let worker: Worker | null = null;
    try {
      worker = new Worker(new URL('../../workers/chatWorker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;

      worker.onmessage = (e: MessageEvent<OutgoingWorkerMessage>) => {
        if (e.data.type === 'result') {
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const unique = e.data.payload.messages.filter((m) => !existingIds.has(m.id));
            if (unique.length === 0) return prev;
            const merged = [...prev, ...unique];
            const maxLimit = isAtBottomRef.current ? CHAT_MAX_MESSAGES_AT_BOTTOM : CHAT_MAX_MESSAGES;
            if (merged.length > maxLimit) {
              merged.splice(0, merged.length - maxLimit);
            }
            return merged;
          });
        }
      };
    } catch {
      // Worker failed to load
    }

    return () => {
      if (worker) {
        worker.terminate();
      }
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    scrollingRef.current = scrolling;
  }, [scrolling]);

  const fetchWithRetry = useCallback(
    async <T,>(fetchFn: () => Promise<T>, retries = 3, delayMs = 1000): Promise<T | null> => {
      for (let i = 0; i < retries; i++) {
        try {
          return await fetchFn();
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') throw e;
          if (i === retries - 1) {
            console.error('Chat fetch failed after retries:', e);
            return null;
          }
          await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
        }
      }
      return null;
    },
    [],
  );

  const fetchNextComments = useCallback(() => {
    if (isFetchingNextRef.current) return;
    if (cursorRef.current === lastFetchedCursorRef.current) return;

    isFetchingNextRef.current = true;

    if (paginationAbortRef.current) {
      paginationAbortRef.current.abort();
    }
    paginationAbortRef.current = new AbortController();
    lastFetchedCursorRef.current = cursorRef.current;

    fetchWithRetry(
      () => getComments(vodId, parseFloat(cursorRef.current ?? '0')),
      CHAT_FETCH_RETRIES,
      CHAT_RETRY_DELAY_MS,
    )
      .then((res) => {
        if (!res) return;
        stoppedAtIndexRef.current = 0;
        commentsRef.current = res.edges.map((e) => e.node);
        cursorRef.current = res.edges[res.edges.length - 1]?.cursor ?? null;
      })
      .catch(() => {
        // handled
      })
      .finally(() => {
        isFetchingNextRef.current = false;
      });
  }, [vodId, fetchWithRetry]);

  const getCurrentTime = useCallback(() => {
    const current = playerRef.current;
    if (!current) return 0;
    let time = 0;
    if (typeof current === 'object' && current !== null && 'currentTime' in current) {
      time += (current as { currentTime: number }).currentTime;
    }
    time += userChatDelay;
    return time;
  }, [playerRef, userChatDelay]);

  const isPlaying = useCallback(() => {
    return playerState === 1;
  }, [playerState]);

  const buildComments = useCallback(() => {
    if (
      !playerRef.current ||
      commentsRef.current.length === 0 ||
      !cursorRef.current ||
      stoppedAtIndexRef.current === null
    )
      return;
    if (!isPlaying()) return;

    const worker = workerRef.current;
    if (!worker) return;

    const time = getCurrentTime();

    if (
      stoppedAtIndexRef.current > 0 &&
      commentsRef.current[stoppedAtIndexRef.current - 1] &&
      commentsRef.current[stoppedAtIndexRef.current - 1].contentOffsetSeconds > time
    ) {
      setMessages([]);
      stoppedAtIndexRef.current = 0;
    }

    let lastIndex = commentsRef.current.length;
    for (let i = stoppedAtIndexRef.current; i < commentsRef.current.length; i++) {
      if (commentsRef.current[i].contentOffsetSeconds > time) {
        lastIndex = i;
        break;
      }
    }

    if (stoppedAtIndexRef.current === lastIndex && stoppedAtIndexRef.current !== 0) return;

    const rawSlice = commentsRef.current.slice(stoppedAtIndexRef.current, lastIndex);
    if (rawSlice.length === 0) return;

    const payload: IncomingWorkerMessage = {
      type: 'process',
      payload: {
        timestamp: time,
        rawComments: rawSlice,
        filterWords: filterWords,
        emotes: emoteData,
      },
    };

    newMessagesRef.current = rawSlice;
    stoppedAtIndexRef.current = lastIndex;

    worker.postMessage(payload);

    if (commentsRef.current.length === lastIndex && !isFetchingNextRef.current) {
      fetchNextComments();
    }
  }, [playerRef, isPlaying, getCurrentTime, filterWords, emoteData, fetchNextComments]);

  const scrollToBottom = useCallback(() => {
    if (!chatRef.current) return;

    setScrolling(false);
    scrollingRef.current = false;
    isAtBottomRef.current = true;
    isAutoScrollingRef.current = true;

    const scrollToBottomSmooth = () => {
      if (scrollingRef.current || !isAtBottomRef.current) {
        isAutoScrollingRef.current = false;
        return;
      }
      if (chatRef.current) {
        chatRef.current.scrollTop = chatRef.current.scrollHeight;
        setTimeout(() => {
          isAutoScrollingRef.current = false;
        }, 150);
      }
    };

    scrollToBottomSmooth();
  }, []);

  const handleScroll = useCallback(() => {
    if (!chatRef.current) return;
    if (isAutoScrollingRef.current) return;

    if (scrollRAFRef.current) cancelAnimationFrame(scrollRAFRef.current);

    scrollRAFRef.current = requestAnimationFrame(() => {
      if (!chatRef.current) return;

      const { scrollTop, scrollHeight, clientHeight } = chatRef.current;
      const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
      const atBottom = distanceFromBottom <= CHAT_BOTTOM_THRESHOLD;

      if (atBottom) {
        isAtBottomRef.current = true;
        setScrolling(false);
        scrollingRef.current = false;
      } else {
        if (scrollTop < lastScrollTopRef.current - CHAT_SCROLL_UP_THRESHOLD) {
          isAtBottomRef.current = false;
          setScrolling(true);
          scrollingRef.current = true;
        }
      }

      lastScrollTopRef.current = scrollTop;
    });
  }, []);

  const startLoop = useCallback(() => {
    if (loopRef.current !== null) clearInterval(loopRef.current);
    buildComments();
    loopRef.current = window.setInterval(buildComments, CHAT_LOOP_INTERVAL_MS);
    return () => {
      if (loopRef.current !== null) {
        clearInterval(loopRef.current);
        loopRef.current = null;
      }
    };
  }, [buildComments]);

  const stopLoop = useCallback(() => {
    if (loopRef.current !== null) clearInterval(loopRef.current);
  }, []);

  const fetchComments = useCallback(
    async (offset: number = 0) => {
      try {
        setIsLoading(true);
        const res = await fetchWithRetry(() => getComments(vodId, offset), CHAT_FETCH_RETRIES, CHAT_RETRY_DELAY_MS);

        if (!res) {
          setIsLoading(false);
          return;
        }

        commentsRef.current = res.edges.map((e) => e.node);
        cursorRef.current = res.edges[res.edges.length - 1]?.cursor ?? null;
        setCommentsCount(res.edges.length);
        hasFetchedRef.current = true;
        setIsLoading(false);
      } catch {
        setIsLoading(false);
      }
    },
    [vodId, fetchWithRetry],
  );

  useEffect(() => {
    loopCbRef.current = startLoop;
  }, [startLoop]);

  useEffect(() => {
    if (scrolling || !isAtBottomRef.current || messages.length === 0) return;
    scrollToBottom();
  }, [messages, scrolling, scrollToBottom]);

  useEffect(() => {
    if (!chatRef.current) return;

    const innerContent = chatRef.current.firstElementChild;
    if (!innerContent) return;

    const resizeObserver = new ResizeObserver(() => {
      if (isAtBottomRef.current && !scrollingRef.current && chatRef.current) {
        chatRef.current.scrollTop = chatRef.current.scrollHeight;
        lastScrollTopRef.current = chatRef.current.scrollTop;
      }
    });

    resizeObserver.observe(innerContent);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const anchor = bottomAnchorRef.current;
    if (!anchor || !chatRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isAutoScrollingRef.current) {
          isAtBottomRef.current = true;
          setScrolling(false);
          scrollingRef.current = false;
        }
      },
      {
        root: chatRef.current,
        rootMargin: CHAT_INTERSECTION_MARGIN,
        threshold: 0,
      },
    );

    observer.observe(anchor);

    return () => {
      observer.disconnect();
      if (scrollRAFRef.current) cancelAnimationFrame(scrollRAFRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (paginationAbortRef.current) paginationAbortRef.current.abort();
    };
  }, []);

  useEffect(() => {
    const abortController = new AbortController();
    if (playRef.current) clearTimeout(playRef.current);
    if (playerState === -1 || !playerRef.current) return;

    const handlePlayerStateChange = () => {
      if (playerState === 1) {
        const time = getCurrentTime();
        if (
          commentsRef.current.length === 0 ||
          time < commentsRef.current[0].contentOffsetSeconds ||
          time > commentsRef.current[commentsRef.current.length - 1].contentOffsetSeconds
        ) {
          playRef.current = window.setTimeout(async () => {
            stopLoop();
            stoppedAtIndexRef.current = 0;
            commentsRef.current = [];
            cursorRef.current = null;
            setMessages([]);
            setCommentsCount(0);
            hasFetchedRef.current = false;
            setIsLoading(true);
            await fetchComments(time);
            loopCbRef.current?.();
          }, CHAT_STATE_CHANGE_DELAY_MS);
        } else {
          loopCbRef.current?.();
        }
      } else {
        stopLoop();
      }
    };

    handlePlayerStateChange();

    return () => {
      abortController.abort();
      stopLoop();
      if (playRef.current) clearTimeout(playRef.current);
    };
  }, [playerRef, playerState, getCurrentTime, stopLoop, fetchComments]); // eslint-disable-next-line exhaustive-deps

  return {
    messages,
    scrolling,
    isLoading,
    commentsCount,
    chatRef,
    bottomAnchorRef,
    handleScroll,
    scrollToBottom,
  };
}

// ─── ChatReplay ────────────────────────────────────────────────────────────

export default function ChatReplay({
  vodId,
  playerRef,
  userChatDelay,
  playerState,
  chatWidth = DEFAULT_CHAT_WIDTH,
  setChatWidth,
  showChat: showChatProp,
  setShowChat: setShowChatProp,
  emoteData,
}: ChatReplayProps) {
  const [showChatInternal, setShowChatInternal] = useState(true);
  const showChat = showChatProp ?? showChatInternal;
  const setShowChat = setShowChatProp ?? setShowChatInternal;
  const [showSettings, setShowSettings] = useState(false);

  const [filterWords] = useState<string[]>([]);

  const [showTimestamp, setShowTimestamp] = useState(false);
  const [fontFamily] = useState(DEFAULT_CHAT_FONT_FAMILY);
  const [messageFontSize] = useState(DEFAULT_CHAT_FONT_SIZE);

  const badgesRef = useRef<BadgeRef | null>(null);

  const { messages, scrolling, isLoading, commentsCount, chatRef, bottomAnchorRef, handleScroll, scrollToBottom } =
    useChatEngine({
      vodId,
      playerRef,
      userChatDelay,
      playerState,
      emoteData: emoteData ?? { bttv: [], ffz: [], seventv: [] },
      filterWords,
    });

  // Fetch badges
  useEffect(() => {
    const abortController = new AbortController();

    const loadBadges = async () => {
      try {
        const badgeData = await getBadges(vodId);
        if (!abortController.signal.aborted) {
          badgesRef.current = {
            platform: 'twitch',
            channelBadges: badgeData.channelBadges,
            globalBadges: badgeData.globalBadges,
          };
        }
      } catch {
        if (!abortController.signal.aborted) {
          badgesRef.current = {
            platform: 'twitch',
            channelBadges: null,
            globalBadges: null,
          };
        }
      }
    };

    loadBadges();

    return () => abortController.abort();
  }, [vodId]);

  const commentElements = messages.map((msg) => (
    <MemoizedComment
      key={msg.id}
      message={msg}
      showTimestamp={showTimestamp}
      badgeData={badgesRef.current}
      fontFamily={fontFamily}
      messageFontSize={messageFontSize}
    />
  ));

  return (
    <div
      className="absolute right-0 top-0 h-full relative flex min-h-0 flex-col bg-surface"
      style={{ width: showChat ? `${chatWidth}px` : '0px' }}
    >
      {showChat && (
        <>
          {/* Header */}
          <div className="flex flex-nowrap items-center justify-between px-3 py-2">
            <button
              type="button"
              onClick={() => setShowChat(!showChat)}
              className="text-text-secondary transition-colors hover:text-text-primary"
              title="Collapse"
            >
              {showChat ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
            </button>
            <span className="flex-1 text-center text-sm font-medium text-text-primary">Chat Replay</span>
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className="text-text-secondary transition-colors hover:text-text-primary"
              title="Settings"
            >
              <Settings size={20} />
            </button>
          </div>

          <hr className="border-t border-border" />

          {/* Messages */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {commentsCount === 0 ? (
              isLoading ? (
                <ChatSkeleton />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center">
                  <p className="text-sm text-text-muted">No messages</p>
                </div>
              )
            ) : (
              <>
                <div
                  ref={chatRef}
                  onScroll={handleScroll}
                  className="chat-scrollbar flex min-h-0 w-full flex-1 flex-col overflow-y-auto"
                  style={{ overflowAnchor: 'none' }}
                >
                  <div className="min-h-0 flex-1"></div>

                  <div className="flex shrink-0 flex-col py-2">
                    {commentElements}
                    <div ref={bottomAnchorRef} className="pointer-events-none h-[1px] w-full shrink-0 opacity-0" />
                  </div>
                </div>

                {scrolling && (
                  <div className="relative flex justify-center">
                    <button
                      type="button"
                      onClick={scrollToBottom}
                      className="absolute bottom-1 z-10 flex cursor-pointer items-center gap-1.5 rounded-full bg-surface-elevated px-4 py-2 text-xs text-text-muted shadow-md transition-all hover:bg-surface-elevated hover:text-text-primary"
                    >
                      <Pause size={18} />
                      <span>Chat Paused</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* Settings panel */}
      {showSettings && (
        <div
          className="absolute inset-0 z-40 flex cursor-pointer items-center justify-center bg-black/50"
          onClick={() => setShowSettings(false)}
        >
          <div
            className="w-72 rounded-lg border border-border bg-surface p-4 text-text-primary"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-medium">Chat Settings</h3>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="text-text-secondary transition-colors hover:text-text-primary"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <title>Close settings</title>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showTimestamp}
                  onChange={() => setShowTimestamp(!showTimestamp)}
                  className="accent-primary"
                />
                Show timestamps
              </label>

              {setChatWidth && (
                <div>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span>Width</span>
                    <span className="text-text-secondary">{chatWidth}px</span>
                  </div>
                  <input
                    type="range"
                    min={DEFAULT_CHAT_WIDTH_MIN}
                    max={DEFAULT_CHAT_WIDTH_MAX}
                    value={chatWidth}
                    onChange={(e) => setChatWidth(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
