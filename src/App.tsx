import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { useEffect, useState } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import DeepLinkHandler from './components/DeepLinkHandler';
import AppLayout from './components/layout/AppLayout';
import UpdateDialog from './components/ui/UpdateDialog';
import { DEFAULT_RETRY_COUNT, STALE_TIME_5MIN } from './constants/auth';
import { JobQueueProvider } from './contexts/JobQueueContext';
import ChannelPage from './pages/ChannelPage';
import HomePage from './pages/HomePage';
import LandingPage from './pages/LandingPage';
import VODPage from './pages/VODPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: STALE_TIME_5MIN, retry: DEFAULT_RETRY_COUNT },
  },
});

function App() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [currentVersion, setCurrentVersion] = useState('');

  useEffect(() => {
    invoke('show_window').catch(console.error);
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV) return;

    let cancelled = false;

    (async () => {
      const version = await getVersion();
      setCurrentVersion(version);

      const update = await check();
      if (cancelled || !update) return;
      setUpdate(update);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <JobQueueProvider>
          <DeepLinkHandler />
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<LandingPage />} />
              <Route path="home" element={<LandingPage />} />
              <Route path="browse" element={<HomePage />} />
              <Route path="channel/:channel" element={<ChannelPage />} />
              <Route path="vod/:vodId" element={<VODPage />} />
            </Route>
          </Routes>
        </JobQueueProvider>
      </HashRouter>
      <Toaster
        theme="dark"
        position="bottom-right"
        offset={80}
        gap={8}
        expand={false}
        visibleToasts={10}
        closeButton
        duration={2000}
      />
      {update && <UpdateDialog open update={update} currentVersion={currentVersion} onClose={() => setUpdate(null)} />}
    </QueryClientProvider>
  );
}

export default App;
