import type { NodeId } from '@hierarchidb/common-types';
import type { TreeNode } from '@hierarchidb/common-types';
import type { CoreDB } from '../CoreDB.js';

type EntitiesDbTable = {
  delete(id: NodeId): Promise<void> | void;
};

type EntitiesDbAdapter = {
  table(name: string): EntitiesDbTable | undefined;
};

type EntitiesOverrideFactory =
  | EntitiesDbAdapter
  | (() => EntitiesDbAdapter | Promise<EntitiesDbAdapter | undefined> | undefined)
  | (() => Promise<EntitiesDbAdapter | undefined>);

type EntitiesOverrideRegistry = Record<string, EntitiesOverrideFactory>;

function getEntitiesOverrides(): EntitiesOverrideRegistry | undefined {
  const globalWithOverrides = globalThis as typeof globalThis & {
    __HDB_PLUGIN_ENTITY_OVERRIDES__?: EntitiesOverrideRegistry;
  };
  return globalWithOverrides.__HDB_PLUGIN_ENTITY_OVERRIDES__;
}

async function resolveEntitiesOverride(
  factory: EntitiesOverrideFactory | undefined
): Promise<EntitiesDbAdapter | null> {
  if (!factory) return null;
  try {
    if (typeof factory === 'function') {
      const resolved = await factory();
      return resolved ?? null;
    }
    return factory;
  } catch (error) {
    console.warn('[CommandProcessor] override resolution failed:', error);
    return null;
  }
}

export async function deletePeerEntitiesForNodes(nodes: Array<TreeNode>, _coreDB: CoreDB): Promise<void> {
  const { storeRegistry } = await import('../../entity/store-registry.js');
  for (const n of nodes) {
    const nodeType = n.nodeType;
    const nodeId = n.id as NodeId;
    const store = storeRegistry.getPeer(nodeType);
    if (store) {
      await store.delete(nodeId);
      continue;
    }
    await deletePeerEntityDirect(nodeType, nodeId);
  }
}

async function deletePeerEntityDirect(nodeType: string, nodeId: NodeId): Promise<void> {
  const overrideFactory = getEntitiesOverrides()?.[nodeType];
  if (!overrideFactory) {
    console.warn(
      '[CommandProcessor] peer-entity cleanup skipped: no override registered for nodeType=',
      nodeType
    );
    return;
  }
  try {
    const db = await resolveEntitiesOverride(overrideFactory);
    if (db && typeof db.table === 'function') {
      const table = db.table('peerEntities');
      await table?.delete?.(nodeId);
      return;
    }
    console.warn(
      '[CommandProcessor] override provided for',
      nodeType,
      'but no table() interface found'
    );
  } catch (err) {
    console.warn('[CommandProcessor] override peer-entity cleanup failed:', err);
  }
}
