import { atom } from 'jotai';
// Local build-change payload used by SubscriptionOrchestrator.
// This avoids requiring treeId/pageNodeId/version at this UI layer
// and focuses on minimal diffs the table merge can consume.
export interface SubTreeChanges {
  added?: Array<{ id: string; parentId?: string | null; [k: string]: unknown }>;
  updated?: Array<{ nodeId: string; changes: Record<string, unknown> }>;
  removed?: string[];
  moved?: Array<{
    nodeId: string;
    oldParentId?: string;
    newParentId: string;
    oldIndex?: number;
    newIndex?: number;
  }>;
}

export const subscribedRootNodeIdAtom = atom<string | null>(null);

export const subscriptionIdAtom = atom<string | null>(null);

export const subscriptionDepthAtom = atom<number>(2);

export const lastUpdateTimestampAtom = atom<number>(0);

export const pendingUpdatesAtom = atom<SubTreeChanges[]>([]);
