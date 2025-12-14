import { useCallback, useEffect, useRef, useState } from 'react';
import type { WorkerAPI } from '@hierarchidb/common-api';
import type { TreeNodeUpdaterState } from '@hierarchidb/plugin-ui-sdk';
import type { NodeId, TreeNodeData } from '@hierarchidb/common-types';
import type { Remote } from 'comlink';

export function useConflictGuard(params: {
  mode: 'create' | 'edit';
  client: Remote<WorkerAPI> | null;
  nodeId: NodeId;
  draftVersion?: number;
  discardDraft: (opts?: { forceDelete?: boolean }) => Promise<void>;
  onClose: () => void;
  updateTreeNodeUpdater: (patch: Partial<TreeNodeUpdaterState<TreeNodeData>>) => void;
}) {
  const { mode, client, nodeId, draftVersion, discardDraft, onClose, updateTreeNodeUpdater } = params;

  const acknowledgedVersionRef = useRef<number>(draftVersion ?? 0);
  useEffect(() => {
    if (draftVersion !== undefined) {
      acknowledgedVersionRef.current = draftVersion;
    }
  }, [draftVersion]);

  const [conflictDialog, setConflictDialog] = useState<{
    open: boolean;
    latestVersion: number;
    updatedAt?: number;
  }>({ open: false, latestVersion: 0, updatedAt: undefined });

  const conflictResolverRef = useRef<((decision: 'discard' | 'continue') => void) | null>(null);

  const resolveConflict = useCallback((decision: 'discard' | 'continue') => {
    conflictResolverRef.current?.(decision);
    conflictResolverRef.current = null;
    setConflictDialog((prev) => ({ ...prev, open: false }));
  }, []);

  const requestConflictResolution = useCallback(
    (latestVersion: number, updatedAt?: number) =>
      new Promise<'discard' | 'continue'>((resolve) => {
        conflictResolverRef.current = resolve;
        setConflictDialog({ open: true, latestVersion, updatedAt });
      }),
    []
  );

  const fetchLatestVersion = useCallback(async () => {
    if (mode !== 'edit') return null;
    if (!client) return null;
    try {
      const query = await client.getQueryAPI();
      const latest = await query.getNode(nodeId);
      if (!latest) return null;
      return { version: latest.version ?? 0, updatedAt: latest.updatedAt };
    } catch (err) {
      console.warn('[PluginDialogShell] failed to fetch latest node for version check', err);
      return null;
    }
  }, [client, mode, nodeId]);

  const ensureNoConflict = useCallback(async (): Promise<boolean> => {
    const latest = await fetchLatestVersion();
    if (!latest) return true;
    const localVersion = acknowledgedVersionRef.current ?? 0;
    if (latest.version > localVersion) {
      const decision = await requestConflictResolution(latest.version, latest.updatedAt);
      resolveConflict(decision);
      if (decision === 'discard') {
        await discardDraft();
        onClose();
        return false;
      }
      acknowledgedVersionRef.current = latest.version;
      updateTreeNodeUpdater({
        version: latest.version,
        updatedAt: latest.updatedAt,
      });
    }
    return true;
  }, [discardDraft, fetchLatestVersion, onClose, requestConflictResolution, resolveConflict, updateTreeNodeUpdater]);

  return {
    conflictDialog,
    resolveConflict,
    ensureNoConflict,
    acknowledgedVersionRef,
  };
}
