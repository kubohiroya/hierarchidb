import type { NodeId } from '@hierarchidb/common-types';
import type { IdeGsmImportProgress } from '@hierarchidb/location-api';

type Listener = (progress: IdeGsmImportProgress | null) => void;

const progressByNode = new Map<NodeId, IdeGsmImportProgress | null>();
const listeners = new Map<NodeId, Set<Listener>>();

export const updateIdeGsmProgress = (nodeId: NodeId, progress: IdeGsmImportProgress | null): void => {
  progressByNode.set(nodeId, progress);
  const subs = listeners.get(nodeId);
  if (!subs) return;
  subs.forEach((cb) => cb(progress));
};

export const clearIdeGsmProgress = (nodeId: NodeId): void => {
  updateIdeGsmProgress(nodeId, null);
};

export const subscribeIdeGsmProgress = (nodeId: NodeId, cb: Listener): (() => void) => {
  const subs = listeners.get(nodeId) ?? new Set<Listener>();
  subs.add(cb);
  listeners.set(nodeId, subs);
  cb(progressByNode.get(nodeId) ?? null);
  return () => {
    const current = listeners.get(nodeId);
    if (!current) return;
    current.delete(cb);
    if (current.size === 0) {
      listeners.delete(nodeId);
    }
  };
};
