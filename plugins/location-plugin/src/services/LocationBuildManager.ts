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
import { clearLocationArtifacts } from './pointRepository.js';
import type { LocationSourcePlan } from './source/LocationSourcePlan.js';
import { runLocationSourceArtifactCleanup } from './source/runLocationSourceArtifactCleanup.js';

export class LocationBuildManager extends CanonicalBuildSessionManager {
  async startBuildSession(nodeId: NodeId): Promise<BuildSessionStatus> {
    const session = this.sessions.get(nodeId);
    if (!(session instanceof LocationBuildSession)) {
      throw new Error(`Location build session ${String(nodeId)} is not prepared`);
    }
    const state = session.getState();
    if (state.status === 'running' || state.status === 'pausing') {
      throw new Error(`Location build session still has an active run for node ${String(nodeId)}`);
    }
    const runPromise = session.start();
    void runPromise.catch((error: unknown) => {
      console.warn('[LocationBuildManager] Location build session failed', error);
    });
    return this.getBuildSessionStatus(nodeId);
  }

  async startLocationBuildSession(
    nodeId: NodeId,
    config: LocationBuildConfig,
    sourcePlan: LocationSourcePlan
  ): Promise<NodeId> {
    const existing = this.sessions.get(nodeId);
    if (existing?.hasActiveRun()) {
      throw new Error(`Location build session still has an active run for node ${String(nodeId)}`);
    }
    const session = new LocationBuildSession(nodeId, config, sourcePlan);
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
    config: LocationBuildConfig,
    sourcePlan: LocationSourcePlan
  ): Promise<LocationPointProperties[]> {
    const session = new LocationBuildSession(nodeId, config, sourcePlan);
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
    await runLocationSourceArtifactCleanup(nodeId);
    await clearLocationArtifacts(nodeId);
  }
}
