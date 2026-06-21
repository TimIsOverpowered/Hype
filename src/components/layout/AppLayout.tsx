import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { GraphSettingsProvider } from '../../hooks/useGraphSettings';
import GlobalSettingsModal, { type SettingsTabKey } from '../settings/GlobalSettingsModal';
import NavBar from './NavBar';

export default function AppLayout() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTabKey>('account');

  useEffect(() => {
    const handleOpen = (e: Event) => {
      const customEvent = e as CustomEvent<SettingsTabKey | undefined>;
      setSettingsTab(customEvent.detail ?? 'account');
      setSettingsOpen(true);
    };
    window.addEventListener('open-global-settings', handleOpen);
    return () => window.removeEventListener('open-global-settings', handleOpen);
  }, []);

  return (
    <GraphSettingsProvider>
      <div className="flex h-screen w-screen flex-col bg-background">
        <NavBar />
        <main className="flex min-h-0 flex-1">
          <Outlet />
        </main>
        <GlobalSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} initialTab={settingsTab} />
      </div>
    </GraphSettingsProvider>
  );
}
