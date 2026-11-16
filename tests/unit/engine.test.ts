import { describe, expect, it } from 'vitest';
import {
  SAMPLE_LEVELS,
  computeMissionScore,
  DEFAULT_SCORE_RULES,
  evaluateSubmission,
  parseProgram,
  runProgram,
  validateMission,
} from '@engine';
import type { Command, MissionSpec } from '@engine';

const level = (code: string) => SAMPLE_LEVELS.find((l) => l.code === code)!;

describe('sample levels', () => {
  for (const lvl of SAMPLE_LEVELS) {
    it(`${lvl.code} has a structurally valid mission`, () => {
      expect(validateMission(lvl.mission)).toEqual([]);
    });
    lvl.solutions.forEach((sol, i) => {
      it(`${lvl.code} solution #${i + 1} succeeds`, () => {
        const out = evaluateSubmission(lvl.mission, sol);
        expect(out.status).toBe('EXECUTED');
        if (out.status === 'EXECUTED') {
          expect(out.result.failure).toBeUndefined();
          expect(out.result.success).toBe(true);
        }
      });
    });
  }
});

describe('interpreter semantics', () => {
  const l2 = level('level_02').mission;

  it('walking into a hurdle fails with HIT_HURDLE and does not succeed', () => {
    const r = runProgram(l2, [{ type: 'MOVE_FORWARD', steps: 6 }]);
    expect(r.success).toBe(false);
    expect(r.failure?.code).toBe('HIT_HURDLE');
    expect(r.trace.at(-1)?.kind).toBe('bump');
  });

  it('jumping over a hurdle lands two cells ahead', () => {
    const r = runProgram(l2, [{ type: 'MOVE_FORWARD', steps: 2 }, { type: 'JUMP' }]);
    expect(r.final.x).toBe(4);
  });

  it('falling into a gap fails', () => {
    const l8 = level('level_08').mission;
    const r = runProgram(l8, [{ type: 'MOVE_FORWARD', steps: 3 }]);
    expect(r.failure?.code).toBe('FELL_IN_GAP');
    expect(r.trace.at(-1)?.kind).toBe('fall');
  });

  it('walking off the edge is a HIT_EDGE', () => {
    const r = runProgram(level('level_01').mission, [{ type: 'MOVE_BACKWARD', steps: 1 }]);
    expect(r.failure?.code).toBe('HIT_EDGE');
  });

  it('a closed door blocks until the generator is activated', () => {
    const l6 = level('level_06').mission;
    const blocked = runProgram(l6, [{ type: 'MOVE_FORWARD', steps: 6 }]);
    expect(blocked.failure?.code).toBe('DOOR_CLOSED');
    const ok = runProgram(l6, [
      { type: 'MOVE_FORWARD', steps: 2 },
      { type: 'ACTIVATE' },
      { type: 'MOVE_FORWARD', steps: 4 },
    ]);
    expect(ok.success).toBe(true);
  });

  it('finishing without meeting the objectives reports OBJECTIVES_INCOMPLETE', () => {
    const r = runProgram(level('level_01').mission, [{ type: 'MOVE_FORWARD', steps: 2 }]);
    expect(r.success).toBe(false);
    expect(r.failure?.code).toBe('OBJECTIVES_INCOMPLETE');
    expect(r.objectives[0].done).toBe(false);
  });

  it('accepts different programs that reach the same state', () => {
    const a = runProgram(level('level_05').mission, level('level_05').solutions[0]);
    const b = runProgram(level('level_05').mission, level('level_05').solutions[1]);
    expect(a.success && b.success).toBe(true);
  });

  it('repeat expands deterministically', () => {
    const r = runProgram(level('level_09').mission, level('level_09').solutions[0]);
    expect(r.success).toBe(true);
    expect(r.steps_executed).toBe(20);
  });

  it('is deterministic', () => {
    const sol = level('level_10').solutions[0];
    const a = runProgram(level('level_10').mission, sol);
    const b = runProgram(level('level_10').mission, sol);
    expect(a).toEqual(b);
  });

  it('celebrating away from the goal does not count', () => {
    const l = level('level_10');
    const sol = l.solutions[0].filter((c) => c.type !== 'CELEBRATE');
    const r = runProgram(l.mission, [...sol.slice(0, 2), { type: 'CELEBRATE' }]);
    expect(r.success).toBe(false);
  });
});

