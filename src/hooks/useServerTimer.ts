import { useEffect, useState } from 'react';

/**
 * Counts down strictly using the server-authoritative clock offset.
 * Never trusts raw browser wall-clock time; triggers `onExpire` once when remaining reaches 0.
 */
export function useServerTimer(
  expiresAtIso: string | null,
  serverOffsetMs: number,
  active: boolean,
  onExpire?: () => void,
): number | null {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(() =>
    computeRemaining(expiresAtIso, serverOffsetMs),
  );

  useEffect(() => {
    if (!expiresAtIso) return;
    let fired = false;
    const tick = () => {
      const left = computeRemaining(expiresAtIso, serverOffsetMs);
      setSecondsLeft(left);
      if (active && left !== null && left <= 0 && !fired) {
        fired = true;
        onExpire?.();
      }
    };
    const initTimer = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(initTimer);
      window.clearInterval(id);
    };
  }, [expiresAtIso, serverOffsetMs, active, onExpire]);

  return expiresAtIso ? secondsLeft : null;
}

function computeRemaining(expiresAtIso: string | null, serverOffsetMs: number): number | null {
  if (!expiresAtIso) return null;
  const target = new Date(expiresAtIso).getTime();
  if (!Number.isFinite(target)) return null;
  const serverNow = Date.now() + serverOffsetMs;
  return Math.max(0, Math.ceil((target - serverNow) / 1000));
}
