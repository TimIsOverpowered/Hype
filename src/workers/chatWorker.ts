import { SEVENTV_ZERO_WIDTH_FLAG } from '../constants/ui';
import type {
  CommentNode,
  CustomEmoteFragment,
  EmojiFragment,
  FormattedMessage,
  IncomingWorkerMessage,
  TextFragment,
  TwitchEmoteFragment,
  UrlFragment,
  WorkerEmoteData,
} from '../types/twitch';
import { buildEmoteLookup } from '../utils/emoteLookup';

const URL_PATTERN = /^(https?:\/\/)?[\w.-]+\.[\w/.-]+$/i;
const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;

let cachedBttvLength = 0;
let cachedFfzLength = 0;
let cachedSeventvLength = 0;
let cachedLookup: ReturnType<typeof buildEmoteLookup> | null = null;

function getEmoteLookup(emoteData: WorkerEmoteData): ReturnType<typeof buildEmoteLookup> {
  const { bttv, ffz, seventv } = emoteData;
  if (
    bttv.length === cachedBttvLength &&
    ffz.length === cachedFfzLength &&
    seventv.length === cachedSeventvLength &&
    cachedLookup
  ) {
    return cachedLookup;
  }
  cachedLookup = buildEmoteLookup(bttv, ffz, seventv);
  cachedBttvLength = bttv.length;
  cachedFfzLength = ffz.length;
  cachedSeventvLength = seventv.length;
  return cachedLookup;
}

function isEmoji(char: string): boolean {
  emojiRegex.lastIndex = 0;
  return emojiRegex.test(char);
}

function extractEmojis(text: string): Array<{ text?: string; emoji?: string }> {
  const result: Array<{ text?: string; emoji?: string }> = [];
  const codepoints = [...text];
  let i = 0;

  while (i < codepoints.length) {
    const char = codepoints[i];
    if (isEmoji(char)) {
      result.push({ emoji: char });
      i++;
    } else {
      let textPart = '';
      while (i < codepoints.length && !isEmoji(codepoints[i])) {
        textPart += codepoints[i];
        i++;
      }
      if (textPart) {
        result.push({ text: textPart });
      }
    }
  }

  return result;
}

function transformFragments(
  fragments: Array<{ text: string; emote: { emoteID: string } | null }>,
  emoteLookup: Map<
    string,
    {
      id: string | number;
      code: string;
      name: string;
      provider: string;
      flags?: number;
      width?: number;
      height?: number;
    }
  >,
): Array<TextFragment | TwitchEmoteFragment | CustomEmoteFragment | EmojiFragment | UrlFragment> {
  const result: Array<TextFragment | TwitchEmoteFragment | CustomEmoteFragment | EmojiFragment | UrlFragment> = [];

  for (const fragment of fragments) {
    if (fragment.emote) {
      result.push({
        type: 'twitch',
        emoteID: fragment.emote.emoteID,
        text: fragment.text,
      } as TwitchEmoteFragment);
      continue;
    }

    const words = fragment.text.split(' ');
    let pendingNormalEmote: {
      entry: {
        id: string | number;
        code: string;
        name: string;
        provider: string;
        flags?: number;
        width?: number;
        height?: number;
      };
      index: number;
    } | null = null;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const emote = emoteLookup.get(word);

      if (emote) {
        const isZeroWidth = (emote.flags ?? 0) & SEVENTV_ZERO_WIDTH_FLAG;

        if (isZeroWidth && pendingNormalEmote) {
          pendingNormalEmote = null;
        }

        if (isZeroWidth) {
          const zwFragment: CustomEmoteFragment = {
            type: 'custom',
            id: String(emote.id),
            code: emote.code,
            name: emote.name,
            provider: emote.provider as '7TV' | 'BTTV' | 'FFZ',
            isZeroWidth: true,
            width: emote.width,
            height: emote.height,
          };
          result.push(zwFragment);
        } else {
          const normalFragment: CustomEmoteFragment = {
            type: 'custom',
            id: String(emote.id),
            code: emote.code,
            name: emote.name,
            provider: emote.provider as '7TV' | 'BTTV' | 'FFZ',
            width: emote.width,
            height: emote.height,
          };
          pendingNormalEmote = { entry: emote, index: result.length };
          result.push(normalFragment);
        }
      } else {
        pendingNormalEmote = null;

        if (URL_PATTERN.test(word)) {
          result.push({ type: 'url', text: word } as UrlFragment);
        } else if (isEmoji(word)) {
          const parts = extractEmojis(word);
          for (const part of parts) {
            if (part.text) {
              result.push({ type: 'text', text: part.text });
            } else if (part.emoji) {
              result.push({ type: 'emoji', text: part.emoji });
            }
          }
        } else {
          result.push({ type: 'text', text: word });
        }
      }

      if (i < words.length - 1) {
        result.push({ type: 'text', text: ' ' });
      }
    }
  }

  return result;
}

function processComments(
  timestamp: number,
  rawComments: readonly CommentNode[],
  filterWords: readonly string[],
  emoteData: WorkerEmoteData,
): FormattedMessage[] {
  const emoteLookup = getEmoteLookup(emoteData);

  let filterRegex: RegExp | null = null;
  if (filterWords.length > 0) {
    const escaped = filterWords.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    filterRegex = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');
  }

  const visibleMessages: FormattedMessage[] = [];
  const seenIds = new Set<string>();

  for (const comment of rawComments) {
    if (!comment || comment.contentOffsetSeconds > timestamp) break;
    if (!comment.commenter || !comment.message) continue;

    const messageId = comment.id;
    if (seenIds.has(messageId)) continue;
    seenIds.add(messageId);

    if (filterRegex) {
      const messageText = comment.message.fragments.map((f) => f.text).join(' ');
      filterRegex.lastIndex = 0;
      if (filterRegex.test(messageText)) continue;
    }

    const fragments = transformFragments(comment.message.fragments, emoteLookup);

    visibleMessages.push({
      id: messageId,
      displayName: comment.commenter.displayName,
      userColor: comment.message.userColor,
      contentOffsetSeconds: comment.contentOffsetSeconds,
      badges: comment.message.userBadges,
      fragments,
    });
  }

  return visibleMessages;
}

self.onmessage = (e: MessageEvent<IncomingWorkerMessage>) => {
  const msg = e.data;

  if (msg.type === 'process') {
    const { timestamp, rawComments, filterWords, emotes } = msg.payload;
    const messages = processComments(timestamp, rawComments, filterWords, emotes);
    self.postMessage({ type: 'result', payload: { messages } });
  }
};
