import { HARD_LIMITS } from './commands.ts';
import type {
  Command,
  Direction,
  ExecutionResult,
  FailureCode,
  FinalState,
  MissionSpec,
  ObjectiveStatus,
  Pos,
  TraceEvent,
} from './types.ts';

const VEC: Record<Direction, Pos> = {
  N: { x: 0, y: -1 },
  E: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 },
};
const LEFT: Record<Direction, Direction> = { N: 'W', W: 'S', S: 'E', E: 'N' };
const RIGHT: Record<Direction, Direction> = { N: 'E', E: 'S', S: 'W', W: 'N' };

export function tileAt(mission: MissionSpec, x: number, y: number): string {
  const { map } = mission;
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return '_';
  return map.rows[y]?.[x] ?? '_';
}

const samePos = (a: Pos, b: Pos) => a.x === b.x && a.y === b.y;

/**
 * Deterministic grid interpreter.
 *
 * It takes an already validated program (see `parseProgram`) and a mission, and produces:
 *  - an execution trace that the Phaser scene plays back, and
 *  - the final world state used to decide whether the mission objectives were met.
 *
 * Success is decided purely from the resulting game state, so any program that achieves the
 * objectives is accepted — not just one particular block arrangement.
 */
export function runProgram(mission: MissionSpec, program: Command[], blocksUsed = 0): ExecutionResult {
  const trace: TraceEvent[] = [];
  let x = mission.robot_start.x;
  let y = mission.robot_start.y;
  let dir: Direction = mission.robot_start.dir;
  const collected = new Set<number>();
  const rescued = new Set<number>();
  const activated = new Set<number>();
  let celebratedAtGoal = false;
  let failure: FailureCode | undefined;
  let steps = 0;

  const doorsOpen = () => activated.size >= mission.map.generators.length;
  const indexAt = (list: Pos[], p: Pos) => list.findIndex((c) => samePos(c, p));

  /** Attempt to enter a cell by walking. Returns true if the robot moved without failing. */
  const walkInto = (nx: number, ny: number, backwards: boolean, blockId?: string): boolean => {
    const t = tileAt(mission, nx, ny);
    const from = { x, y };
    const to = { x: nx, y: ny };
    const bump = (reason: FailureCode) => {
      trace.push({ kind: 'bump', at: from, target: to, reason, block_id: blockId });
      failure = reason;
      return false;
    };
    if (t === '_') return bump('HIT_EDGE');
    if (t === '#') return bump('HIT_WALL');
    if (t === 'H') return bump('HIT_HURDLE');
    if (t === 'D' && !doorsOpen()) return bump('DOOR_CLOSED');
    trace.push({ kind: 'move', from, to, dir, backwards, block_id: blockId });
    x = nx;
    y = ny;
    if (t === 'O') {
      trace.push({ kind: 'fall', from: to, to, block_id: blockId });
      failure = 'FELL_IN_GAP';
      return false;
    }
    return true;
  };

  const exec = (list: Command[]): boolean => {
    for (const cmd of list) {
      if (failure) return false;
      if (cmd.type === 'REPEAT') {
        const times = cmd.times ?? 1;
        for (let i = 0; i < times; i++) {
          if (!exec(cmd.body ?? [])) return false;
        }
        continue;
      }
      steps += 1;
      if (steps > HARD_LIMITS.MAX_EXEC_STEPS) {
        failure = 'TOO_MANY_STEPS';
        return false;
      }
      const id = cmd.id;
      switch (cmd.type) {
        case 'MOVE_FORWARD':
        case 'MOVE_BACKWARD': {
          const backwards = cmd.type === 'MOVE_BACKWARD';
          const v = VEC[dir];
          const sign = backwards ? -1 : 1;
          const n = cmd.steps ?? 1;
          for (let i = 0; i < n; i++) {
            if (!walkInto(x + v.x * sign, y + v.y * sign, backwards, id)) return false;
          }
          break;
        }
        case 'TURN_LEFT':
        case 'TURN_RIGHT': {
          const left = cmd.type === 'TURN_LEFT';
          const next = left ? LEFT[dir] : RIGHT[dir];
          trace.push({ kind: 'turn', side: left ? 'left' : 'right', from_dir: dir, to_dir: next, at: { x, y }, block_id: id });
          dir = next;
          break;
        }
        case 'JUMP': {
          const v = VEC[dir];
          const from = { x, y };
          const over = { x: x + v.x, y: y + v.y };
          const land = { x: x + v.x * 2, y: y + v.y * 2 };
          const overTile = tileAt(mission, over.x, over.y);
          const landTile = tileAt(mission, land.x, land.y);
          // You can leap over floor, hurdles and gaps — but not through walls, void or a closed door.
          const overBlocked = overTile === '_' || overTile === '#' || (overTile === 'D' && !doorsOpen());
          const landBlocked =
            landTile === '_' || landTile === '#' || landTile === 'H' || (landTile === 'D' && !doorsOpen());
          if (overBlocked || landBlocked) {
            trace.push({ kind: 'bump', at: from, target: overBlocked ? over : land, reason: 'JUMP_BLOCKED', block_id: id });
            failure = 'JUMP_BLOCKED';
            return false;
          }
          trace.push({ kind: 'jump', from, to: land, dir, block_id: id });
          x = land.x;
          y = land.y;
          if (landTile === 'O') {
            trace.push({ kind: 'fall', from: land, to: land, block_id: id });
            failure = 'FELL_IN_GAP';
            return false;
          }
          break;
        }
        case 'WAVE':
          trace.push({ kind: 'wave', at: { x, y }, dir, block_id: id });
          break;
        case 'CELEBRATE':
          trace.push({ kind: 'celebrate', at: { x, y }, dir, block_id: id });
          if (tileAt(mission, x, y) === 'G') celebratedAtGoal = true;
          break;
        case 'WAIT':
          trace.push({ kind: 'wait', seconds: cmd.seconds ?? 1, at: { x, y }, block_id: id });
          break;
        case 'PICK_UP': {
          const here = { x, y };
          const ci = indexAt(mission.map.crystals, here);
          const fi = indexAt(mission.map.friends, here);
          if (ci >= 0 && !collected.has(ci)) {
            collected.add(ci);
            trace.push({ kind: 'pickup', at: here, item: 'crystal', index: ci, block_id: id });
          } else if (fi >= 0 && !rescued.has(fi)) {
            rescued.add(fi);
            trace.push({ kind: 'pickup', at: here, item: 'friend', index: fi, block_id: id });
          } else {
            trace.push({ kind: 'pickup_none', at: here, block_id: id });
          }
          break;
        }
        case 'ACTIVATE': {
          const here = { x, y };
          const gi = indexAt(mission.map.generators, here);
          if (gi >= 0 && !activated.has(gi)) {
            activated.add(gi);
            trace.push({ kind: 'activate', at: here, index: gi, doors_open: doorsOpen(), block_id: id });
          } else {
            trace.push({ kind: 'activate_none', at: here, block_id: id });
          }
          break;
        }
        default:
          // Unreachable for validated programs; fail closed rather than ignore.
          failure = 'TOO_MANY_STEPS';
          return false;
      }
    }
    return true;
  };

  exec(program);

  const onGoal = tileAt(mission, x, y) === 'G';
  const objectives: ObjectiveStatus[] = mission.objectives.map((o) => {
    switch (o.type) {
      case 'REACH_GOAL':
        return { type: o.type, done: onGoal, current: onGoal ? 1 : 0, target: 1 };
      case 'COLLECT_CRYSTALS': {
        const target = Math.min(o.count ?? mission.map.crystals.length, mission.map.crystals.length);
        return { type: o.type, done: collected.size >= target, current: collected.size, target };
      }
      case 'ACTIVATE_GENERATORS': {
        const target = mission.map.generators.length;
        return { type: o.type, done: activated.size >= target, current: activated.size, target };
      }
      case 'RESCUE_FRIENDS': {
        const target = mission.map.friends.length;
        return { type: o.type, done: rescued.size >= target, current: rescued.size, target };
      }
      case 'CELEBRATE':
        return { type: o.type, done: celebratedAtGoal, current: celebratedAtGoal ? 1 : 0, target: 1 };
    }
  });

  const allDone = objectives.every((o) => o.done);
  const success = !failure && allDone;
  if (!failure && !allDone) failure = 'OBJECTIVES_INCOMPLETE';

  const final: FinalState = {
    x,
    y,
    dir,
    collected: [...collected].sort((a, b) => a - b),
    rescued: [...rescued].sort((a, b) => a - b),
    activated: [...activated].sort((a, b) => a - b),
    doors_open: doorsOpen(),
    celebrated_at_goal: celebratedAtGoal,
  };

  return {
    success,
    trace,
    objectives,
    failure: failure ? { code: failure } : undefined,
    final,
    steps_executed: steps,
    blocks_used: blocksUsed,
  };
}

