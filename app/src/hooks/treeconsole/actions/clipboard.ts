/**
 * Clipboard actions for TreeConsole.
 */

import type { NodeId } from '@hierarchidb/common-types';
import type { TreeConsoleActionDeps } from '../types.js';
import {
  ensureClipboard,
  fireCmdEvent,
  showCommandError,
  type GlobalWithClipboard,
} from './helpers.ts';

export const createClipboardActions = (deps: TreeConsoleActionDeps) => {
  const { client, loadChildrenOf, pageNodeId, refreshUndoRedo, selectedIds, setSSOT, setState } =
    deps;

  const applyClipboard = (ids: NodeId[], cut: boolean) => {
    const clip = ensureClipboard();
    clip.nodeIds = [...ids];
    if (cut) {
      clip.cut = true;
    } else {
      delete clip.cut;
    }
    const canPaste = ids.length > 0;
    setState((prev) => ({ ...prev, canPaste }));
    setSSOT({ canPaste });
  };

  const handlePaste = async () => {
    if (!client) return;
    const clip = ensureClipboard();
    const ids = clip.nodeIds || [];
    const isCut = Boolean(clip.cut);
    if (ids.length === 0) return;
    try {
      const mutationAPI = await client.getMutationAPI();
      const toParentId = pageNodeId as NodeId;
      const res = isCut
        ? await mutationAPI.moveNodes({ nodeIds: ids as NodeId[], toParentId })
        : await mutationAPI.duplicateNodes({ nodeIds: ids, toParentId });
      if (!('success' in res) || !res.success) {
        const err = (res as unknown as { error?: string })?.error;
        showCommandError('INVALID_OPERATION', err || 'Paste failed');
        return;
      }
      await loadChildrenOf(toParentId);
      if (isCut) {
        (globalThis as GlobalWithClipboard).__HDB_CLIPBOARD__ = undefined;
      }
      await refreshUndoRedo();
      fireCmdEvent();
    } catch (error) {
      console.error('Paste failed:', error);
    }
  };

  return {
    applyClipboard,
    handleCopy: () => {
      applyClipboard(selectedIds as NodeId[], false);
    },
    handleCut: () => {
      applyClipboard(selectedIds as NodeId[], true);
    },
    handlePaste,
  };
};