describe('program validation', () => {
  const rules = level('level_09').mission.rules;

  it('rejects non-arrays and empty programs', () => {
    expect(parseProgram('MOVE_FORWARD', rules).ok).toBe(false);
    expect(parseProgram([], rules)).toMatchObject({ ok: false, issues: [{ code: 'EMPTY_PROGRAM' }] });
  });

  it('rejects unknown commands, extra properties and code injection', () => {
    expect(parseProgram([{ type: 'RUN_JS' }], rules)).toMatchObject({ ok: false });
    expect(parseProgram([{ type: 'MOVE_FORWARD', steps: 1, code: 'alert(1)' }], rules)).toMatchObject({
      ok: false,
    });
    expect(parseProgram([{ type: 'MOVE_FORWARD', steps: '1; process.exit()' }], rules)).toMatchObject({
      ok: false,
    });
  });

  it('rejects commands the level does not allow', () => {
    const r = parseProgram([{ type: 'JUMP' }, { type: 'REPEAT', times: 2, body: [{ type: 'JUMP' }] }], rules);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.some((i) => i.code === 'COMMAND_NOT_ALLOWED')).toBe(true);
  });

  it('enforces parameter ranges and integers', () => {
    for (const steps of [0, -1, 11, 1.5, NaN, Infinity]) {
      expect(
        parseProgram(
          [
            { type: 'MOVE_FORWARD', steps },
            { type: 'REPEAT', times: 2, body: [{ type: 'MOVE_FORWARD', steps: 1 }] },
          ],
          rules,
        ).ok,
      ).toBe(false);
    }
    expect(
      parseProgram([{ type: 'REPEAT', times: 21, body: [{ type: 'MOVE_FORWARD', steps: 1 }] }], rules).ok,
    ).toBe(false);
    expect(
      parseProgram([{ type: 'REPEAT', times: 1000000, body: [{ type: 'MOVE_FORWARD', steps: 1 }] }], rules)
        .ok,
    ).toBe(false);
  });

  it('enforces the block limit', () => {
    const many: Command[] = Array.from({ length: 9 }, () => ({ type: 'MOVE_FORWARD', steps: 1 }));
    const r = parseProgram([{ type: 'REPEAT', times: 2, body: many }], rules);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.some((i) => i.code === 'TOO_MANY_BLOCKS')).toBe(true);
  });

  it('enforces required commands', () => {
    const r = parseProgram([{ type: 'MOVE_FORWARD', steps: 1 }], rules);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0].code).toBe('MISSING_REQUIRED');
  });

  it('rejects empty repeat bodies and excessive nesting', () => {
    const r = { ...rules, max_blocks: 30, required_commands: [] };
    expect(parseProgram([{ type: 'REPEAT', times: 2, body: [] }], r).ok).toBe(false);
    const deep: Command = {
      type: 'REPEAT',
      times: 2,
      body: [
        {
          type: 'REPEAT',
          times: 2,
          body: [
            {
              type: 'REPEAT',
              times: 2,
              body: [{ type: 'REPEAT', times: 2, body: [{ type: 'MOVE_FORWARD', steps: 1 }] }],
            },
          ],
        },
      ],
    };
    const res = parseProgram([deep], r);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.issues.some((i) => i.code === 'TOO_DEEP')).toBe(true);
  });

  it('caps execution so nested loops cannot hang the server', () => {
    const mission: MissionSpec = {
      ...level('level_01').mission,
      rules: { allowed_commands: ['REPEAT', 'WAIT'], max_blocks: 30 },
    };
    const prog: Command[] = [
      {
        type: 'REPEAT',
        times: 20,
        body: [
          {
            type: 'REPEAT',
            times: 20,
            body: [{ type: 'REPEAT', times: 20, body: [{ type: 'WAIT', seconds: 1 }] }],
          },
        ],
      },
    ];
    const out = evaluateSubmission(mission, prog);
    expect(out.status).toBe('EXECUTED');
    if (out.status === 'EXECUTED') {
      expect(out.result.failure?.code).toBe('TOO_MANY_STEPS');
      expect(out.result.steps_executed).toBeLessThanOrEqual(401);
    }
  });

  it('keeps block ids for highlighting and strips nothing else', () => {
    const r = parseProgram([{ type: 'MOVE_FORWARD', steps: 3, id: 'abc' }], {
      allowed_commands: ['MOVE_FORWARD'],
      max_blocks: 3,
    });
    expect(r).toMatchObject({ ok: true, commands: [{ type: 'MOVE_FORWARD', steps: 3, id: 'abc' }] });
  });
});

