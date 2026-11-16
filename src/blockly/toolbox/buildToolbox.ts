import * as Blockly from 'blockly';
import type { BlockDefinition, CommandType, Lang } from '@engine';
import { DEFAULT_BLOCKS } from '@engine';
import { blockTypeFor } from '@/blockly/blocks/robotBlocks';
import { pickLocalized } from '@/utils/localize';

const CATEGORY_LABELS: Record<'movement' | 'actions' | 'logic', Record<Lang, string>> = {
  movement: { en: 'Movement', th: 'การเคลื่อนที่' },
  actions: { en: 'Actions', th: 'การกระทำ' },
  logic: { en: 'Logic', th: 'ตรรกะ' },
};

const CATEGORY_COLORS: Record<'movement' | 'actions' | 'logic', string> = {
  movement: '#3b82f6',
  actions: '#f97316',
  logic: '#14b8a6',
};

export function buildBlocklyToolbox(
  blocks: BlockDefinition[],
  allowedCommands: CommandType[],
  lang: Lang,
): Blockly.utils.toolbox.ToolboxDefinition {
  const allowedSet = new Set(allowedCommands);
  const source = blocks.length > 0 ? blocks : DEFAULT_BLOCKS;
  const active = source
    .filter((b) => b.enabled && allowedSet.has(b.command_type))
    .sort((a, b) => a.position - b.position);

  const categories: ('movement' | 'actions' | 'logic')[] = ['movement', 'actions', 'logic'];
  const contents: Blockly.utils.toolbox.ToolboxItemInfo[] = [];

  for (const cat of categories) {
    const items = active.filter((b) => b.category === cat);
    if (items.length === 0) continue;
    contents.push({
      kind: 'category',
      name: CATEGORY_LABELS[cat][lang],
      colour: CATEGORY_COLORS[cat],
      contents: items.map((b) => ({
        kind: 'block',
        type: blockTypeFor(b.command_type),
        fields: b.params?.[0]
          ? {
              [b.params[0].name === 'steps' ? 'STEPS' : b.params[0].name === 'times' ? 'TIMES' : 'SECONDS']:
                b.params[0].default,
            }
          : undefined,
        extraState: undefined,
      })),
    });
  }

  return {
    kind: 'categoryToolbox',
    contents,
  };
}

/** Lookup localized block label for command guide / error messages. */
export function localizedBlockLabel(
  blocks: BlockDefinition[],
  cmd: CommandType,
  lang: Lang,
  fallback: Lang = 'en',
): string {
  const found = (blocks.length > 0 ? blocks : DEFAULT_BLOCKS).find((b) => b.command_type === cmd);
  return found ? pickLocalized(found.label, lang, fallback, cmd) : cmd;
}
