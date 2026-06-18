import { SEVENTV_ZERO_WIDTH_FLAG } from '../constants/ui';
import type {
  BttvEmote,
  CommentNode,
  CustomEmoteFragment,
  EmojiFragment,
  FfzEmote,
  FormattedMessage,
  IncomingWorkerMessage,
  SevenTVEmote,
  TextFragment,
  TwitchEmoteFragment,
  UrlFragment,
  WorkerEmoteData,
} from '../types/twitch';

const URL_PATTERN = /^(https?:\/\/)?[\w.-]+\.[\w/.-]+$/i;
const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;

function buildEmoteLookup(
  bttv: readonly BttvEmote[],
  ffz: readonly FfzEmote[],
  seventv: readonly SevenTVEmote[],
): Map<string, { id: string | number; code: string; name: string; provider: string; flags?: number }> {
  const lookup = new Map<
    string,
    { id: string | number; code: string; name: string; provider: string; flags?: number }
  >();

  for (const emote of bttv) {
    lookup.set(emote.code, { id: emote.id, code: emote.code, name: emote.code, provider: 'BTTV' });
  }

  for (const emote of ffz) {
    const key = emote.code ?? emote.text;
    if (key) {
      const name = emote.name ?? key;
      lookup.set(key, { id: emote.id, code: key, name, provider: 'FFZ' });
    }
  }

  for (const emote of seventv) {
    const name = emote.name ?? emote.code;
    lookup.set(name, { id: emote.id, code: emote.code, name, provider: '7TV', flags: emote.flags });
  }

  return lookup;
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
  emoteLookup: Map<string, { id: string | number; code: string; name: string; provider: string; flags?: number }>,
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
      entry: { id: string | number; code: string; name: string; provider: string; flags?: number };
      index: number;
    } | null = null;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const emote = emoteLookup.get(word);

      if (emote) {
        const isZeroWidth = (emote.flags ?? 0) & SEVENTV_ZERO_WIDTH_FLAG;

        if (isZeroWidth && pendingNormalEmote) {
          const prevIndex = pendingNormalEmote.index;

          if (result[prevIndex]) {
            const combined = result[prevIndex] as CustomEmoteFragment;
            result[prevIndex] = {
              ...combined,
              isZeroWidth: true,
            };
          }

          pendingNormalEmote = null;
        } else if (isZeroWidth) {
          const zwFragment: CustomEmoteFragment = {
            type: 'custom',
            id: String(emote.id),
            code: emote.code,
            provider: emote.provider as '7TV' | 'BTTV' | 'FFZ',
            isZeroWidth: true,
          };
          result.push(zwFragment);
        } else {
          const normalFragment: CustomEmoteFragment = {
            type: 'custom',
            id: String(emote.id),
            code: emote.code,
            provider: emote.provider as '7TV' | 'BTTV' | 'FFZ',
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
  const emoteLookup = buildEmoteLookup(emoteData.bttv, emoteData.ffz, emoteData.seventv);

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
