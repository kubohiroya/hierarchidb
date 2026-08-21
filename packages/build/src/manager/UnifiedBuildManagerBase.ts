import type { NodeId, Timestamp } from '@hierarchidb/core-types';
import type {
  BuildSessionStatus,
  IBuildSessionManager,
} from '@hierarchidb/build-api';

export interface UnifiedBuildSession<TConfig, TData> {
  config: TConfig;
  data: TData;
  storedAt: Timestamp;
}

export interface BuildPersistence<TConfig, TData> {
  savePending(nodeId: NodeId, payload: UnifiedBuildSession<TConfig, TData>): Promise<void> | void;
  takePending(nodeId: NodeId):
    | Promise<UnifiedBuildSession<TConfig, TData> | undefined>
    | UnifiedBuildSession<TConfig, TData>
    | undefined;
  onSessionStarted?(nodeId: NodeId, payload: UnifiedBuildSession<TConfig, TData>): Promise<void> | void;
  onSessionStatusChange?(nodeId: NodeId, status: BuildSessionStatus): Promise<void> | void;
}

export abstract class UnifiedBuildManagerBase<TConfig, TData> implements IBuildSessionManager<TConfig, TData> {
  private readonly pending = new Map<NodeId, UnifiedBuildSession<TConfig, TData>>();

  protected constructor(protected readonly persistence?: BuildPersistence<TConfig, TData>) {}

  async prepareSession<TConfigParam extends TConfig = TConfig, TDataParam extends TData = TData>(
    nodeId: NodeId,
    config: TConfigParam,
    data: TDataParam
  ): Promise<void> {
    const payload: UnifiedBuildSession<TConfig, TData> = {
      config,
      data,
      storedAt: Date.now() as Timestamp,
    };
    if (this.persistence) {
      await this.persistence.savePending(nodeId, payload);
    } else {
      this.pending.set(nodeId, payload);
    }
  }

  async startBuildSession(nodeId: NodeId): Promise<BuildSessionStatus> {
    const payload = this.persistence
      ? await this.persistence.takePending(nodeId)
      : this.pending.get(nodeId);
    if (!payload) {
      throw new Error(`No pending build session for node ${nodeId}`);
    }
    if (!this.persistence) {
      this.pending.delete(nodeId);
    }

    const status = await this.performStart(nodeId, payload.config, payload.data);
    assertMatchingNodeId(status, nodeId, 'performStart');
    if (this.persistence?.onSessionStarted) {
      await this.persistence.onSessionStarted(nodeId, payload);
    }
    return status;
  }

  async pauseBuildSession(nodeId: NodeId, _reason?: string): Promise<void> {
    await this.performPause(nodeId);
    await this.notifyStatus(nodeId);
  }

  async getBuildSessionStatus(nodeId: NodeId): Promise<BuildSessionStatus> {
    const status = await this.performStatus(nodeId);
    assertMatchingNodeId(status, nodeId, 'performStatus');
    if (this.persistence?.onSessionStatusChange) {
      await this.persistence.onSessionStatusChange(nodeId, status);
    }
    return status;
  }

  protected abstract performStart(nodeId: NodeId, config: TConfig, data: TData): Promise<BuildSessionStatus>;
  protected abstract performPause(nodeId: NodeId): Promise<void>;
  protected abstract performStatus(nodeId: NodeId): Promise<BuildSessionStatus>;

  private async notifyStatus(nodeId: NodeId): Promise<void> {
    if (!this.persistence?.onSessionStatusChange) return;
    const status = await this.performStatus(nodeId);
    assertMatchingNodeId(status, nodeId, 'performStatus');
    await this.persistence.onSessionStatusChange(nodeId, status);
  }
}

const assertMatchingNodeId = (
  status: BuildSessionStatus,
  expectedNodeId: NodeId,
  source: string
): void => {
  if (status.nodeId !== expectedNodeId) {
    throw new Error(
      `[UnifiedBuildManagerBase] ${source} returned nodeId=${String(status.nodeId)} for requested nodeId=${String(expectedNodeId)}`
    );
  }
};
