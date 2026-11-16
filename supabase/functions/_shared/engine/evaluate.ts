import { limitsFromBlocks } from './commands.ts';
import { runProgram } from './interpreter.ts';
import { parseProgram } from './validate.ts';
import type { BlockDefinition, ExecutionResult, MissionSpec, ValidationIssue } from './types.ts';

export type EvaluationOutcome =
  | { status: 'INVALID'; issues: ValidationIssue[] }
  | { status: 'EXECUTED'; result: ExecutionResult };

/**
 * Single entry point shared by the server (authoritative) and the client (typing aids):
 * untrusted JSON in → validated → executed → result.
 */
export function evaluateSubmission(
  mission: MissionSpec,
  rawProgram: unknown,
  blocks?: BlockDefinition[],
): EvaluationOutcome {
  const parsed = parseProgram(rawProgram, mission.rules, limitsFromBlocks(blocks));
  if (!parsed.ok) return { status: 'INVALID', issues: parsed.issues };
  return { status: 'EXECUTED', result: runProgram(mission, parsed.commands, parsed.blocks) };
}
