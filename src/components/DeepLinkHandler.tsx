import { listen } from '@tauri-apps/api/event';
import { getCurrent, onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, useUser } from '../auth';

function parseDeepLink(url: string): { type: string; value: string } | null {
  console.log(`[DeepLink] Received URL: ${url}`);
  if (!url.startsWith('hype://')) {
    console.log(`[DeepLink] Not a hype:// URL, ignoring`);
    return null;
  }

  const path = url.slice('hype://'.length).split('?')[0].replace(/\/+$/, '');
  const query = url.startsWith('hype://') ? url.slice(url.indexOf('?') + 1) : '';
  console.log(`[DeepLink] Parsed path="${path}" query="${query}"`);

  if (path === 'oauth' && query) {
    const params = new URLSearchParams(query);
    const token = params.get('token') || params.get('code');
    console.log(`[DeepLink] OAuth path, token found: ${!!token}`);
    if (token) return { type: 'oauth', value: token };
  }

  const parts = path.split('/').filter(Boolean);
  console.log(`[DeepLink] Non-oauth path parts: [${parts}]`);

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
        console.log(`[DeepLink] Attempting login with token (first 20 chars): ${parsed.value.slice(0, 20)}...`);
        try {
          await login(parsed.value);
          console.log(
            `[DeepLink] login() succeeded, localStorage now has:`,
            localStorage.getItem('hype-auth')?.slice(0, 20),
          );
          await refetch();
          navigate('/settings/profile', { replace: true });
        } catch (e) {
          console.error(`[DeepLink] Login failed:`, e);
        }
      } else if (parsed.type === 'channel') {
        navigate(`/channel/${parsed.value}`, { replace: true });
      } else if (parsed.type === 'vod') {
        navigate(`/vod/${parsed.value}`, { replace: true });
      }
    };

    let cleanupListen: (() => void) | undefined;

    const init = async () => {
      console.log(`[DeepLink] Initializing handlers...`);
      try {
        const startUrls = await getCurrent();
        console.log(`[DeepLink] getCurrent() returned:`, startUrls);
        if (startUrls && startUrls.length > 0 && !handledRef.current) {
          handledRef.current = true;
          for (const url of startUrls) {
            await handleDeepLink(url);
          }
        }
      } catch (e) {
        console.log(`[DeepLink] getCurrent() failed:`, e);
      }

      try {
        const cleanupOnOpenUrl = await onOpenUrl((urls) => {
          console.log(`[DeepLink] onOpenUrl callback fired with:`, urls);
          for (const url of urls) {
            handleDeepLink(url);
          }
        });
        console.log(`[DeepLink] onOpenUrl listener registered`);

        const unlisten = await listen('protocol-uri', (event: { payload: string }) => {
          console.log(`[DeepLink] protocol-uri event fired with payload:`, event.payload);
          handleDeepLink(event.payload);
        });
        console.log(`[DeepLink] protocol-uri listener registered`);

        cleanupListen = () => {
          cleanupOnOpenUrl();
          unlisten();
        };
      } catch (e) {
        console.log(`[DeepLink] listener registration failed:`, e);
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
