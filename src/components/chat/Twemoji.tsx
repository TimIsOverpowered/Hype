import type { PropsWithChildren } from 'react';

// Perfectly mimics the Rust backend to isolate Hex codepoints
export function toTwemojiId(emoji: string): string {
  const hexPoints: string[] = [];
  for (const char of emoji) {
    const p = char.codePointAt(0);
    // Ignore the Variation Selector-16 character (FE0F) just like Rust
    if (p === 0xfe0f) continue;
    if (p) hexPoints.push(p.toString(16));
  }
  return hexPoints.join('-');
}

const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;

export const emojiTest = (char: string): boolean => {
  emojiRegex.lastIndex = 0;
  return emojiRegex.test(char);
};

export const extractEmojis = (text: string): { text?: string; emoji?: string }[] => {
  const result: { text?: string; emoji?: string }[] = [];
  const codepoints = [...text];
  let i = 0;
  while (i < codepoints.length) {
    const char = codepoints[i];
    if (emojiTest(char)) {
      result.push({ emoji: char });
      i++;
    } else {
      let textPart = '';
      while (i < codepoints.length && !emojiTest(codepoints[i])) {
        textPart += codepoints[i];
        i++;
      }
      if (textPart) result.push({ text: textPart });
    }
  }
  return result;
};

export function Twemoji({ children }: PropsWithChildren) {
  if (typeof children !== 'string') return <>{children}</>;

  const id = toTwemojiId(children);
  // Force PNGs instead of SVGs to bypass browser Tracking Prevention
  const src = `https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/${id}.png`;

  return (
    <img
      src={src}
      alt={children}
      className="twemoji"
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        width: '28px',
        height: '28px',
        margin: '0 0.1rem',
      }}
      draggable={false}
      loading="lazy"
      crossOrigin="anonymous"
      referrerPolicy="no-referrer"
    />
  );
}
