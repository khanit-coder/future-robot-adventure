import { useCallback, useEffect, useRef, useState } from 'react';
import type { DashboardMode } from '@engine';
import type { DashboardPlayer } from '@/services/api/publicApi';

export type ExtendedDashboardMode = DashboardMode | 'HALL_OF_FAME';

export function deduplicatePlayersBestScore(list: DashboardPlayer[]): DashboardPlayer[] {
  const map = new Map<string, DashboardPlayer>();
  for (const p of list) {
    const normName = (p.name || '').trim().toLowerCase();
    const normSchool = (p.school || '').trim().toLowerCase();
    const key = `${normName}:::${normSchool}`;

    const existing = map.get(key);
    if (!existing) {
      map.set(key, p);
      continue;
    }

    if (p.score > existing.score) {
      map.set(key, p);
      continue;
    }
    if (p.score < existing.score) {
      continue;
    }

    if (p.levels_completed > existing.levels_completed) {
      map.set(key, p);
      continue;
    }
    if (p.levels_completed < existing.levels_completed) {
      continue;
    }

    const pTime = p.best_level_ms != null && p.best_level_ms > 0 ? p.best_level_ms : Infinity;
    const existingTime =
      existing.best_level_ms != null && existing.best_level_ms > 0 ? existing.best_level_ms : Infinity;
    if (pTime < existingTime) {
      map.set(key, p);
      continue;
    }

    if (existing.status !== 'FINISHED' && p.status === 'FINISHED') {
      map.set(key, p);
      continue;
    }
  }
  return Array.from(map.values());
}

export function safeScrollTo(el: HTMLElement | null, opts: ScrollToOptions) {
  if (!el) return;
  if (typeof el.scrollTo === 'function') {
    el.scrollTo(opts);
  } else {
    el.scrollTop = opts.top ?? 0;
  }
}

export function safeWindowScrollTo(opts: ScrollToOptions) {
  if (typeof window === 'undefined') return;
  if (typeof window.scrollTo === 'function') {
    window.scrollTo(opts);
  } else if (typeof document !== 'undefined') {
    document.documentElement.scrollTop = opts.top ?? 0;
  }
}

export interface AutoScrollOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  enabled: boolean;
  page: number;
  totalPages: number;
  onNextPage: () => void;
  mode: ExtendedDashboardMode;
  isFullscreen: boolean;
  speed?: number;
  pauseAtBottomMs?: number;
  pauseAtTopMs?: number;
  idlePageRotateMs?: number;
}

export function useAutoScrollLoop({
  containerRef,
  enabled,
  page,
  totalPages,
  onNextPage,
  mode,
  isFullscreen,
  speed = 26,
  pauseAtBottomMs = 3500,
  pauseAtTopMs = 2500,
  idlePageRotateMs = 12000,
}: AutoScrollOptions) {
  const [isHovered, setIsHovered] = useState(false);
  const [userInteractingUntil, setUserInteractingUntil] = useState(0);

  const pauseUntilRef = useRef<number>(0);
  const subPixelAccRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const idleTimerRef = useRef<number>(0);
  const atBottomRef = useRef<boolean>(false);

  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      safeScrollTo(el, { top: 0, behavior: 'instant' });
    }
    pauseUntilRef.current = Date.now() + pauseAtTopMs;
    idleTimerRef.current = Date.now() + idlePageRotateMs;
    subPixelAccRef.current = 0;
    atBottomRef.current = false;
  }, [page, mode, pauseAtTopMs, idlePageRotateMs, containerRef]);

  const onUserInteraction = useCallback(() => {
    setUserInteractingUntil(Date.now() + 4000);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleWheel = () => onUserInteraction();
    const handleTouch = () => onUserInteraction();
    el.addEventListener('wheel', handleWheel, { passive: true });
    el.addEventListener('touchstart', handleTouch, { passive: true });
    return () => {
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('touchstart', handleTouch);
    };
  }, [containerRef, onUserInteraction]);

  useEffect(() => {
    if (!enabled) return;

    let animId: number;

    const tick = (now: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = now;
      }
      const dt = Math.min(100, Math.max(0, now - lastTimeRef.current));
      lastTimeRef.current = now;

      const el = containerRef.current;
      const wallNow = Date.now();

      if (!el || isHovered || wallNow < userInteractingUntil) {
        animId = requestAnimationFrame(tick);
        return;
      }

      const hasInnerOverflow = el.scrollHeight - el.clientHeight > 8;
      const scrollHeight = hasInnerOverflow
        ? el.scrollHeight
        : typeof document !== 'undefined'
          ? document.documentElement.scrollHeight
          : 0;
      const clientHeight = hasInnerOverflow
        ? el.clientHeight
        : typeof window !== 'undefined'
          ? window.innerHeight
          : 0;
      const scrollTop = hasInnerOverflow
        ? el.scrollTop
        : typeof window !== 'undefined'
          ? window.scrollY
          : 0;
      const maxScroll = Math.max(0, scrollHeight - clientHeight);

      if (maxScroll <= 8) {
        if (mode === 'GRID' && totalPages > 1) {
          if (idleTimerRef.current === 0) {
            idleTimerRef.current = wallNow + idlePageRotateMs;
          } else if (wallNow >= idleTimerRef.current) {
            idleTimerRef.current = wallNow + idlePageRotateMs;
            onNextPage();
          }
        }
        animId = requestAnimationFrame(tick);
        return;
      }

      if (pauseUntilRef.current > 0 && wallNow < pauseUntilRef.current) {
        animId = requestAnimationFrame(tick);
        return;
      }

      if (scrollTop >= maxScroll - 4) {
        if (!atBottomRef.current) {
          atBottomRef.current = true;
          pauseUntilRef.current = wallNow + pauseAtBottomMs;

          setTimeout(() => {
            atBottomRef.current = false;
            if (mode === 'GRID' && totalPages > 1) {
              onNextPage();
            } else {
              if (hasInnerOverflow && el) {
                safeScrollTo(el, { top: 0, behavior: 'smooth' });
              } else if (typeof window !== 'undefined') {
                safeWindowScrollTo({ top: 0, behavior: 'smooth' });
              }
              pauseUntilRef.current = Date.now() + pauseAtTopMs;
            }
          }, pauseAtBottomMs);
        }
        animId = requestAnimationFrame(tick);
        return;
      }

      atBottomRef.current = false;

      const pixelsToMove = (speed * dt) / 1000;
      subPixelAccRef.current += pixelsToMove;
      if (subPixelAccRef.current >= 1) {
        const intMove = Math.floor(subPixelAccRef.current);
        if (hasInnerOverflow) {
          el.scrollTop += intMove;
        } else if (typeof window !== 'undefined') {
          window.scrollBy({ top: intMove, behavior: 'instant' });
        }
        subPixelAccRef.current -= intMove;
      }

      animId = requestAnimationFrame(tick);
    };

    lastTimeRef.current = 0;
    animId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [
    enabled,
    isHovered,
    userInteractingUntil,
    mode,
    totalPages,
    onNextPage,
    speed,
    pauseAtBottomMs,
    pauseAtTopMs,
    idlePageRotateMs,
    containerRef,
    isFullscreen,
  ]);

  return {
    isHovered,
    setIsHovered,
    onUserInteraction,
  };
}
