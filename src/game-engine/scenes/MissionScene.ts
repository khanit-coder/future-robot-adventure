import * as Phaser from 'phaser';
import type {
  Direction,
  ExecutionResult,
  MissionSpec,
  Pos,
  RobotConfig,
  SceneConfig,
  TraceEvent,
} from '@engine';
import { tileAt } from '@engine';
import {
  BUILTIN_ANIMATIONS,
  ensureBuiltinRobotSheet,
  registerRobotAnims,
} from '@/game-engine/animations/proceduralRobot';

export interface ScenePlayCallbacks {
  onStep?: (event: TraceEvent, index: number) => void;
  onComplete?: (result: ExecutionResult) => void;
}

const THEME_PALETTE: Record<
  string,
  { bgTop: number; bgBot: number; floor: number; border: number; accent: number }
> = {
  training: { bgTop: 0x0f172a, bgBot: 0x1e293b, floor: 0x334155, border: 0x38bdf8, accent: 0x38bdf8 },
  energy: { bgTop: 0x1e1b4b, bgBot: 0x3b1d52, floor: 0x4c1d95, border: 0xf59e0b, accent: 0xf59e0b },
  station: { bgTop: 0x0b132b, bgBot: 0x1c2541, floor: 0x2b3a67, border: 0xa78bfa, accent: 0xa78bfa },
  final: { bgTop: 0x170f23, bgBot: 0x3b0764, floor: 0x312e81, border: 0xf43f5e, accent: 0x4ade80 },
};

const DIR_ANGLE: Record<Direction, number> = {
  N: -90,
  E: 0,
  S: 90,
  W: 180,
};

export class MissionScene extends Phaser.Scene {
  private mission: MissionSpec | null = null;
  private robotCfg: RobotConfig | null = null;
  private sceneCfg: SceneConfig | null = null;
  private completionAnim: 'celebrate' | 'wave' | 'jump' = 'celebrate';

  private worldGroup?: Phaser.GameObjects.Container;
  private robotContainer?: Phaser.GameObjects.Container;
  private robotSprite?: Phaser.GameObjects.Sprite;
  private dirArrow?: Phaser.GameObjects.Triangle;
  private crystalNodes = new Map<number, Phaser.GameObjects.Container>();
  private generatorNodes = new Map<number, Phaser.GameObjects.Container>();
  private friendNodes = new Map<number, Phaser.GameObjects.Container>();
  private doorNodes: Phaser.GameObjects.Container[] = [];
  private parallaxSprites: { tile: Phaser.GameObjects.TileSprite; speed: number }[] = [];

  private cellSize = 64;
  private originX = 0;
  private originY = 0;
  private animPrefix = 'robot';
  private playbackToken = 0;
  private isPausedState = false;

  constructor() {
    super('MissionScene');
  }

  create() {
    this.scale.on('resize', () => {
      if (this.mission) this.renderBoard();
    });
    if (this.mission) {
      void this.setupAndRender();
    }
  }

  update(_time: number, delta: number) {
    for (const p of this.parallaxSprites) {
      p.tile.tilePositionX += (p.speed * delta) / 60;
    }
  }

  public async configure(
    mission: MissionSpec,
    robot: RobotConfig | null,
    scene: SceneConfig | null,
    completionAnim: 'celebrate' | 'wave' | 'jump' = 'celebrate',
  ) {
    this.playbackToken += 1;
    this.isPausedState = false;
    this.mission = mission;
    this.robotCfg = robot;
    this.sceneCfg = scene;
    this.completionAnim = completionAnim;
    if (this.sys.isActive()) {
      await this.setupAndRender();
    }
  }

  public resetBoard() {
    this.playbackToken += 1;
    this.isPausedState = false;
    this.tweens.killAll();
    this.renderBoard();
  }

  public pausePlayback() {
    this.isPausedState = true;
    this.tweens.pauseAll();
  }

  public resumePlayback() {
    this.isPausedState = false;
    this.tweens.resumeAll();
  }

  private async setupAndRender() {
    const token = this.playbackToken;
    await this.ensureAssetsLoaded();
    if (token !== this.playbackToken) return;
    this.renderBoard();
  }

