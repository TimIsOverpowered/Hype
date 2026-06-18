import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import DeepLinkHandler from './components/DeepLinkHandler';
import AppLayout from './components/layout/AppLayout';
import SettingsPage from './components/settings/SettingsPage';
import { DEFAULT_RETRY_COUNT, STALE_TIME_5MIN } from './constants/auth';
import ChannelPage from './pages/ChannelPage';
import HomePage from './pages/HomePage';
import VODPage from './pages/VODPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: STALE_TIME_5MIN, retry: DEFAULT_RETRY_COUNT },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <DeepLinkHandler />
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path="home" element={<HomePage />} />
            <Route path="channel/:channel" element={<ChannelPage />} />
            <Route path="vod/:vodId" element={<VODPage />} />
            <Route path="settings" element={<Navigate to="/settings/profile" replace />} />
            <Route path="settings/:subPath" element={<SettingsPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </QueryClientProvider>
  );
}

export default App;
