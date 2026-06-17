import { listen } from '@tauri-apps/api/event';
import { onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, useUser } from '../auth';

function parseDeepLink(url: string): { type: string; value: string } | null {
  if (!url.startsWith('hype://')) {
    return null;
  }

  const path = url.slice('hype://'.length).split('?')[0].replace(/\/+$/, '');
  const query = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';

  if (path === 'oauth' && query) {
    const params = new URLSearchParams(query);
    const token = params.get('token') || params.get('code');
    if (token) return { type: 'oauth', value: token };
  }

  const parts = path.split('/').filter(Boolean);
  if (parts.length >= 1) {
    const type = parts[0];
    const value = parts.slice(1).join('/');
    if (value) return { type, value };
  }

  return null;
}

function DeepLinkHandler() {
  const navigate = useNavigate();
  const { refetch } = useUser();
  const lastUrlRef = useRef<string | null>(null);
  const navigateRef = useRef(navigate);
  const refetchRef = useRef(refetch);

  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  useEffect(() => {
    refetchRef.current = refetch;
  }, [refetch]);

  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      if (lastUrlRef.current === url) return;
      lastUrlRef.current = url;

      const parsed = parseDeepLink(url);
      if (!parsed) return;

      if (parsed.type === 'oauth') {
        try {
          await login(parsed.value);
          await refetchRef.current();
          navigateRef.current('/', { replace: true });
        } catch (e) {
          // silent
        }
      } else if (parsed.type === 'channel') {
        navigateRef.current(`/channel/${parsed.value}`, { replace: true });
      } else if (parsed.type === 'vod') {
        navigateRef.current(`/vod/${parsed.value}`, { replace: true });
      }
    };

    let cleanupListen: (() => void) | undefined;

    const init = async () => {
      try {
        await onOpenUrl((urls) => {
          for (const url of urls) {
            handleDeepLink(url);
          }
        });

        const unlisten = await listen('protocol-uri', (event: { payload: string }) => {
          handleDeepLink(event.payload);
        });

        cleanupListen = () => {
          unlisten();
        };
      } catch (e) {
        // silent
      }
    };

    init();

    return () => {
      cleanupListen?.();
    };
  }, []);

  return null;
}

export default DeepLinkHandler;
