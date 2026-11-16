import { useCallback, useEffect, useState } from 'react';

/**
 * Universal fullscreen hook.
 * Syncs with document.fullscreenElement, notifies React components,
 * and maintains a `.fra-fullscreen` CSS class on document.documentElement.
 */
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() =>
    typeof document !== 'undefined' ? Boolean(document.fullscreenElement) : false,
  );

  useEffect(() => {
    const onFullscreenChange = () => {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('fra-fullscreen', active);
        // Dispatch resize event so Phaser, Blockly, and canvases re-measure immediately
        window.dispatchEvent(new Event('resize'));
      }
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    // Initialize class
    if (typeof document !== 'undefined' && document.fullscreenElement) {
      document.documentElement.classList.add('fra-fullscreen');
    }

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch {
      // Ignored if blocked by browser policy
    }
  }, []);

  const enterFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Ignored
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch {
      // Ignored
    }
  }, []);

  return { isFullscreen, toggleFullscreen, enterFullscreen, exitFullscreen };
}
