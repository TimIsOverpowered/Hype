import { useCallback, useEffect, useRef, useState } from 'react';
import { formatTime, getCurrentChapter } from '../utils/time';

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

    const handleMouseLeave = () => {
      setShowControls(false);
      clearTimeout(hideTimerRef.current);
    };

    const container = playerContainerRef.current;
    if (!container) return;

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseenter', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseenter', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
      clearTimeout(hideTimerRef.current);
    };
  }, [isPlaying, isMenuOpen, playerContainerRef]);

  return { showControls };
}

interface UseTooltipControlsOptions {
  duration: number;
  chapters?: readonly { positionMilliseconds: number; durationMilliseconds: number; game?: string }[];
}

export function useTooltipControls({ duration, chapters }: UseTooltipControlsOptions) {
  const progressTooltipRef = useRef<HTMLDivElement>(null);
  const volumeTooltipRef = useRef<HTMLDivElement>(null);

  const updateProgressTooltip = useCallback(
    (clientX: number, target: HTMLElement) => {
      const tooltip = progressTooltipRef.current;
      if (!tooltip || !target) return;

      const rect = target.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const time = percent * duration;
      const chapter = getCurrentChapter(time, chapters);

      if (chapter) {
        tooltip.innerHTML = '';
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px';
        const gameEl = document.createElement('div');
        gameEl.style.cssText =
          'font-size:12px;color:#a0a0b0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px';
        gameEl.textContent = chapter;
        const timeEl = document.createElement('div');
        timeEl.style.cssText = 'font-size:12px;white-space:nowrap';
        timeEl.textContent = formatTime(time);
        wrapper.appendChild(gameEl);
        wrapper.appendChild(timeEl);
        tooltip.appendChild(wrapper);
      } else {
        tooltip.innerHTML = '';
        const timeEl = document.createElement('div');
        timeEl.style.cssText = 'font-size:12px;white-space:nowrap';
        timeEl.textContent = formatTime(time);
        tooltip.appendChild(timeEl);
      }
      tooltip.style.opacity = '1';

      const tooltipWidth = tooltip.offsetWidth;
      const targetWidth = rect.width;
      const halfTooltipPercent = (tooltipWidth / targetWidth) * 50;
      const clampedPercent = Math.max(halfTooltipPercent, Math.min(100 - halfTooltipPercent, percent * 100));
      tooltip.style.left = `${clampedPercent}%`;
    },
    [duration, chapters],
  );

  const handleProgressMouseMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      updateProgressTooltip(e.clientX, e.currentTarget);
    },
    [updateProgressTooltip],
  );

  const handleProgressTouchMove = useCallback(
    (e: React.TouchEvent<HTMLElement>) => {
      updateProgressTooltip(e.touches[0].clientX, e.currentTarget);
    },
    [updateProgressTooltip],
  );

  const handleProgressTouchEnd = useCallback(() => {
    progressTooltipRef.current?.style.setProperty('opacity', '0', 'important');
  }, []);

  const handleProgressMouseLeave = useCallback(() => {
    progressTooltipRef.current?.style.setProperty('opacity', '0', 'important');
  }, []);

  const updateVolumeTooltip = useCallback((clientX: number, input: HTMLElement) => {
    const tooltip = volumeTooltipRef.current;
    if (!tooltip || !input) return;

    const rect = input.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const value = Math.round(percent * 100);

    tooltip.textContent = `${value}%`;
    tooltip.style.left = `${percent * 100}%`;
    tooltip.style.opacity = '1';
  }, []);

  const handleVolumeMouseMove = useCallback(
    (e: React.MouseEvent<HTMLInputElement>) => {
      updateVolumeTooltip(e.clientX, e.currentTarget);
    },
    [updateVolumeTooltip],
  );

  const handleVolumeTouchMove = useCallback(
    (e: React.TouchEvent<HTMLInputElement>) => {
      updateVolumeTooltip(e.touches[0].clientX, e.currentTarget);
    },
    [updateVolumeTooltip],
  );

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


