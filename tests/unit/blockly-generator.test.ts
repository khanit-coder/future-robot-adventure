import * as Blockly from 'blockly';
import { describe, expect, it } from 'vitest';
import { DEFAULT_BLOCKS, SAMPLE_LEVELS, evaluateSubmission } from '@engine';
import { registerRobotBlocks } from '@/blockly/blocks/robotBlocks';
import { workspaceToCommands } from '@/blockly/generators/jsonGenerator';
import { generateRealCodeSamples } from '@/blockly/generators/codeTranspiler';
import {
  COLLEGE_NAME_TH,
  FACULTY_NAME_TH,
  buildCardDownloadUrl,
  parseCardParams,
} from '@/features/rewards/cardCanvas';

describe('Blockly workspace -> Command[] JSON generator', () => {
  it('extracts structured Command[] from a real headless Blockly workspace and evaluates it cleanly', () => {
    registerRobotBlocks(DEFAULT_BLOCKS, 'en', 'en');
    const ws = new Blockly.Workspace();
    try {
      Blockly.serialization.workspaces.load(
        {
          blocks: {
            languageVersion: 0,
            blocks: [
              {
                type: 'fra_REPEAT',
                id: 'b_repeat',
                fields: { TIMES: 5 },
                inputs: {
                  DO: {
                    block: {
                      type: 'fra_MOVE_FORWARD',
                      id: 'b_f1',
                      fields: { STEPS: 1 },
                      next: {
                        block: {
                          type: 'fra_TURN_LEFT',
                          id: 'b_l1',
                          next: {
                            block: {
                              type: 'fra_MOVE_FORWARD',
                              id: 'b_f2',
                              fields: { STEPS: 1 },
                              next: {
                                block: {
                                  type: 'fra_TURN_RIGHT',
                                  id: 'b_r1',
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            ],
          },
        },
        ws,
      );

      const cmds = workspaceToCommands(ws);
      expect(cmds).toEqual([
        {
          type: 'REPEAT',
          id: 'b_repeat',
          times: 5,
          body: [
            { type: 'MOVE_FORWARD', id: 'b_f1', steps: 1 },
            { type: 'TURN_LEFT', id: 'b_l1' },
            { type: 'MOVE_FORWARD', id: 'b_f2', steps: 1 },
            { type: 'TURN_RIGHT', id: 'b_r1' },
          ],
        },
      ]);

      // Solves Level 9 (Staircase Loop)!
      const level9 = SAMPLE_LEVELS.find((l) => l.code === 'level_09')!;
      const outcome = evaluateSubmission(level9.mission, cmds, DEFAULT_BLOCKS);
      expect(outcome.status).toBe('EXECUTED');
      if (outcome.status === 'EXECUTED') {
        expect(outcome.result.success).toBe(true);
      }

      // Real code transpiler generates Python, JavaScript, C++, and Java
      const samples = generateRealCodeSamples(cmds, 'level_09', 'th');
      expect(samples).toHaveLength(4);
      expect(samples.find((s) => s.id === 'python')?.code).toContain('for i in range(5):');
      expect(samples.find((s) => s.id === 'javascript')?.code).toContain('await robot.moveForward(1);');
      expect(samples.find((s) => s.id === 'cpp')?.code).toContain('robot.turnLeft();');
      expect(samples.find((s) => s.id === 'java')?.code).toContain('public class RobotMission');
    } finally {
      ws.dispose();
    }
  });

  it('encodes and decodes social media share card URL parameters with college & faculty names', () => {
    expect(COLLEGE_NAME_TH).toBe('วิทยาลัยเทคโนโลยีขอนแก่น P-TECH');
    expect(FACULTY_NAME_TH).toBe('คณะเทคโนโลยีสารสนเทศ');

    const url = buildCardDownloadUrl({
      name: 'ต้นกล้า',
      school: 'โรงเรียนสาธิต',
      score: 1850,
      levelsCompleted: 10,
      totalLevels: 10,
      heartsRemaining: 4,
      lang: 'th',
    });
    const search = url.slice(url.indexOf('?'));
    const parsed = parseCardParams(search);
    expect(parsed.name).toBe('ต้นกล้า');
    expect(parsed.school).toBe('โรงเรียนสาธิต');
    expect(parsed.score).toBe(1850);
    expect(parsed.levelsCompleted).toBe(10);
    expect(parsed.heartsRemaining).toBe(4);
  });
});
