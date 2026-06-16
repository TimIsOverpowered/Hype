import { useCallback, useEffect, useState } from 'react';
import { findM3u8 } from '../api/twitch';

export interface M3u8Variant {
  uri: string;
  name: string;
}

export function useM3u8Variants(vodId: string | undefined): { variants: M3u8Variant[]; isLoading: boolean } {
  const [variants, setVariants] = useState<M3u8Variant[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const scanVariants = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const result = await findM3u8(id);
      setVariants(result.variants);
    } catch {
      setVariants([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!vodId) {
      setVariants([]);
      return;
    }
    scanVariants(vodId);
  }, [vodId, scanVariants]);

  return { variants, isLoading };
}
