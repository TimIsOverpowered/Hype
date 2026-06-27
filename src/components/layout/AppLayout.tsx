import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useJobQueue } from '../../contexts/JobQueueContext';
import { GraphSettingsProvider } from '../../hooks/useGraphSettings';
import { setModalOpen } from '../../lib/modalState';
import GlobalSettingsModal, { type SettingsTabKey } from '../settings/GlobalSettingsModal';
import LocalVerticalEditor from '../ui/LocalVerticalEditor';
import NavBar from './NavBar';

export default function AppLayout() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTabKey>('account');
  const [verticalVideoPath, setVerticalVideoPath] = useState<string | null>(null);
  const { submitVerticalClip } = useJobQueue();

  useEffect(() => {
    const handleOpen = (e: Event) => {
      const customEvent = e as CustomEvent<SettingsTabKey | undefined>;
      setSettingsTab(customEvent.detail ?? 'account');
      setSettingsOpen(true);
    };

    const handleOpenVertical = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      setVerticalVideoPath(customEvent.detail);
      setModalOpen(true);
    };

    window.addEventListener('open-global-settings', handleOpen);
    window.addEventListener('open-vertical-editor', handleOpenVertical);
    return () => {
      window.removeEventListener('open-global-settings', handleOpen);
      window.removeEventListener('open-vertical-editor', handleOpenVertical);
    };
  }, []);

  const handleVerticalClose = () => {
    setVerticalVideoPath(null);
    setModalOpen(false);
  };

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
            onConfirm={(layoutMode, camBox, gameBox, singleBox, fitMode) => {
              submitVerticalClip({
                sourcePath: verticalVideoPath,
                layoutMode,
                camBox,
                gameBox,
                singleBox,
                fitMode,
              });
              setVerticalVideoPath(null);
            }}
          />
        )}
      </div>
    </GraphSettingsProvider>
  );
}
