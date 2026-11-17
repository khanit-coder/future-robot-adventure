import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '@/i18n/config';
import { DashboardView } from '@/features/dashboard/DashboardView';
import type { DashboardSnapshot } from '@/services/api/publicApi';
import type { DashboardSettingsRow } from '@engine';

function make100PlayersSnapshot(): DashboardSnapshot {
  const players = Array.from({ length: 100 }).map((_, i) => ({
    id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
    name: `Student ${i + 1}`,
    school: `School ${(i % 10) + 1}`,
    status: (i % 4 === 0 ? 'FINISHED' : i % 3 === 0 ? 'LEARNING' : 'PLAYING') as
      'FINISHED' | 'LEARNING' | 'PLAYING',
    score: (100 - i) * 15,
    levels_completed: (i % 10) + 1,
    started_at: '2026-01-01T00:00:00Z',
    finished_at: null,
    registered_at: '2026-01-01T00:00:00Z',
  }));
  return {
    server_now: '2026-01-01T00:05:00Z',
    session: { id: 'sess-1', name: 'Open House', status: 'ACTIVE', registration_open: true },
    last_seq: 100,
    total_levels: 10,
    players,
    recent_events: [],
    total_missions_completed: 550,
  };
}

const dashSettings: DashboardSettingsRow = {
  id: 'ds-1',
  singleton: true,
  mode: 'GRID',
  columns: 8,
  robot_size: 72,
  page_size: 48,
  rotate_seconds: 12,
  show_school: true,
  show_leaderboard: true,
  show_scores: true,
  show_online_count: true,
  animations_enabled: true,
  theme: 'space',
  background_url: null,
  spotlight_interval_seconds: 8,
  created_at: '',
  updated_at: '',
};

describe('DashboardView with 100 simultaneous players', () => {
  it('paginates 100 players cleanly, renders leaderboard, and switches display modes', () => {
    const snap = make100PlayersSnapshot();
    render(
      <DashboardView
        snapshot={snap}
        settings={null}
        dashSettings={dashSettings}
        onlineIds={new Set(snap.players.map((p) => p.id))}
        connectionState="connected"
        robotOverrides={{}}
        recentEvents={[]}
      />,
    );

    // Page 1 shows 48 cards; pagination handles all 100 without rendering 100 heavy canvases
    expect(screen.getAllByTestId('dashboard-robot-card')).toHaveLength(48);
    expect(screen.getAllByText('Student 1').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/550/)).toBeInTheDocument();

    // Switch to Planet Map
    fireEvent.click(screen.getByText('Planet Map'));
    expect(screen.getByText('Training Orbit')).toBeInTheDocument();
    expect(screen.getByText('Final Mission')).toBeInTheDocument();

    // Switch to Spotlight
    fireEvent.click(screen.getByText('Spotlight'));
    expect(screen.getAllByTestId('dashboard-robot-card').length).toBeGreaterThan(0);

    // Switch to Hall of Fame
    fireEvent.click(screen.getByTestId('dashboard-mode-HALL_OF_FAME'));
    expect(screen.getByText('RANK #1')).toBeInTheDocument();
    expect(screen.getByText('RANK #2')).toBeInTheDocument();
    expect(screen.getByText('RANK #3')).toBeInTheDocument();

    // Verify auto-scroll toggle button exists and can be clicked
    const autoScrollBtn = screen.getByTestId('dashboard-autoscroll-toggle');
    expect(autoScrollBtn).toBeInTheDocument();
    fireEvent.click(autoScrollBtn);
    expect(screen.getByText(/Paused|พักการเลื่อน/)).toBeInTheDocument();
    fireEvent.click(autoScrollBtn);
    expect(screen.getByText(/Auto Scroll|เลื่อนอัตโนมัติ/)).toBeInTheDocument();
  });

  it('deduplicates multiple entries of the same student, keeping only their single best score', () => {
    const baseSnap = make100PlayersSnapshot();
    // Insert duplicate records for AlphaTester with different scores
    const duplicatedPlayers = [
      {
        ...baseSnap.players[0]!,
        id: 'dup-low-score',
        name: 'AlphaTester',
        school: 'TechSchool',
        score: 50,
        levels_completed: 1,
      },
      {
        ...baseSnap.players[0]!,
        id: 'dup-high-score',
        name: 'AlphaTester',
        school: 'TechSchool',
        score: 9999,
        levels_completed: 10,
      },
      {
        ...baseSnap.players[0]!,
        id: 'dup-mid-score',
        name: ' alphatester ', // case & space variation
        school: ' TechSchool ',
        score: 500,
        levels_completed: 5,
      },
    ];

    render(
      <DashboardView
        snapshot={{ ...baseSnap, players: duplicatedPlayers }}
        settings={null}
        dashSettings={dashSettings}
        onlineIds={new Set()}
        connectionState="connected"
        robotOverrides={{}}
        recentEvents={[]}
      />,
    );

    // Only 1 card for AlphaTester should be rendered in the grid, displaying their best score (9999)
    const gridCards = screen.getAllByTestId('dashboard-robot-card');
    const alphaCards = gridCards.filter((card) => card.textContent?.includes('AlphaTester'));
    expect(alphaCards).toHaveLength(1);
    expect(alphaCards[0]?.textContent).toContain('9999');
  });
});
