import * as Blockly from 'blockly';
import { DEFAULT_BLOCKS, HARD_LIMITS, PARAM_OF } from '@engine';
import type { BlockDefinition, CommandType, Lang } from '@engine';
import { pickLocalized } from '@/utils/localize';

export const BLOCK_TYPE_PREFIX = 'fra_';

export function blockTypeFor(cmd: CommandType): string {
  return `${BLOCK_TYPE_PREFIX}${cmd}`;
}

export function commandTypeFromBlock(blockType: string): CommandType | null {
  if (!blockType.startsWith(BLOCK_TYPE_PREFIX)) return null;
  const raw = blockType.slice(BLOCK_TYPE_PREFIX.length);
  return DEFAULT_BLOCKS.some((b) => b.command_type === raw) ? (raw as CommandType) : null;
}

const PARAM_FIELD_NAME: Record<'steps' | 'times' | 'seconds', string> = {
  steps: 'STEPS',
  times: 'TIMES',
  seconds: 'SECONDS',
};

let currentBlockDefs: BlockDefinition[] = DEFAULT_BLOCKS;
let currentLangRef: Lang = 'th';
let currentFallbackRef: Lang = 'en';

export function registerRobotBlocks(defs: BlockDefinition[], lang: Lang, fallback: Lang = 'en') {
  currentBlockDefs = defs.length > 0 ? defs : DEFAULT_BLOCKS;
  currentLangRef = lang;
  currentFallbackRef = fallback;

  for (const def of DEFAULT_BLOCKS) {
    const typeName = blockTypeFor(def.command_type);
    const activeDef = currentBlockDefs.find((b) => b.command_type === def.command_type) ?? def;
    const paramName = PARAM_OF[def.command_type];
    const pSpec = activeDef.params?.[0] ?? def.params?.[0];

    Blockly.Blocks[typeName] = {
      init(this: Blockly.Block) {
        const latestDef = currentBlockDefs.find((b) => b.command_type === def.command_type) ?? activeDef;
        const labelText = pickLocalized(
          latestDef.label,
          currentLangRef,
          currentFallbackRef,
          def.command_type,
        );
        const tooltipText = pickLocalized(latestDef.description, currentLangRef, currentFallbackRef, '');

        const input = this.appendDummyInput();
        input.appendField(new Blockly.FieldLabel(labelText), 'LABEL');

        if (paramName && pSpec) {
          const min = Math.max(1, pSpec.min);
          const max =
            paramName === 'steps'
              ? Math.min(HARD_LIMITS.MAX_STEPS, pSpec.max)
              : paramName === 'times'
                ? Math.min(HARD_LIMITS.MAX_REPEAT, pSpec.max)
                : Math.min(HARD_LIMITS.MAX_WAIT_SECONDS, pSpec.max);
          const val = Math.min(max, Math.max(min, pSpec.default));
          input.appendField(new Blockly.FieldNumber(val, min, max, 1), PARAM_FIELD_NAME[paramName]);
        }

        if (def.command_type === 'REPEAT') {
          this.appendStatementInput('DO');
        }

        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(latestDef.color || def.color);
        this.setTooltip(tooltipText);
      },
    };
  }
}

/**
 * Updates existing blocks on a live Blockly workspace in-place when language or
 * block labels change — preserving every block, parameter, and connection!
 */
export function refreshWorkspaceBlockLabels(
  workspace: Blockly.WorkspaceSvg,
  defs: BlockDefinition[],
  lang: Lang,
  fallback: Lang = 'en',
) {
  currentBlockDefs = defs.length > 0 ? defs : DEFAULT_BLOCKS;
  currentLangRef = lang;
  currentFallbackRef = fallback;

  Blockly.Events.disable();
  try {
    for (const block of workspace.getAllBlocks(false)) {
      const cmd = commandTypeFromBlock(block.type);
      if (!cmd) continue;
      const def = currentBlockDefs.find((b) => b.command_type === cmd);
      if (!def) continue;
      const labelField = block.getField('LABEL');
      if (labelField) {
        labelField.setValue(pickLocalized(def.label, lang, fallback, cmd));
      }
      block.setTooltip(pickLocalized(def.description, lang, fallback, ''));
      block.setColour(def.color);
    }
  } finally {
    Blockly.Events.enable();
  }
}

export { PARAM_FIELD_NAME };
