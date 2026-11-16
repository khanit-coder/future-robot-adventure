import { useEffect, useRef } from 'react';
import type { MissionSpec, RobotConfig, SceneConfig } from '@engine';
import { RobotGameEngine } from '@/game-engine/RobotGameEngine';

interface PhaserViewportProps {
  mission: MissionSpec;
  robot?: RobotConfig | null;
  scene?: SceneConfig | null;
  completionAnimation?: 'celebrate' | 'wave' | 'jump';
  onEngineReady?: (engine: RobotGameEngine | null) => void;
  className?: string;
}

export function PhaserViewport({
  mission,
  robot,
  scene,
  completionAnimation = 'celebrate',
  onEngineReady,
  className = '',
}: PhaserViewportProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<RobotGameEngine | null>(null);
  const onReadyRef = useRef(onEngineReady);

  useEffect(() => {
    onReadyRef.current = onEngineReady;
  }, [onEngineReady]);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    try {
      const engine = new RobotGameEngine(el);
      engineRef.current = engine;
      onReadyRef.current?.(engine);
    } catch (e) {
      // Headless environments without Canvas/WebGL fall back gracefully without crashing
      console.warn('Phaser initialization skipped:', e);
    }
    return () => {
      onReadyRef.current?.(null);
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    void engine.loadMission({ mission, robot, scene, completionAnimation });
  }, [mission, robot, scene, completionAnimation]);

  return (
    <div
      ref={hostRef}
      data-testid="phaser-viewport"
      className={`relative h-full w-full min-h-[280px] overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 ${className}`}
    />
  );
}
