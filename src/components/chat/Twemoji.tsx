import twemoji from '@twemoji/api';
import type { PropsWithChildren } from 'react';
import { useEffect, useRef } from 'react';

twemoji.base = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/';
twemoji.ext = '.svg';

const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;

interface TwemojiProps extends PropsWithChildren {
  options?: Record<string, unknown>;
}

export function Twemoji({ children, options = {} }: TwemojiProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (ref.current) {
      twemoji.parse(ref.current, {
        folder: 'svg',
        ext: '.svg',
        ...options,
      });
    }
  }, [options]);
  return (
    <span style={{ display: 'inline-block', verticalAlign: 'middle' }} ref={ref}>
      {children}
    </span>
  );
}

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
