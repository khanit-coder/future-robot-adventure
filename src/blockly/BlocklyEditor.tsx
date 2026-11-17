import { useEffect, useRef } from 'react';
import * as Blockly from 'blockly';
import type { BlockDefinition, Command, CommandType, Lang } from '@engine';
import { refreshWorkspaceBlockLabels, registerRobotBlocks } from '@/blockly/blocks/robotBlocks';
import { workspaceToCommands } from '@/blockly/generators/jsonGenerator';
import { buildBlocklyToolbox } from '@/blockly/toolbox/buildToolbox';
import { sfx } from '@/services/audio/soundEffects';

interface BlocklyEditorProps {
  workspaceKey: string;
  blocks: BlockDefinition[];
  allowedCommands: CommandType[];
  lang: Lang;
  fallbackLang?: Lang;
  initialState?: Record<string, unknown> | null;
  highlightedBlockId?: string | null;
  readOnly?: boolean;
  onChange?: (commands: Command[], serialized: Record<string, unknown>) => void;
  resetSignal?: number;
}

export function BlocklyEditor({
  workspaceKey,
  blocks,
  allowedCommands,
  lang,
  fallbackLang = 'en',
  initialState,
  highlightedBlockId,
  readOnly = false,
  onChange,
  resetSignal = 0,
}: BlocklyEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const latestRef = useRef({
    onChange,
    initialState,
    blocks,
    allowedCommands,
    lang,
    fallbackLang,
  });

  useEffect(() => {
    latestRef.current = {
      onChange,
      initialState,
      blocks,
      allowedCommands,
      lang,
      fallbackLang,
    };
  }, [onChange, initialState, blocks, allowedCommands, lang, fallbackLang]);

  // Mount Blockly once per `workspaceKey` (i.e. per level). Never recreated on language change!
  useEffect(() => {
    const container = hostRef.current;
    if (!container) return;
    const snap = latestRef.current;

    registerRobotBlocks(snap.blocks, snap.lang, snap.fallbackLang);

    const workspace = Blockly.inject(container, {
      toolbox: buildBlocklyToolbox(snap.blocks, snap.allowedCommands, snap.lang),
      readOnly,
      trashcan: true,
      scrollbars: true,
      sounds: false,
      grid: { spacing: 24, length: 3, colour: '#e2e8f0', snap: true },
      zoom: {
        controls: true,
        wheel: false,
        startScale: 1.0,
        maxScale: 1.4,
        minScale: 0.7,
      },
      move: { scrollbars: true, drag: true, wheel: true },
      renderer: 'zelos',
    });

    wsRef.current = workspace;

    if (snap.initialState) {
      try {
        Blockly.serialization.workspaces.load(snap.initialState, workspace);
      } catch {
        workspace.clear();
      }
    }
    refreshWorkspaceBlockLabels(workspace, snap.blocks, snap.lang, snap.fallbackLang);

    const emit = () => {
      const cmds = workspaceToCommands(workspace);
      const serialized = Blockly.serialization.workspaces.save(workspace) as Record<string, unknown>;
      latestRef.current.onChange?.(cmds, serialized);
    };
    emit();

    const syncFlyoutScrollbar = () => {
      try {
        const flyout = workspace.getFlyout?.();
        if (flyout && !flyout.isVisible()) {
          flyout.getWorkspace?.()?.scrollbar?.setContainerVisible(false);
        }
      } catch {
        // Ignore internal Blockly state errors
      }
    };
    syncFlyoutScrollbar();

    const listener = (ev: Blockly.Events.Abstract) => {
      syncFlyoutScrollbar();
      if (ev.isUiEvent) return;
      if (ev.type === Blockly.Events.BLOCK_MOVE) {
        const moveEv = ev as Blockly.Events.BlockMove;
        if (moveEv.newParentId) {
          sfx.playSnap();
        }
      }
      emit();
    };
    workspace.addChangeListener(listener);

    const onFullscreenResize = () => {
      const isFs = typeof document !== 'undefined' && Boolean(document.fullscreenElement);
      workspace.setScale(isFs ? 1.15 : 1.0);
      Blockly.svgResize(workspace);
      syncFlyoutScrollbar();
    };
    document.addEventListener('fullscreenchange', onFullscreenResize);

    const resizeObserver = new ResizeObserver(() => {
      Blockly.svgResize(workspace);
      syncFlyoutScrollbar();
    });
    resizeObserver.observe(container);

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenResize);
      resizeObserver.disconnect();
      workspace.removeChangeListener(listener);
      workspace.dispose();
      wsRef.current = null;
    };
  }, [workspaceKey, readOnly]);

  // Language or block label update in-place: preserves all workspace blocks & connections!
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;
    ws.updateToolbox(buildBlocklyToolbox(blocks, allowedCommands, lang));
    refreshWorkspaceBlockLabels(ws, blocks, lang, fallbackLang);
  }, [blocks, allowedCommands, lang, fallbackLang]);

  // Highlight the block currently running during Phaser animation playback
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;
    ws.highlightBlock(highlightedBlockId ?? null);
  }, [highlightedBlockId]);

  // Explicit workspace reset signal
  useEffect(() => {
    if (resetSignal === 0) return;
    const ws = wsRef.current;
    if (!ws) return;
    ws.clear();
    const serialized = Blockly.serialization.workspaces.save(ws) as Record<string, unknown>;
    latestRef.current.onChange?.([], serialized);
  }, [resetSignal]);

  return (
    <div
      ref={hostRef}
      data-testid="blockly-editor"
      className="h-full w-full min-h-[340px] rounded-2xl overflow-hidden border border-slate-200 bg-white"
    />
  );
}
