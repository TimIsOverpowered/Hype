import { listen } from '@tauri-apps/api/event';
import { getCurrent, onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, useUser } from '../auth';

function parseDeepLink(url: string): { type: string; value: string } | null {
  if (!url.startsWith('hype://')) return null;

  const path = url.slice('hype://'.length).split('?')[0];
  const query = url.startsWith('hype://') ? url.slice(url.indexOf('?') + 1) : '';

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
  const handledRef = useRef(false);

  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      const parsed = parseDeepLink(url);
      if (!parsed) return;

      if (parsed.type === 'oauth') {
        try {
          await login(parsed.value);
          await refetch();
          navigate('/settings/profile', { replace: true });
        } catch {
          // Auth failed, ignore
        }
      } else if (parsed.type === 'channel') {
        navigate(`/channel/${parsed.value}`, { replace: true });
      } else if (parsed.type === 'vod') {
        navigate(`/vod/${parsed.value}`, { replace: true });
      }
    };

    let cleanupListen: (() => void) | undefined;

    const init = async () => {
      try {
        const startUrls = await getCurrent();
        if (startUrls && startUrls.length > 0 && !handledRef.current) {
          handledRef.current = true;
          for (const url of startUrls) {
            await handleDeepLink(url);
          }
        }
      } catch {
        // deep-link plugin not available (e.g., web build)
      }

      try {
        cleanupListen = await onOpenUrl((urls) => {
          for (const url of urls) {
            handleDeepLink(url);
          }
        });
      } catch {
        // onOpenUrl not available
      }

      try {
        const unlisten = await listen('protocol-uri', (event: { payload: string }) => {
          handleDeepLink(event.payload);
        });
        cleanupListen = () => {
          unlisten();
          if (cleanupListen) cleanupListen();
        };
      } catch {
        // listen not available
      }
    };

    init();

    return () => {
      cleanupListen?.();
    };
  }, [navigate, refetch]);

  return null;
}

export default DeepLinkHandler;
