/**
 * Shared helpers for TreeConsole action factory.
 */

import type { WorkerAPI } from '@hierarchidb/common-api';
import type { CommandResult, NodeId, TreeNode } from '@hierarchidb/common-types';
import { PluginStepRegistry } from '@hierarchidb/plugin-base';
import { DualKeyMap } from '@hierarchidb/util';
import type { Remote } from 'comlink';
import type { TreeConsoleSSOTEntry } from '../../../state/treeconsole.atoms.js';
import { syncNodeIndex } from '../../../state/treeconsole.derive.js';

export type ClipboardPayload = { nodeIds: NodeId[]; cut?: boolean };
export type GlobalWithClipboard = typeof globalThis & { __HDB_CLIPBOARD__?: ClipboardPayload };

export function fireCmdEvent(): void {
  window.dispatchEvent(new CustomEvent('hdb-cmd'));
}

export function ensureClipboard(): ClipboardPayload {
  const existing = (globalThis as GlobalWithClipboard).__HDB_CLIPBOARD__;
  if (existing) return existing;
  const fresh: ClipboardPayload = { nodeIds: [] };
  (globalThis as GlobalWithClipboard).__HDB_CLIPBOARD__ = fresh;
  return fresh;
}

export function getOrCreateIndex(ssot: TreeConsoleSSOTEntry): DualKeyMap<NodeId, NodeId, TreeNode> {
  return ssot.nodeIndex ? ssot.nodeIndex.clone() : new DualKeyMap<NodeId, NodeId, TreeNode>();
}

export function createUniqueName(siblingNames: string[], baseName: string): string {
  if (!siblingNames.includes(baseName)) return baseName;
  const escapedBase = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escapedBase}\\s*\\((\\d+)\\)$`);
  const existingNumbers = siblingNames
    .map((name) => {
      const match = pattern.exec(name);
      return match?.[1] ? parseInt(match[1], 10) : 0;
    })
    .filter((n) => n > 0);
  const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 2;
  return `${baseName} (${nextNumber})`;
}

type PreviewStepConfig = {
  stepId?: string;
  stepIndex?: number;
};

const PREVIEW_STEP_CONFIG: Record<string, PreviewStepConfig> = {
  basemap: { stepId: 'viewport', stepIndex: 2 },
  location: { stepId: 'map-preview', stepIndex: 5 },
  linker: { stepId: 'preview', stepIndex: 2 },
  resolver: { stepId: 'preview', stepIndex: 4 },
  styler: { stepId: 'preview', stepIndex: 4 },
  timeline: { stepId: 'map', stepIndex: 1 },
};

const stepRegistry = PluginStepRegistry.getInstance();

export const resolvePreviewStepIndex = (options: {
  nodeType?: string;
  nodeId?: NodeId;
}): number | null => {
  const normalized = options.nodeType?.toLowerCase();
  if (!normalized) return null;
  const config = PREVIEW_STEP_CONFIG[normalized];
  const provider = stepRegistry.getConfigProvider(normalized);
  if (provider) {
    const stepList =
      typeof provider.getEditStepConfigs === 'function'
        ? provider.getEditStepConfigs(String(options.nodeId ?? ''))
        : provider.getCreateStepConfigs();
    if (stepList && stepList.length) {
      if (config?.stepId) {
        const matchIndex = stepList.findIndex((cfg) => cfg.id === config.stepId);
        if (matchIndex >= 0) {
          return matchIndex;
        }
      }
      const implicitPreview = stepList.findIndex((cfg) => cfg.id?.toLowerCase().includes('preview'));
      if (implicitPreview >= 0) {
        return implicitPreview;
      }
    }
  }
  if (config?.stepIndex != null) {
    return config.stepIndex;
  }
  return null;
};

export function buildIndexFromNodes(
  nodes: readonly TreeNode[],
  fallbackParent: NodeId
): DualKeyMap<NodeId, NodeId, TreeNode> {
  const index = new DualKeyMap<NodeId, NodeId, TreeNode>();
  for (const node of nodes) {
    const key = String(node.id) as NodeId;
    const parentKey = node.parentId ? (String(node.parentId) as NodeId) : fallbackParent;
    index.set(key, node, parentKey);
  }
  return index;
}

export const showCommandError = (...args: unknown[]): void => {
  console.error('[HDB] Command Error:', ...args);
};

export const isCommandResult = (value: unknown): value is CommandResult =>
  typeof value === 'object' && value !== null && 'success' in value;

export function normalizeNodeId(value: unknown): NodeId | null {
  if (value === null || value === undefined) {
    return null;
  }
  const str = String(value).trim();
  if (!str) {
    return null;
  }
  return str as NodeId;
}

async function buildAncestryChain(params: {
  client: Remote<WorkerAPI> | undefined;
  pageNodeId?: NodeId;
  pageTreeNode?: TreeNode;
}): Promise<Array<{ id: NodeId; parentId: NodeId | null }>> {
  const { client, pageNodeId, pageTreeNode } = params;
  if (!client || !pageNodeId) {
    return [];
  }
  try {
    const queryAPI = await client.getQueryAPI();
    const ancestors = ((await queryAPI.listAncestors(pageNodeId as NodeId)) ?? []) as Array<
      TreeNode | null
    >;
    const ancestorIdsDesc: NodeId[] = ancestors
      .map((node) => normalizeNodeId(node?.id))
      .filter((id): id is NodeId => Boolean(id))
      .reverse();
    const chain: Array<{ id: NodeId; parentId: NodeId | null }> = [];
    const immediateParent = normalizeNodeId(pageTreeNode?.parentId) ?? ancestorIdsDesc[0] ?? null;
    chain.push({ id: pageNodeId as NodeId, parentId: immediateParent });
    ancestorIdsDesc.forEach((id, index) => {
      if (!id) return;
      const parentId = ancestorIdsDesc[index + 1] ?? null;
      chain.push({ id, parentId });
    });
    return chain;
  } catch (error) {
    console.warn('[TreeConsoleActions] failed to resolve ancestry for trash navigation', error);
    if (pageNodeId) {
      return [
        {
          id: pageNodeId as NodeId,
          parentId: normalizeNodeId(pageTreeNode?.parentId),
        },
      ];
    }
    return [];
  }
}

export async function resolveTrashNavigationTarget(params: {
  client: Remote<WorkerAPI> | undefined;
  pageNodeId?: NodeId;
  pageTreeNode?: TreeNode;
  selectedIds: readonly NodeId[];
}): Promise<NodeId | null | undefined> {
  const { client, pageNodeId, pageTreeNode, selectedIds } = params;
  if (!pageNodeId || !selectedIds?.length) {
    return undefined;
  }
  const selectedSet = new Set<NodeId>(selectedIds as NodeId[]);
  if (!selectedSet.size) return undefined;
  const chain = await buildAncestryChain({ client, pageNodeId, pageTreeNode });
  if (!chain.length) {
    return selectedSet.has(pageNodeId as NodeId)
      ? normalizeNodeId(pageTreeNode?.parentId)
      : undefined;
  }
  const matches = chain.filter((entry) => selectedSet.has(entry.id));
  if (!matches.length) {
    return undefined;
  }
  const targetEntry = matches[matches.length - 1];
  if (!targetEntry) {
    return undefined;
  }
  return targetEntry.parentId ?? null;
}

export function attachChildrenToIndex(
  index: DualKeyMap<NodeId, NodeId, TreeNode>,
  parentKey: NodeId,
  nodes: TreeNode[],
): DualKeyMap<NodeId, NodeId, TreeNode> {
  syncNodeIndex(index, parentKey, nodes);
  return index;
}
