import { getCurrent, onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, useUser } from '../auth';
import { DeepLinkProtocol } from '../constants/urls';

function parseDeepLink(url: string): { type: string; value: string } | null {
  if (!url.startsWith(DeepLinkProtocol)) {
    return null;
  }

  const path = url.slice(DeepLinkProtocol.length).split('?')[0].replace(/\/+$/, '');
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
  const queryClient = useQueryClient();
  const { refetch } = useUser();
  const refetchRef = useRef(refetch);
  const navigateRef = useRef(navigate);

  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  useEffect(() => {
    refetchRef.current = refetch;
  }, [refetch]);

  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      const parsed = parseDeepLink(url);
      if (!parsed) return;

      if (parsed.type === 'oauth') {
        try {
          await login(parsed.value);
          queryClient.invalidateQueries({ 
            predicate: (q) => 
              q.queryKey[0] === 'user' || 
              q.queryKey[0] === 'whitelisted-channels' || 
              q.queryKey[0] === 'search',
            refetchType: 'all'
          });
          navigateRef.current('/', { replace: true });
        } catch (e) {
          console.error('Deep link login failed:', e);
        }
      } else if (parsed.type === 'channel') {
        navigateRef.current(`/channel/${parsed.value}`, { replace: true });
      } else if (parsed.type === 'vod') {
        navigateRef.current(`/vod/${parsed.value}`, { replace: true });
      }
    };

    const init = async () => {
      // Check if app was launched via deep link (cold start)
      try {
        const startUrls = await getCurrent();
        if (startUrls) {
          for (const url of startUrls) {
            console.log('Processing launch deep link:', url);
            await handleDeepLink(url);
          }
        }
      } catch (e) {
        console.error('Failed to get current deep links:', e);
      }

      // Listen for deep links while app is running
      try {
        await onOpenUrl((urls) => {
          for (const url of urls) {
            handleDeepLink(url);
          }
        });
      } catch (e) {
        console.error('Failed to register deep link listener:', e);
      }
    };

    init();
  }, []);

  return null;
}

export default DeepLinkHandler;
