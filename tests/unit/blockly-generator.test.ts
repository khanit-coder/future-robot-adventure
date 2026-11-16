import * as Blockly from 'blockly';
import { describe, expect, it } from 'vitest';
import { DEFAULT_BLOCKS, SAMPLE_LEVELS, evaluateSubmission } from '@engine';
import { registerRobotBlocks } from '@/blockly/blocks/robotBlocks';
import { workspaceToCommands } from '@/blockly/generators/jsonGenerator';

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
    } finally {
      ws.dispose();
    }
  });
});
