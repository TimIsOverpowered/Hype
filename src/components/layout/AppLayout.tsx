import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { GraphSettingsProvider } from '../../hooks/useGraphSettings';
import GlobalSettingsModal, { type SettingsTabKey } from '../settings/GlobalSettingsModal';
import LocalVerticalEditor from '../ui/LocalVerticalEditor';
import NavBar from './NavBar';

export default function AppLayout() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTabKey>('account');
  const [verticalVideoPath, setVerticalVideoPath] = useState<string | null>(null);

  useEffect(() => {
    const handleOpen = (e: Event) => {
      const customEvent = e as CustomEvent<SettingsTabKey | undefined>;
      setSettingsTab(customEvent.detail ?? 'account');
      setSettingsOpen(true);
    };

    const handleOpenVertical = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      setVerticalVideoPath(customEvent.detail);
    };

    window.addEventListener('open-global-settings', handleOpen);
    window.addEventListener('open-vertical-editor', handleOpenVertical);
    return () => {
      window.removeEventListener('open-global-settings', handleOpen);
      window.removeEventListener('open-vertical-editor', handleOpenVertical);
    };
  }, []);

  const handleVerticalClose = () => setVerticalVideoPath(null);

  return (
    <GraphSettingsProvider>
      <div className="flex h-screen w-screen flex-col bg-background">
        <NavBar />
        <main className="flex min-h-0 flex-1">
          <Outlet />
        </main>
        <GlobalSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} initialTab={settingsTab} />
        {verticalVideoPath && (
          <LocalVerticalEditor
            localMp4Path={verticalVideoPath}
            onClose={handleVerticalClose}
            onConfirm={() => {
              console.log('crop data', { verticalVideoPath });
              setVerticalVideoPath(null);
            }}
          />
        )}
      </div>
    </GraphSettingsProvider>
  );
}
