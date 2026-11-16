import type * as Blockly from 'blockly';
import { PARAM_OF, countBlocks } from '@engine';
import type { Command } from '@engine';
import { PARAM_FIELD_NAME, commandTypeFromBlock } from '@/blockly/blocks/robotBlocks';

/**
 * Safely convert a Blockly workspace into a structured `Command[]` JSON array.
 * Does NOT generate or execute JavaScript.
 */
export function workspaceToCommands(workspace: Blockly.Workspace): Command[] {
  const topBlocks = workspace.getTopBlocks(true);
  const commands: Command[] = [];
  for (const top of topBlocks) {
    commands.push(...chainToCommands(top));
  }
  return commands;
}

function chainToCommands(start: Blockly.Block | null): Command[] {
  const list: Command[] = [];
  let block: Blockly.Block | null = start;
  while (block) {
    if (!block.isEnabled()) {
      block = block.getNextBlock();
      continue;
    }
    const cmdType = commandTypeFromBlock(block.type);
    if (cmdType) {
      const cmd: Command = { type: cmdType, id: block.id };
      const param = PARAM_OF[cmdType];
      if (param) {
        const raw = block.getFieldValue(PARAM_FIELD_NAME[param]);
        const num = typeof raw === 'number' ? raw : Number(raw);
        if (Number.isFinite(num)) cmd[param] = Math.floor(num);
      }
      if (cmdType === 'REPEAT') {
        const inner = block.getInputTargetBlock('DO');
        cmd.body = chainToCommands(inner);
      }
      list.push(cmd);
    }
    block = block.getNextBlock();
  }
  return list;
}

export function workspaceBlockCount(workspace: Blockly.Workspace): number {
  return countBlocks(workspaceToCommands(workspace));
}
