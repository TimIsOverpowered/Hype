import type { BttvEmote, FfzEmote, SevenTVEmote } from '../types/twitch';

export interface EmoteLookupEntry {
  readonly id: string | number;
  readonly code: string;
  readonly name: string;
  readonly provider: string;
  readonly flags?: number;
}

export function buildEmoteLookup(
  bttv: readonly BttvEmote[],
  ffz: readonly FfzEmote[],
  seventv: readonly SevenTVEmote[],
): Map<string, EmoteLookupEntry> {
  const lookup = new Map<string, EmoteLookupEntry>();

  for (const emote of bttv) {
    lookup.set(emote.code, { id: emote.id, code: emote.code, name: emote.code, provider: 'BTTV' });
  }

  for (const emote of ffz) {
    const code = emote.code || emote.text;
    const name = emote.name || code || String(emote.id);
    const key = code || name;
    lookup.set(key, { id: emote.id, code: key, name, provider: 'FFZ' });
  }

  for (const emote of seventv) {
    const name = emote.name ?? emote.code;
    lookup.set(name, { id: emote.id, code: emote.code, name, provider: '7TV', flags: emote.flags });
  }

  return lookup;
}
