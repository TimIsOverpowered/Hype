import { useCallback, useEffect, useRef, useState } from 'react';

const AUTO_HIDE_DELAY = 2500;

interface UseAutoHideControlsOptions {
  isPlaying: boolean;
  isMenuOpen: boolean;
  playerContainerRef: React.RefObject<HTMLDivElement | null>;
}

export function useAutoHideControls({ isPlaying, isMenuOpen, playerContainerRef }: UseAutoHideControlsOptions) {
  const [showControls, setShowControls] = useState(true);
  const hideTimerRef = useRef<number>(0);
  const lastMoveRef = useRef<number>(0);

  useEffect(() => {
    if (!isPlaying || isMenuOpen) {
      setShowControls(true);
      return;
    }

    const handleMouseMove = () => {
      lastMoveRef.current = performance.now();
      setShowControls(true);
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = window.setTimeout(() => {
        setShowControls(false);
      }, AUTO_HIDE_DELAY);
    };

    const container = playerContainerRef.current;
    if (!container) return;

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseenter', handleMouseMove);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseenter', handleMouseMove);
      clearTimeout(hideTimerRef.current);
    };
  }, [isPlaying, isMenuOpen, playerContainerRef]);

  return { showControls };
}

interface UseTooltipControlsOptions {
  duration: number;
}

export function useTooltipControls({ duration }: UseTooltipControlsOptions) {
  const progressTooltipRef = useRef<HTMLDivElement>(null);
  const volumeTooltipRef = useRef<HTMLDivElement>(null);

  const handleProgressMouseMove = useCallback(
    (e: React.MouseEvent<HTMLInputElement>) => {
      const tooltip = progressTooltipRef.current;
      const input = e.currentTarget;
      if (!tooltip || !input) return;

      const rect = input.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const time = percent * duration;

      tooltip.textContent = formatTime(time);
      tooltip.style.left = `${percent * 100}%`;
      tooltip.style.opacity = '1';
    },
    [duration],
  );

  const handleProgressTouchMove = useCallback(
    (e: React.TouchEvent<HTMLInputElement>) => {
      const tooltip = progressTooltipRef.current;
      const input = e.currentTarget;
      if (!tooltip || !input) return;

      const rect = input.getBoundingClientRect();
      const touch = e.touches[0];
      const percent = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
      const time = percent * duration;

      tooltip.textContent = formatTime(time);
      tooltip.style.left = `${percent * 100}%`;
      tooltip.style.opacity = '1';
    },
    [duration],
  );

  const handleProgressTouchEnd = useCallback(() => {
    progressTooltipRef.current?.style.setProperty('opacity', '0', 'important');
  }, []);

  const handleProgressMouseLeave = useCallback(() => {
    progressTooltipRef.current?.style.setProperty('opacity', '0', 'important');
  }, []);

  const handleVolumeMouseMove = useCallback((e: React.MouseEvent<HTMLInputElement>) => {
    const tooltip = volumeTooltipRef.current;
    const input = e.currentTarget;
    if (!tooltip || !input) return;

    const rect = input.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const value = Math.round(percent * 100);

    tooltip.textContent = `${value}%`;
    tooltip.style.left = `${percent * 100}%`;
    tooltip.style.opacity = '1';
  }, []);

  const handleVolumeTouchMove = useCallback((e: React.TouchEvent<HTMLInputElement>) => {
    const tooltip = volumeTooltipRef.current;
    const input = e.currentTarget;
    if (!tooltip || !input) return;

    const rect = input.getBoundingClientRect();
    const touch = e.touches[0];
    const percent = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
    const value = Math.round(percent * 100);

    tooltip.textContent = `${value}%`;
    tooltip.style.left = `${percent * 100}%`;
    tooltip.style.opacity = '1';
  }, []);

  const handleVolumeTouchEnd = useCallback(() => {
    volumeTooltipRef.current?.style.setProperty('opacity', '0', 'important');
  }, []);

  const handleVolumeMouseLeave = useCallback(() => {
    volumeTooltipRef.current?.style.setProperty('opacity', '0', 'important');
  }, []);

  const handleVolumeMouseUp = useCallback(() => {
    volumeTooltipRef.current?.style.setProperty('opacity', '0', 'important');
  }, []);

  const handleVolumeMouseDown = useCallback(() => {
    volumeTooltipRef.current?.style.setProperty('opacity', '1', 'important');
  }, []);

  return {
    progressTooltipRef,
    volumeTooltipRef,
    handleProgressMouseMove,
    handleProgressTouchMove,
    handleProgressTouchEnd,
    handleProgressMouseLeave,
    handleVolumeMouseMove,
    handleVolumeTouchMove,
    handleVolumeTouchEnd,
    handleVolumeMouseLeave,
    handleVolumeMouseUp,
    handleVolumeMouseDown,
  };
}

interface UseSettingsMenuOptions {
  isMenuOpen: boolean;
}

export function useSettingsMenu({ isMenuOpen }: UseSettingsMenuOptions) {
  const [settingsAnchorEl, setSettingsAnchorEl] = useState<HTMLElement | null>(null);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [menuMaxHeight, setMenuMaxHeight] = useState(400);
  const settingsMenuRef = useRef<HTMLDivElement>(null);

  const handleCloseSettings = useCallback(() => {
    setSettingsAnchorEl(null);
    setShowSpeedMenu(false);
    setShowQualityMenu(false);
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(e.target as Node)) {
        if (settingsAnchorEl && !(settingsAnchorEl as HTMLElement).contains(e.target as Node)) {
          handleCloseSettings();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen, settingsAnchorEl, handleCloseSettings]);

  return {
    settingsAnchorEl,
    setSettingsAnchorEl,
    showSpeedMenu,
    setShowSpeedMenu,
    showQualityMenu,
    setShowQualityMenu,
    menuMaxHeight,
    setMenuMaxHeight,
    settingsMenuRef,
    handleCloseSettings,
  };
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
