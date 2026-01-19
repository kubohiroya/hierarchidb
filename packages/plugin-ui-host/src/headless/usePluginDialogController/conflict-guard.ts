import type { WorkerAPI } from '@hierarchidb/common-api';
import type { NodeId, TreeNodeData, TreeNodeMetadata } from '@hierarchidb/common-types';
import type { TreeNodeUpdaterState } from '@hierarchidb/plugin-ui-sdk';
import type { Remote } from 'comlink';
import { useCallback, useEffect, useRef, useState } from 'react';

export function useConflictGuard(params: {
  mode: 'create' | 'edit';
  client: Remote<WorkerAPI> | null;
  nodeId: NodeId;
  draftVersion?: number;
  discardDraft: (opts?: { forceDelete?: boolean }) => Promise<void>;
  onClose: () => void;
  updateTreeNodeUpdater: (patch: Partial<TreeNodeUpdaterState<TreeNodeData>>) => void;
  getLocalDraftSnapshot?: () => {
    draftMetadata?: TreeNodeMetadata | null;
    draftData?: TreeNodeData | null;
  } | null;
}) {
  const {
    mode,
    client,
    nodeId,
    draftVersion,
    discardDraft,
    onClose,
    updateTreeNodeUpdater,
    getLocalDraftSnapshot,
  } = params;

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
      const query = await withTimeout(client.getQueryAPI(), 2000);
      if (!query) return null;
      const latest = await withTimeout(query.getNode(nodeId), 2000);
      if (!latest) return null;
      return { latest, version: latest.version ?? 0, updatedAt: latest.updatedAt };
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
      const localSnapshot = getLocalDraftSnapshot?.() ?? null;
      const latestDraftData =
        (latest.latest as { draftData?: TreeNodeData | null }).draftData ?? null;
      const latestDraftMetadata =
        (latest.latest as { draftMetadata?: TreeNodeMetadata | null }).draftMetadata ?? null;
      const isSameContent = compareDraftSnapshots(localSnapshot, {
        draftData: latestDraftData,
        draftMetadata: latestDraftMetadata,
      });
      if (isSameContent) {
        acknowledgedVersionRef.current = latest.version;
        updateTreeNodeUpdater({
          version: latest.version,
          updatedAt: latest.updatedAt,
        });
        return true;
      }
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
  }, [
    discardDraft,
    fetchLatestVersion,
    onClose,
    requestConflictResolution,
    resolveConflict,
    updateTreeNodeUpdater,
  ]);

  return {
    conflictDialog,
    resolveConflict,
    ensureNoConflict,
    acknowledgedVersionRef,
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return new Promise((resolve) => {
    timeoutId = setTimeout(() => resolve(null), timeoutMs);
    promise
      .then((value) => {
        if (timeoutId) clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        if (timeoutId) clearTimeout(timeoutId);
        console.warn('[PluginDialogShell] timed out waiting for worker response', error);
        resolve(null);
      });
  });
}

function compareDraftSnapshots(
  localSnapshot: {
    draftMetadata?: TreeNodeMetadata | null;
    draftData?: TreeNodeData | null;
  } | null,
  remoteSnapshot: { draftMetadata?: TreeNodeMetadata | null; draftData?: TreeNodeData | null }
): boolean {
  const localMeta = localSnapshot?.draftMetadata ?? null;
  const localData = localSnapshot?.draftData ?? null;
  const remoteMeta = remoteSnapshot.draftMetadata ?? null;
  const remoteData = remoteSnapshot.draftData ?? null;
  return (
    JSON.stringify(localMeta) === JSON.stringify(remoteMeta) &&
    JSON.stringify(localData) === JSON.stringify(remoteData)
  );
}
