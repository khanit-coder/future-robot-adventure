import type {
  Command,
  ExecutionResult,
  GameSessionRow,
  Lang,
  Localized,
  PlayerLevelProgressRow,
  PlayerRow,
  PlayerSessionRow,
  PublishedConfig,
  ScoreBreakdown,
  ValidationIssue,
} from '@engine';
import { ensureAuthSession, invokeEdge } from '@/services/api/edge';

export interface PlayerStateResponse {
  server_now: string;
  player: PlayerRow;
  player_session: PlayerSessionRow;
  session: GameSessionRow;
  progress: PlayerLevelProgressRow[];
  lessons_done: string[];
  claim: {
    id: string;
    reward_id: string;
    claim_code: string;
    status: 'RESERVED' | 'CLAIMED' | 'CANCELLED';
  } | null;
  latest_version: number;
  config?: PublishedConfig;
}

export interface SubmitSolutionResponse {
  accepted: boolean;
  duplicate?: boolean;
  reason?: string;
  status?: 'INVALID' | 'FAILED' | 'SUCCESS';
  issues?: ValidationIssue[];
  result?: ExecutionResult;
  score?: {
    awarded: number;
    total: number;
    breakdown?: ScoreBreakdown | null;
  };
  already_completed?: boolean;
  levels_completed?: number;
  player_status?: PlayerSessionRow['status'];
  expires_at?: string | null;
  finished?: boolean;
  out_of_hearts?: boolean;
  hearts_remaining?: number;
  server_now?: string;
}

export const playerApi = {
  async ensureSession() {
    await ensureAuthSession();
  },

  async register(input: { display_name: string; school: string; grade?: string; lang: Lang }) {
    await ensureAuthSession();
    return invokeEdge<{
      player: PlayerRow;
      player_session: PlayerSessionRow;
      session?: GameSessionRow;
      config?: PublishedConfig;
      latest_version?: number;
      server_now?: string;
      existing: boolean;
    }>('register-player', input, { allowAnonymous: true });
  },

  async getState(includeConfig = false) {
    return invokeEdge<PlayerStateResponse>('player-action', {
      action: 'get_state',
      include_config: includeConfig,
    });
  },

  async getConfig() {
    return invokeEdge<{ config: PublishedConfig; latest_version: number }>('player-action', {
      action: 'get_config',
    });
  },

  async setLanguage(lang: Lang) {
    return invokeEdge<{ ok: boolean }>('player-action', { action: 'set_language', lang });
  },

  async lessonsStarted() {
    return invokeEdge<{ ok: boolean }>('player-action', { action: 'lessons_started' });
  },

  async completeLesson(lesson_id: string) {
    return invokeEdge<{ ok: boolean; lessons_completed: number }>('player-action', {
      action: 'complete_lesson',
      lesson_id,
    });
  },

  async startGame(skip = false) {
    return invokeEdge<PlayerStateResponse>('player-action', { action: 'start_game', skip });
  },

  async startLevel(level_id: string) {
    return invokeEdge<{ progress: PlayerLevelProgressRow; server_now: string }>('player-action', {
      action: 'start_level',
      level_id,
    });
  },

  async getHints(level_id: string) {
    return invokeEdge<{ hints: Localized[]; hints_used: number; hints_total: number; penalty: number }>(
      'player-action',
      { action: 'get_hints', level_id },
    );
  },

  async useHint(level_id: string) {
    return invokeEdge<{ hints: Localized[]; hints_used: number; hints_total: number; penalty: number }>(
      'player-action',
      { action: 'use_hint', level_id },
    );
  },

  async finishGame() {
    return invokeEdge<PlayerStateResponse>('player-action', { action: 'finish_game' });
  },

  async submitSolution(input: { level_id: string; client_submission_id: string; program: Command[] }) {
    return invokeEdge<SubmitSolutionResponse>('submit-solution', input);
  },

  async claimReward(reward_id: string) {
    return invokeEdge<{
      ok: boolean;
      reason?: string;
      duplicate?: boolean;
      claim_id?: string;
      claim_code?: string;
      reward_id?: string;
      status?: 'RESERVED' | 'CLAIMED' | 'CANCELLED';
    }>('claim-reward', { reward_id });
  },
};
