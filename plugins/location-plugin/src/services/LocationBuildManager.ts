/**
 * @file LocationBuildManager.ts
 * @description Location build session manager extending BaseBuildSessionManager.
 */

import type { BuildSessionStatus, BuildTaskSummary } from '@hierarchidb/build-api';
import { CanonicalBuildSessionManager } from '@hierarchidb/build-runtime-services';
import type { NodeId } from '@hierarchidb/core-types';
import type { LocationBuildConfig } from '~/common/entities/LocationEntity';
import type { LocationPointProperties } from '~/common/entities/LocationPoint';
import { LocationBuildSession } from './LocationBuildSession.js';
import { clearLocationPoints } from './pointRepository.js';

export class LocationBuildManager extends CanonicalBuildSessionManager {
  async startBuildSession(nodeId: NodeId): Promise<BuildSessionStatus> {
    throw new Error(
      `startBuildSession requires config; use startLocationBuildSession(nodeId, config) instead. nodeId=${nodeId}`
    );
  }

  async startLocationBuildSession(nodeId: NodeId, config: LocationBuildConfig): Promise<NodeId> {
    const existing = this.sessions.get(nodeId);
    if (existing?.hasActiveRun()) {
      throw new Error(`Location build session still has an active run for node ${String(nodeId)}`);
    }
    const session = new LocationBuildSession(nodeId, config);
    await session.initialize();
    this.registerSession(session);

    const runPromise = session.start();
    void runPromise.catch((error: unknown) => {
      console.warn('[LocationBuildManager] Location build session failed', error);
    });

    return nodeId;
  }

  async getBuildTasks(nodeId: NodeId): Promise<BuildTaskSummary[]> {
    const session = this.sessions.get(nodeId);
    if (!(session instanceof LocationBuildSession)) {
      throw new Error(`Session ${String(nodeId)} not found`);
    }
    return session.getBuildTasks();
  }

  async collectLocationPoints(
    nodeId: NodeId,
    config: LocationBuildConfig
  ): Promise<LocationPointProperties[]> {
    const session = new LocationBuildSession(nodeId, config);
    return session.collectLocationPoints(config);
  }

  async abortLocationBuildSession(nodeId: NodeId): Promise<void> {
    const session = this.sessions.get(nodeId);
    if (session) {
      await session.pause();
    }
    this.sessions.delete(nodeId);
    this.cleanupSessionTracking(nodeId);
  }

  protected override async cleanupDeletedBuildSessionRuntime(nodeId: NodeId): Promise<void> {
    await clearLocationPoints(nodeId);
  }
}
