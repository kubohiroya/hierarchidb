/**
 * Undo/redo actions for TreeConsole.
 */

import type { NodeId } from '@hierarchidb/common-types';
import type { MaybeCP, TreeConsoleActionDeps } from '../types.js';
import { fireCmdEvent, isCommandResult, showCommandError } from './helpers.ts';

export const createHistoryActions = (deps: TreeConsoleActionDeps) => {
  const { client, treeId, pageNodeId, loadChildrenOf, refreshUndoRedo } = deps;

  const resolveRefreshTarget = (): NodeId | undefined => {
    if (pageNodeId) return pageNodeId as NodeId;
    if (treeId) return `${treeId}:root` as NodeId;
    return undefined;
  };

  const runHistoryAction = async (method: 'undo' | 'redo') => {
    if (!client) return;
    const getCP = (client as unknown as MaybeCP).getCommandProcessor;
    if (typeof getCP !== 'function') return;

    let historyInvoked = false;
    try {
      const cp = await getCP();
      const historyFn =
        cp && typeof cp[method] === 'function' ? (cp[method] as () => Promise<unknown>) : undefined;
      if (!historyFn) return;

      historyInvoked = true;
      const result = await historyFn();

      if (isCommandResult(result) && !result.success) {
        showCommandError(result.code, result.error ?? `${method} failed`);
        return;
      }

      const refreshTarget = resolveRefreshTarget();
      if (refreshTarget) {
        try {
          await loadChildrenOf(refreshTarget);
        } catch (error) {
          console.warn(`[TreeConsoleActions] ${method} refresh failed`, error);
        }
      }
    } catch (error) {
      console.error(`[TreeConsoleActions] ${method} failed:`, error);
      showCommandError('UNKNOWN_ERROR', error instanceof Error ? error.message : String(error));
    } finally {
      if (historyInvoked) {
        try {
          await refreshUndoRedo();
        } catch (error) {
          console.warn(`[TreeConsoleActions] refreshUndoRedo failed after ${method}`, error);
        }
        fireCmdEvent();
      }
    }
  };

  return {
    handleUndo: () => runHistoryAction('undo'),
    handleRedo: () => runHistoryAction('redo'),
  };
};
