/**
 * Clipboard actions for TreeConsole.
 */

import type { NodeId } from '@hierarchidb/core-types';
import type { TreeConsoleActionDeps } from '../types.js';
import {
  confirmOverwrite,
  ensureClipboard,
  fireCmdEvent,
  type GlobalWithClipboard,
  isNameConflictError,
  showCommandError,
} from './helpers.ts';

export const createClipboardActions = (deps: TreeConsoleActionDeps) => {
  const {
    client,
    loadChildrenOf,
    pageNodeId,
    refreshUndoRedo,
    selectedIds,
    setSSOT,
    setState,
    translateWithFallback,
  } = deps;

  const translateError = (key: string, fallback: string): string => (
    translateWithFallback ? translateWithFallback(key, fallback) : fallback
  );

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
      if (isCut) {
        const res = await mutationAPI.moveNodes({
          nodeIds: ids as NodeId[],
          toParentId,
          onNameConflict: 'error',
        });
        if (!('success' in res) || !res.success) {
          const err = (res as unknown as { error?: string })?.error;
          if (isNameConflictError(err)) {
            const message = translateError(
              'treeConsole.conflicts.pasteOverwrite',
              'A node with the same name exists. Overwrite it?'
            );
            const allowOverwrite = confirmOverwrite(message);
            if (!allowOverwrite) {
              return;
            }
            const overwriteResult = await mutationAPI.moveNodes({
              nodeIds: ids as NodeId[],
              toParentId,
              onNameConflict: 'overwrite',
            });
            if (!('success' in overwriteResult) || !overwriteResult.success) {
              const overwriteErr = (overwriteResult as unknown as { error?: string })?.error;
              showCommandError('INVALID_OPERATION', overwriteErr || 'Paste failed');
              return;
            }
          } else {
            showCommandError('INVALID_OPERATION', err || 'Paste failed');
            return;
          }
        }
      } else {
        const res = await mutationAPI.duplicateNodes({ nodeIds: ids, toParentId });
        if (!('success' in res) || !res.success) {
          const err = (res as unknown as { error?: string })?.error;
          showCommandError('INVALID_OPERATION', err || 'Paste failed');
          return;
        }
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
