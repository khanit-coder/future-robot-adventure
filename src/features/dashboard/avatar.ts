const STYLES = ['bolt', 'nova', 'gizmo'] as const;
const COLORS = ['#38bdf8', '#f472b6', '#4ade80', '#fbbf24', '#a78bfa'] as const;

export function avatarForPlayer(playerId: string) {
  let hash = 0;
  for (let i = 0; i < playerId.length; i++) {
    hash = (hash * 31 + playerId.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash);
  return {
    style: STYLES[idx % STYLES.length],
    color: COLORS[idx % COLORS.length],
  };
}
