import * as Phaser from 'phaser';
import { runProgram } from '@engine';
import type { Command, ExecutionResult, MissionSpec, RobotConfig, SceneConfig } from '@engine';
import { MissionScene, type ScenePlayCallbacks } from '@/game-engine/scenes/MissionScene';

export interface LoadMissionOptions {
  mission: MissionSpec;
  robot?: RobotConfig | null;
  scene?: SceneConfig | null;
  completionAnimation?: 'celebrate' | 'wave' | 'jump';
}

/**
 * Framework-independent Phaser 3 Robot Game Engine wrapper.
 * Supports:
 *  - `loadMission(...)`
 *  - `playTrace(result)` (for authoritative server-returned traces)
 *  - `execute(commands)` (deterministic local preview using the shared interpreter)
 *  - `pause()`, `resume()`, `reset()`, `destroy()`
 */
export class RobotGameEngine {
  private game: Phaser.Game;
  private missionScene: MissionScene;
  private currentMission: MissionSpec | null = null;

  constructor(parent: HTMLElement) {
    this.missionScene = new MissionScene();
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      width: parent.clientWidth || 640,
      height: parent.clientHeight || 400,
      backgroundColor: '#0f172a',
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: [this.missionScene],
      banner: false,
      audio: { noAudio: true },
    });
  }

  async loadMission(opts: LoadMissionOptions): Promise<void> {
    this.currentMission = opts.mission;
    await this.missionScene.configure(
      opts.mission,
      opts.robot ?? null,
      opts.scene ?? null,
      opts.completionAnimation ?? 'celebrate',
    );
  }

  async playTrace(result: ExecutionResult, callbacks?: ScenePlayCallbacks): Promise<void> {
    await this.missionScene.playTrace(result, callbacks);
  }

  /** Execute validated commands directly against the loaded mission (used in lesson demos & admin previews). */
  async execute(commands: Command[], callbacks?: ScenePlayCallbacks): Promise<ExecutionResult | null> {
    if (!this.currentMission) return null;
    const result = runProgram(this.currentMission, commands);
    await this.missionScene.playTrace(result, callbacks);
    return result;
  }

  pause(): void {
    this.missionScene.pausePlayback();
  }

  resume(): void {
    this.missionScene.resumePlayback();
  }

  reset(): void {
    this.missionScene.resetBoard();
  }

  destroy(): void {
    this.game.destroy(true);
  }
}
