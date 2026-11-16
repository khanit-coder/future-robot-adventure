import { CATEGORY_OF, HARD_LIMITS, HAS_BODY, PARAM_OF, countBlocks, isCommandType, limitFor } from './commands.ts';
import type { ParamLimits } from './commands.ts';
import type { Command, CommandType, MissionRules, ProgramParseResult, ValidationIssue } from './types.ts';

const ALLOWED_KEYS = new Set(['type', 'steps', 'times', 'seconds', 'body', 'id']);

/**
 * Parse UNTRUSTED input (from the browser) into a strictly typed program.
 * Unknown properties are dropped, every parameter is range-checked, nesting and size are bounded.
 * This never evaluates anything — it only copies whitelisted, validated values.
 */
export function parseProgram(
  input: unknown,
  rules: MissionRules,
  limits?: ParamLimits,
): ProgramParseResult {
  const issues: ValidationIssue[] = [];
  const allowed = new Set<CommandType>(rules.allowed_commands);
  const maxBlocks = Math.min(rules.max_blocks, HARD_LIMITS.MAX_BLOCKS);

  if (!Array.isArray(input)) {
    return { ok: false, issues: [{ code: 'MALFORMED' }] };
  }
  if (input.length === 0) {
    return { ok: false, issues: [{ code: 'EMPTY_PROGRAM' }] };
  }

  let seen = 0;
  const walk = (list: unknown[], depth: number): Command[] => {
    const out: Command[] = [];
    for (const raw of list) {
      seen += 1;
      if (seen > HARD_LIMITS.MAX_BLOCKS * 2) {
        // Stop scanning absurdly large payloads early.
        if (!issues.some((i) => i.code === 'TOO_MANY_BLOCKS')) {
          issues.push({ code: 'TOO_MANY_BLOCKS', params: { max: maxBlocks } });
        }
        return out;
      }
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        issues.push({ code: 'MALFORMED' });
        continue;
      }
      const obj = raw as Record<string, unknown>;
      for (const k of Object.keys(obj)) {
        if (!ALLOWED_KEYS.has(k)) {
          issues.push({ code: 'MALFORMED' });
          break;
        }
      }
      const type = obj.type;
      if (!isCommandType(type)) {
        issues.push({ code: 'UNKNOWN_COMMAND' });
        continue;
      }
      if (!allowed.has(type)) {
        issues.push({ code: 'COMMAND_NOT_ALLOWED', params: { command: type } });
        continue;
      }
      const cmd: Command = { type };
      if (typeof obj.id === 'string' && obj.id.length <= HARD_LIMITS.MAX_BODY_ID_LENGTH) {
        cmd.id = obj.id;
      }
      const param = PARAM_OF[type];
      if (param) {
        const range = limitFor(type, limits)!;
        const value = obj[param];
        if (typeof value !== 'number' || !Number.isInteger(value) || value < range.min || value > range.max) {
          issues.push({ code: 'PARAM_RANGE', params: { command: type, min: range.min, max: range.max } });
          continue;
        }
        cmd[param] = value;
      }
      if (HAS_BODY.has(type)) {
        if (!Array.isArray(obj.body) || obj.body.length === 0) {
          issues.push({ code: 'REPEAT_EMPTY' });
          continue;
        }
        if (depth > HARD_LIMITS.MAX_NESTING) {
          issues.push({ code: 'TOO_DEEP', params: { max: HARD_LIMITS.MAX_NESTING } });
          continue;
        }
        cmd.body = walk(obj.body, depth + 1);
      } else if (obj.body !== undefined) {
        issues.push({ code: 'MALFORMED' });
        continue;
      }
      out.push(cmd);
    }
    return out;
  };

  const commands = walk(input, 1);
  const blocks = countBlocks(commands);
  if (blocks > maxBlocks && !issues.some((i) => i.code === 'TOO_MANY_BLOCKS')) {
    issues.push({ code: 'TOO_MANY_BLOCKS', params: { max: maxBlocks } });
  }

  const present = new Set<CommandType>();
  const collect = (list: Command[]) => {
    for (const c of list) {
      present.add(c.type);
      if (c.body) collect(c.body);
    }
  };
  collect(commands);
  for (const req of rules.required_commands ?? []) {
    if (!present.has(req)) issues.push({ code: 'MISSING_REQUIRED', params: { command: req } });
  }

  if (issues.length > 0) return { ok: false, issues: dedupe(issues) };
  return { ok: true, commands, blocks };
}

function dedupe(issues: ValidationIssue[]): ValidationIssue[] {
  const seen = new Set<string>();
  return issues.filter((i) => {
    const key = JSON.stringify(i);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Category lookup re-exported for UI code that groups commands. */
export { CATEGORY_OF };
