import {
  assertCanonicalBuildRuntimeRecord,
  assertCanonicalBuildRuntimeRecords,
  type BuildSessionRuntimeFilter,
  type BuildSessionRuntimeRecord,
  type CanonicalBuildRuntimeAdapter,
  CanonicalBuildRuntimeError,
  canonicalBuildRuntimeAdapterMethodNames,
} from '@hierarchidb/build-api';
import type { NodeId, NodeType } from '@hierarchidb/core-types';

export class CanonicalBuildRuntimeAdapterRegistry {
  private readonly adapters = new Map<NodeType, CanonicalBuildRuntimeAdapter>();

  constructor(adapters: readonly CanonicalBuildRuntimeAdapter[] = []) {
    for (const adapter of adapters) {
      this.register(adapter);
    }
  }

  register(adapter: CanonicalBuildRuntimeAdapter): void {
    validateAdapter(adapter);
    if (this.adapters.has(adapter.nodeType)) {
      throw new CanonicalBuildRuntimeError(
        `Canonical build runtime adapter is already registered for nodeType: ${String(adapter.nodeType)}`,
        {
          code: 'CANONICAL_BUILD_RUNTIME_ADAPTER_DUPLICATE_NODE_TYPE',
          nodeType: adapter.nodeType,
        }
      );
    }
    this.adapters.set(adapter.nodeType, Object.freeze(adapter));
  }

  require(nodeType: NodeType): CanonicalBuildRuntimeAdapter {
    const adapter = this.adapters.get(nodeType);
    if (!adapter) {
      throw new CanonicalBuildRuntimeError(
        `Canonical build runtime adapter is not registered for nodeType: ${String(nodeType)}`,
        {
          code: 'CANONICAL_BUILD_RUNTIME_ADAPTER_NOT_REGISTERED',
          nodeType,
        }
      );
    }
    return adapter;
  }

  has(nodeType: NodeType): boolean {
    return this.adapters.has(nodeType);
  }

  listNodeTypes(): NodeType[] {
    return Array.from(this.adapters.keys());
  }

  async getSession(nodeType: NodeType, nodeId: NodeId): Promise<BuildSessionRuntimeRecord | null> {
    const record = await this.require(nodeType).getSession(nodeId);
    return record === null ? null : assertCanonicalBuildRuntimeRecord(record, nodeType);
  }

  async listSessions(
    nodeType: NodeType,
    filter?: BuildSessionRuntimeFilter
  ): Promise<BuildSessionRuntimeRecord[]> {
    const records = await this.require(nodeType).listSessions(filter);
    return assertCanonicalBuildRuntimeRecords(records, nodeType);
  }

  async deleteSession(nodeType: NodeType, nodeId: NodeId): Promise<void> {
    await this.require(nodeType).deleteSession(nodeId);
  }

  async subscribeSessions(
    nodeType: NodeType,
    filter: BuildSessionRuntimeFilter | undefined,
    callback: (sessions: BuildSessionRuntimeRecord[]) => void
  ): Promise<() => void> {
    const adapter = this.require(nodeType);
    return adapter.subscribeSessions(filter, (sessions) => {
      callback(assertCanonicalBuildRuntimeRecords(sessions, nodeType));
    });
  }
}

const validateAdapter = (adapter: CanonicalBuildRuntimeAdapter): void => {
  if (typeof adapter.nodeType !== 'string' || adapter.nodeType.length === 0) {
    throw new CanonicalBuildRuntimeError(
      `Canonical build runtime adapter nodeType must be a non-empty string: ${String(adapter.nodeType)}`,
      {
        code: 'CANONICAL_BUILD_RUNTIME_ADAPTER_INVALID_NODE_TYPE',
        nodeType: adapter.nodeType,
        field: 'nodeType',
      }
    );
  }
  for (const methodName of canonicalBuildRuntimeAdapterMethodNames) {
    if (typeof adapter[methodName] !== 'function') {
      throw new CanonicalBuildRuntimeError(
        `Canonical build runtime adapter ${String(adapter.nodeType)} is missing method: ${String(methodName)}`,
        {
          code: 'CANONICAL_BUILD_RUNTIME_ADAPTER_METHOD_MISSING',
          nodeType: adapter.nodeType,
          field: String(methodName),
        }
      );
    }
  }
};