  private async ensureAssetsLoaded(): Promise<void> {
    let loadedAny = false;

    if (this.robotCfg?.kind === 'spritesheet' && this.robotCfg.sprite_url) {
      const key = `robot_sheet_${this.robotCfg.id}`;
      if (!this.textures.exists(key)) {
        this.load.spritesheet(key, this.robotCfg.sprite_url, {
          frameWidth: this.robotCfg.frame_width || 64,
          frameHeight: this.robotCfg.frame_height || 64,
        });
        loadedAny = true;
      }
    }

    if (this.sceneCfg?.kind === 'image' && this.sceneCfg.image_url) {
      const key = `scene_bg_${this.sceneCfg.id}`;
      if (!this.textures.exists(key)) {
        this.load.image(key, this.sceneCfg.image_url);
        loadedAny = true;
      }
    }

    for (const [idx, layer] of (this.sceneCfg?.parallax ?? []).entries()) {
      const pKey = `scene_px_${this.sceneCfg?.id}_${idx}`;
      if (layer.url && !this.textures.exists(pKey)) {
        this.load.image(pKey, layer.url);
        loadedAny = true;
      }
    }

    if (!loadedAny) return;
    await new Promise<void>((resolve) => {
      this.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
      this.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, () => resolve());
      this.load.start();
    });
  }

  private cellCenter(p: Pos): { x: number; y: number } {
    return {
      x: this.originX + p.x * this.cellSize + this.cellSize / 2,
      y: this.originY + p.y * this.cellSize + this.cellSize / 2,
    };
  }

  private renderBoard() {
    if (!this.mission) return;
    this.children.removeAll(true);
    this.crystalNodes.clear();
    this.generatorNodes.clear();
    this.friendNodes.clear();
    this.doorNodes = [];
    this.parallaxSprites = [];

    const w = this.scale.width || 640;
    const h = this.scale.height || 420;
    const theme = this.sceneCfg?.theme || 'training';
    const pal = THEME_PALETTE[theme] ?? THEME_PALETTE.training;

    // 1. Backdrop
    const bg = this.add.graphics();
    bg.fillGradientStyle(pal.bgTop, pal.bgTop, pal.bgBot, pal.bgBot, 1);
    bg.fillRect(0, 0, w, h);

    if (this.sceneCfg?.kind === 'image') {
      const imgKey = `scene_bg_${this.sceneCfg.id}`;
      if (this.textures.exists(imgKey)) {
        const img = this.add.image(w / 2, h / 2, imgKey);
        const scale = Math.max(w / img.width, h / img.height);
        img.setScale(scale).setAlpha(0.85);
      }
    } else {
      // Twinkling procedural stars & planet accent
      for (let i = 0; i < 42; i++) {
        const sx = ((i * 137) % 100) * (w / 100);
        const sy = ((i * 73) % 100) * (h / 100);
        const star = this.add.circle(sx, sy, (i % 3) + 1, 0xffffff, 0.35 + (i % 4) * 0.15);
        this.tweens.add({
          targets: star,
          alpha: 0.12,
          duration: 1400 + (i % 5) * 400,
          yoyo: true,
          repeat: -1,
        });
      }
      this.add.circle(w * 0.86, h * 0.2, Math.min(w, h) * 0.12, pal.accent, 0.18);
      this.add.circle(w * 0.12, h * 0.84, Math.min(w, h) * 0.15, pal.border, 0.12);
    }

    for (const [idx, layer] of (this.sceneCfg?.parallax ?? []).entries()) {
      const pKey = `scene_px_${this.sceneCfg?.id}_${idx}`;
      if (this.textures.exists(pKey)) {
        const tile = this.add.tileSprite(w / 2, h / 2, w, h, pKey).setAlpha(0.5);
        this.parallaxSprites.push({ tile, speed: layer.speed || 0.4 });
      }
    }

    // 2. Grid sizing
    const { map, robot_start } = this.mission;
    const pad = 28;
    this.cellSize = Math.max(
      34,
      Math.min(82, Math.floor(Math.min((w - pad * 2) / map.width, (h - pad * 2) / map.height))),
    );
    const boardW = map.width * this.cellSize;
    const boardH = map.height * this.cellSize;
    this.originX = Math.floor((w - boardW) / 2);
    this.originY = Math.floor((h - boardH) / 2);

    this.worldGroup = this.add.container(0, 0);

    // 3. Tiles
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const t = tileAt(this.mission, x, y);
        if (t === '_') continue;
        const cx = this.originX + x * this.cellSize;
        const cy = this.originY + y * this.cellSize;
        const cs = this.cellSize;

        if (t === 'O') {
          // Energy void / gap
          const gap = this.add.graphics();
          gap.fillStyle(0x020617, 0.9);
          gap.fillRoundedRect(cx + 3, cy + 3, cs - 6, cs - 6, 8);
          gap.lineStyle(2, 0xf43f5e, 0.7);
          gap.strokeRoundedRect(cx + 3, cy + 3, cs - 6, cs - 6, 8);
          this.worldGroup.add(gap);
          continue;
        }

        const tile = this.add.graphics();
        tile.fillStyle(pal.floor, 0.95);
        tile.fillRoundedRect(cx + 2, cy + 2, cs - 4, cs - 4, 8);
        tile.lineStyle(1.5, pal.border, 0.35);
        tile.strokeRoundedRect(cx + 2, cy + 2, cs - 4, cs - 4, 8);
        this.worldGroup.add(tile);

        const midX = cx + cs / 2;
        const midY = cy + cs / 2;

        if (t === '#') {
          const wall = this.add.graphics();
          wall.fillStyle(0x475569, 1);
          wall.fillRoundedRect(cx + 5, cy + 5, cs - 10, cs - 10, 7);
          wall.lineStyle(2, 0x94a3b8, 0.8);
          wall.strokeRoundedRect(cx + 5, cy + 5, cs - 10, cs - 10, 7);
          this.worldGroup.add(wall);
        } else if (t === 'H') {
          const hurdle = this.add.graphics();
          hurdle.fillStyle(0xf97316, 1);
          hurdle.fillRoundedRect(cx + 8, midY - cs * 0.14, cs - 16, cs * 0.28, 5);
          hurdle.lineStyle(2, 0xfef08a, 0.9);
          hurdle.strokeRoundedRect(cx + 8, midY - cs * 0.14, cs - 16, cs * 0.28, 5);
          this.worldGroup.add(hurdle);
        } else if (t === 'G') {
          const ring = this.add.circle(midX, midY, cs * 0.3, 0x22c55e, 0.3);
          ring.setStrokeStyle(3, 0x4ade80, 1);
          const inner = this.add.circle(midX, midY, cs * 0.14, 0x4ade80, 0.95);
          this.worldGroup.add([ring, inner]);
          this.tweens.add({ targets: ring, scale: 1.15, alpha: 0.65, duration: 850, yoyo: true, repeat: -1 });
        } else if (t === 'D') {
          const doorC = this.add.container(midX, midY);
          const bar = this.add.rectangle(0, 0, cs * 0.72, cs * 0.72, 0xe11d48, 0.85);
          bar.setStrokeStyle(2.5, 0xfda4af, 1);
          const lock = this.add.circle(0, 0, cs * 0.12, 0xfef08a);
          doorC.add([bar, lock]);
          this.doorNodes.push(doorC);
          this.worldGroup.add(doorC);
        }
      }
    }

    // 4. Interactive objects (crystals, generators, friends)
    map.crystals.forEach((pos, idx) => {
      const c = this.cellCenter(pos);
      const container = this.add.container(c.x, c.y);
      const diamond = this.add.polygon(0, 0, [0, -14, 11, 0, 0, 14, -11, 0], 0x38bdf8, 1);
      diamond.setStrokeStyle(2, 0xe0f2fe, 1);
      diamond.setScale(this.cellSize / 64);
      container.add(diamond);
      this.tweens.add({ targets: diamond, y: -4, duration: 750, yoyo: true, repeat: -1 });
      this.crystalNodes.set(idx, container);
      this.worldGroup?.add(container);
    });

    map.generators.forEach((pos, idx) => {
      const c = this.cellCenter(pos);
      const container = this.add.container(c.x, c.y);
      const padRect = this.add.rectangle(0, 0, this.cellSize * 0.56, this.cellSize * 0.56, 0x78350f, 0.9);
      padRect.setStrokeStyle(2.5, 0xf59e0b, 1);
      const core = this.add.circle(0, 0, this.cellSize * 0.16, 0xfbbf24, 1);
      container.add([padRect, core]);
      this.generatorNodes.set(idx, container);
      this.worldGroup?.add(container);
    });

    map.friends.forEach((pos, idx) => {
      const c = this.cellCenter(pos);
      const container = this.add.container(c.x, c.y);
      const mini = this.add.rectangle(0, 0, this.cellSize * 0.44, this.cellSize * 0.44, 0xf472b6, 1);
      mini.setStrokeStyle(2, 0xffffff, 1);
      const eyeL = this.add.circle(-5, -3, 2.5, 0x0f172a);
      const eyeR = this.add.circle(5, -3, 2.5, 0x0f172a);
      container.add([mini, eyeL, eyeR]);
      this.tweens.add({ targets: container, scale: 1.08, duration: 700, yoyo: true, repeat: -1 });
      this.friendNodes.set(idx, container);
      this.worldGroup?.add(container);
    });

    // 5. Robot setup
    let texKey = '';
    if (this.robotCfg?.kind === 'spritesheet' && this.robotCfg.sprite_url) {
      const customKey = `robot_sheet_${this.robotCfg.id}`;
      if (this.textures.exists(customKey)) texKey = customKey;
    }
    if (!texKey) {
      const color = this.robotCfg?.primary_color || '#38bdf8';
      const style = this.robotCfg?.builtin_style || 'bolt';
      texKey = `builtin_robot_${style}_${color.replace('#', '')}`;
      ensureBuiltinRobotSheet(this, texKey, color, style);
    }

    this.animPrefix = `anim_${texKey}`;
    registerRobotAnims(this, texKey, this.animPrefix, this.robotCfg?.animations ?? BUILTIN_ANIMATIONS);

    const startPx = this.cellCenter(robot_start);
    this.robotContainer = this.add.container(startPx.x, startPx.y);

    this.robotSprite = this.add.sprite(0, 0, texKey, 0);
    const frameW = this.robotSprite.width || 96;
    const baseScale = (this.cellSize * 0.85) / frameW;
    this.robotSprite.setScale(baseScale * (this.robotCfg?.scale || 1));

    // Clear facing indicator arrow around the robot
    this.dirArrow = this.add.triangle(0, 0, -6, -6, 9, 0, -6, 6, 0xfbbf24, 0.95);
    this.dirArrow.setStrokeStyle(1.5, 0x0f172a, 1);
    this.updateDirArrow(robot_start.dir);

    this.robotContainer.add([this.robotSprite, this.dirArrow]);
    this.playRobotState('idle');
  }

  private updateDirArrow(dir: Direction) {
    if (!this.dirArrow) return;
    const dist = this.cellSize * 0.4;
    const rad = Phaser.Math.DegToRad(DIR_ANGLE[dir]);
    this.dirArrow.setPosition(Math.cos(rad) * dist, Math.sin(rad) * dist);
    this.dirArrow.setAngle(DIR_ANGLE[dir]);
  }

  private playRobotState(state: string) {
    if (!this.robotSprite) return;
    const key = `${this.animPrefix}:${state}`;
    if (this.anims.exists(key)) {
      this.robotSprite.play(key, true);
    }
  }

  public async playTrace(result: ExecutionResult, callbacks: ScenePlayCallbacks = {}): Promise<void> {
    this.resetBoard();
    const token = this.playbackToken;
    const stepMs = Math.max(120, Math.min(1200, this.robotCfg?.move_speed_ms ?? 450));

    for (let i = 0; i < result.trace.length; i++) {
      if (token !== this.playbackToken) return;
      while (this.isPausedState && token === this.playbackToken) {
        await this.waitMs(80);
      }
      if (token !== this.playbackToken) return;

      const ev = result.trace[i];
      callbacks.onStep?.(ev, i);
      await this.playTraceEvent(ev, stepMs, token);
    }

    if (token !== this.playbackToken) return;
    if (result.success) {
      this.playRobotState(this.completionAnim);
      this.spawnSuccessSparkles();
    } else {
      this.playRobotState('fail');
    }
    await this.waitMs(350);
    if (token === this.playbackToken) {
      callbacks.onComplete?.(result);
    }
  }

  private async playTraceEvent(ev: TraceEvent, stepMs: number, token: number): Promise<void> {
    if (!this.robotContainer || token !== this.playbackToken) return;

    switch (ev.kind) {
      case 'move': {
        this.playRobotState('walk');
        this.updateDirArrow(ev.dir);
        const dest = this.cellCenter(ev.to);
        await this.tweenPromise({
          targets: this.robotContainer,
          x: dest.x,
          y: dest.y,
          duration: stepMs,
          ease: 'Sine.easeInOut',
        });
        this.playRobotState('idle');
        break;
      }
      case 'turn': {
        this.playRobotState('turn');
        await this.waitMs(Math.round(stepMs * 0.45));
        this.updateDirArrow(ev.to_dir);
        await this.waitMs(Math.round(stepMs * 0.25));
        this.playRobotState('idle');
        break;
      }
      case 'jump': {
        this.playRobotState('jump');
        this.updateDirArrow(ev.dir);
        const dest = this.cellCenter(ev.to);
        await Promise.all([
          this.tweenPromise({
            targets: this.robotContainer,
            x: dest.x,
            y: dest.y,
            duration: stepMs * 1.15,
            ease: 'Quad.easeInOut',
          }),
          this.tweenPromise({
            targets: this.robotSprite,
            y: -this.cellSize * 0.45,
            scaleX: (this.robotSprite?.scaleX ?? 1) * 1.15,
            scaleY: (this.robotSprite?.scaleY ?? 1) * 1.15,
            duration: (stepMs * 1.15) / 2,
            yoyo: true,
            ease: 'Quad.easeOut',
          }),
        ]);
        this.playRobotState('idle');
        break;
      }
      case 'wave': {
        this.playRobotState('wave');
        await this.waitMs(650);
        this.playRobotState('idle');
        break;
      }
      case 'celebrate': {
        this.playRobotState('celebrate');
        this.spawnSuccessSparkles();
        await this.waitMs(750);
        this.playRobotState('idle');
        break;
      }
      case 'wait': {
        this.playRobotState('idle');
        await this.waitMs(Math.min(2000, ev.seconds * 550));
        break;
      }
      case 'pickup': {
        this.playRobotState('wave');
        const map = ev.item === 'crystal' ? this.crystalNodes : this.friendNodes;
        const node = map.get(ev.index);
        if (node) {
          await this.tweenPromise({
            targets: node,
            y: node.y - 24,
            alpha: 0,
            scale: 1.4,
            duration: 360,
            ease: 'Back.easeIn',
          });
          node.setVisible(false);
        }
        this.playRobotState('idle');
        break;
      }
      case 'pickup_none':
      case 'activate_none': {
        await this.tweenPromise({
          targets: this.robotContainer,
          angle: -8,
          duration: 120,
          yoyo: true,
        });
        this.robotContainer.setAngle(0);
        break;
      }
      case 'activate': {
        this.playRobotState('wave');
        const node = this.generatorNodes.get(ev.index);
        if (node) {
          const core = node.getAt(1) as Phaser.GameObjects.Arc | undefined;
          core?.setFillStyle(0x4ade80, 1);
        }
        if (ev.doors_open) {
          for (const d of this.doorNodes) {
            await this.tweenPromise({ targets: d, alpha: 0.15, scale: 0.4, duration: 300 });
          }
        }
        await this.waitMs(260);
        this.playRobotState('idle');
        break;
      }
      case 'bump': {
        this.playRobotState('fail');
        const target = this.cellCenter(ev.target);
        const start = { x: this.robotContainer.x, y: this.robotContainer.y };
        await this.tweenPromise({
          targets: this.robotContainer,
          x: start.x + (target.x - start.x) * 0.28,
          y: start.y + (target.y - start.y) * 0.28,
          duration: 130,
          yoyo: true,
        });
        this.cameras.main.shake(220, 0.01);
        break;
      }
      case 'fall': {
        this.playRobotState('fail');
        await this.tweenPromise({
          targets: this.robotContainer,
          scale: 0.1,
          alpha: 0,
          angle: 220,
          duration: 420,
          ease: 'Quad.easeIn',
        });
        break;
      }
    }
  }

  private spawnSuccessSparkles() {
    if (!this.robotContainer) return;
    const { x, y } = this.robotContainer;
    const colors = [0x38bdf8, 0xfbbf24, 0x4ade80, 0xf472b6];
    for (let i = 0; i < 14; i++) {
      const dot = this.add.circle(x, y, 4, colors[i % colors.length]);
      const angle = (Math.PI * 2 * i) / 14;
      const dist = 28 + (i % 3) * 14;
      this.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        scale: 0.2,
        duration: 600,
        onComplete: () => dot.destroy(),
      });
    }
  }

  private tweenPromise(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => {
      this.tweens.add({
        ...config,
        onComplete: () => resolve(),
      });
    });
  }

  private waitMs(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.time.delayedCall(ms, () => resolve());
    });
  }
}