describe('scoring', () => {
  const rules = DEFAULT_SCORE_RULES;
  const lv = { max_score: 200 };

  it('awards the full default score for a perfect, fast run', () => {
    const s = computeMissionScore({ rules, level: lv, hintsUsed: 0, failedAttempts: 0, elapsedMs: 10_000 });
    expect(s.total).toBe(200);
  });

  it('subtracts hint penalties and removes the no-hint bonus', () => {
    const s = computeMissionScore({ rules, level: lv, hintsUsed: 2, failedAttempts: 0, elapsedMs: 10_000 });
    expect(s.no_hint_bonus).toBe(0);
    expect(s.hint_penalty).toBe(20);
    expect(s.total).toBe(100 + 20 + 50 - 20);
  });

  it('removes the no-error bonus after failed attempts', () => {
    const s = computeMissionScore({ rules, level: lv, hintsUsed: 0, failedAttempts: 3, elapsedMs: 10_000 });
    expect(s.no_error_bonus).toBe(0);
    expect(s.total).toBe(180);
  });

  it('decays the time bonus linearly and never goes negative', () => {
    const mid = computeMissionScore({
      rules,
      level: lv,
      hintsUsed: 0,
      failedAttempts: 0,
      elapsedMs: 105_000,
    });
    expect(mid.time_bonus).toBe(25);
    const slow = computeMissionScore({
      rules,
      level: lv,
      hintsUsed: 0,
      failedAttempts: 0,
      elapsedMs: 10 * 60_000,
    });
    expect(slow.time_bonus).toBe(0);
    const awful = computeMissionScore({
      rules,
      level: lv,
      hintsUsed: 99,
      failedAttempts: 9,
      elapsedMs: 10 * 60_000,
    });
    expect(awful.total).toBe(0);
  });

  it('caps at the level maximum', () => {
    const s = computeMissionScore({
      rules: { ...rules, mission_base: 500 },
      level: lv,
      hintsUsed: 0,
      failedAttempts: 0,
      elapsedMs: 0,
    });
    expect(s.total).toBe(200);
  });

  it('ignores garbage inputs', () => {
    const s = computeMissionScore({ rules, level: lv, hintsUsed: -5, failedAttempts: NaN, elapsedMs: -1 });
    expect(s.total).toBeLessThanOrEqual(200);
    expect(s.total).toBeGreaterThanOrEqual(0);
  });
});

describe('validateMission', () => {
  it('detects bad maps', () => {
    const m = structuredClone(level('level_01').mission);
    m.map.rows[1] = '....';
    m.map.crystals = [{ x: 99, y: 0 }];
    expect(validateMission(m).length).toBeGreaterThan(0);
  });
});
