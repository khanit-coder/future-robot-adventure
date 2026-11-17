import type { RobotConfig } from '@engine';

const STORAGE_KEY = 'fra_assigned_robot_id';

/**
 * Deterministically hashes a player ID into an integer index.
 * Matches avatarForPlayer so the student's in-game robot and dashboard robot are 100% identical.
 */
export function hashPlayerIdToIndex(playerId: string, modulo: number): number {
  if (modulo <= 0) return 0;
  let hash = 0;
  for (let i = 0; i < playerId.length; i++) {
    hash = (hash * 31 + playerId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % modulo;
}

/**
 * Assigns or retrieves a companion robot for a student.
 * If the student already has an assigned robot stored locally, it returns that.
 * Otherwise, it deterministically hashes playerId across active robots, or picks a random one.
 */
export function getAssignedRobotForStudent(
  playerId: string | undefined | null,
  robots: RobotConfig[] | null | undefined,
): RobotConfig | null {
  if (!robots || robots.length === 0) return null;

  // 1. Check local storage if already assigned for this client
  try {
    const storedId = localStorage.getItem(STORAGE_KEY);
    if (storedId) {
      const match = robots.find((r) => r.id === storedId);
      if (match) return match;
    }
  } catch {
    // ignore localstorage errors
  }

  // 2. If playerId is provided, deterministically assign via hash
  if (playerId) {
    const idx = hashPlayerIdToIndex(playerId, robots.length);
    const chosen = robots[idx];
    try {
      localStorage.setItem(STORAGE_KEY, chosen.id);
    } catch {}
    return chosen;
  }

  // 3. Fallback: pick a random active robot from the pool
  const randomIdx = Math.floor(Math.random() * robots.length);
  const chosen = robots[randomIdx];
  try {
    localStorage.setItem(STORAGE_KEY, chosen.id);
  } catch {}
  return chosen;
}

/**
 * Explicitly picks and saves a brand new random robot for a registering student.
 */
export function assignRandomRobotForRegistration(robots: RobotConfig[] | null | undefined): RobotConfig | null {
  if (!robots || robots.length === 0) return null;
  const randomIdx = Math.floor(Math.random() * robots.length);
  const chosen = robots[randomIdx];
  try {
    localStorage.setItem(STORAGE_KEY, chosen.id);
  } catch {}
  return chosen;
}
