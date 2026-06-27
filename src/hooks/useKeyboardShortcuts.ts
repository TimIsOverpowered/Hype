import { useCallback, useEffect } from 'react';
import { isModalCurrentlyOpen } from '../lib/modalState';

interface UseKeyboardShortcutsOptions {
  playerRef: React.RefObject<HTMLVideoElement | null>;
  toggleFullscreen: () => void;
  toggleMute: () => void;
  togglePlayPause: () => void;
}

export function useKeyboardShortcuts({
  playerRef,
  toggleFullscreen,
  toggleMute,
  togglePlayPause,
}: UseKeyboardShortcutsOptions): void {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (isModalCurrentlyOpen()) return;

      if (
        e.target instanceof HTMLElement &&
        (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)
      ) {
        return;
      }

      switch (e.code) {
        case 'Space':
        case 'KeyK':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'KeyM':
          toggleMute();
          break;
        case 'KeyF':
          toggleFullscreen();
          break;
        case 'ArrowRight': {
          if (playerRef.current) playerRef.current.currentTime += 5;
          break;
        }
        case 'ArrowLeft': {
          if (playerRef.current) playerRef.current.currentTime -= 5;
          break;
        }
        case 'ArrowUp':
          e.preventDefault();
          if (playerRef.current) {
            playerRef.current.volume = Math.min(1, playerRef.current.volume + 0.1);
            playerRef.current.muted = false;
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (playerRef.current) {
            playerRef.current.volume = Math.max(0, playerRef.current.volume - 0.1);
          }
          break;
      }
    },
    [playerRef, toggleFullscreen, toggleMute, togglePlayPause],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