/** Structural sanity checks for a mission, used when publishing. Returns human-readable problems. */
export function validateMission(mission: MissionSpec): string[] {
  const problems: string[] = [];
  const { map } = mission;
  if (!Number.isInteger(map.width) || !Number.isInteger(map.height) || map.width < 3 || map.height < 1 || map.width > 20 || map.height > 14) {
    problems.push('Map size must be between 3x1 and 20x14');
    return problems;
  }
  if (map.rows.length !== map.height) problems.push('Row count does not match map height');
  for (const [i, row] of map.rows.entries()) {
    if (row.length !== map.width) problems.push(`Row ${i + 1} width does not match map width`);
    if (!/^[.#HOGD_]*$/.test(row)) problems.push(`Row ${i + 1} contains unknown tile characters`);
  }
  const inMap = (p: Pos) => p.x >= 0 && p.y >= 0 && p.x < map.width && p.y < map.height;
  for (const [name, list] of [['crystal', map.crystals], ['generator', map.generators], ['friend', map.friends]] as const) {
    for (const p of list) {
      const t = tileAt(mission, p.x, p.y);
      if (!inMap(p) || t === '_' || t === '#' || t === 'O' || t === 'H') problems.push(`A ${name} is placed on an unreachable tile (${p.x},${p.y})`);
    }
  }
  const st = tileAt(mission, mission.robot_start.x, mission.robot_start.y);
  if (st === '_' || st === '#' || st === 'O' || st === 'H') problems.push('Robot start is on an invalid tile');
  if (mission.objectives.length === 0) problems.push('At least one objective is required');
  if (mission.objectives.some((o) => o.type === 'REACH_GOAL' || o.type === 'CELEBRATE') && !map.rows.some((r) => r.includes('G'))) {
    problems.push('Objective needs a goal tile but the map has none');
  }
  if (mission.rules.allowed_commands.length === 0) problems.push('At least one command must be allowed');
  if (mission.rules.max_blocks < 1 || mission.rules.max_blocks > HARD_LIMITS.MAX_BLOCKS) {
    problems.push(`max_blocks must be between 1 and ${HARD_LIMITS.MAX_BLOCKS}`);
  }
  return problems;
}
