/**
 * @file LocationBuildManager.ts
 * @description Location build session manager extending BaseBuildSessionManager.
 */

import type { NodeId } from '@hierarchidb/core-types';
import type { LocationBuildConfig } from '~/common/entities/LocationEntity';
import type { LocationPointProperties } from '~/common/entities/LocationPoint';
import type { BuildProgressCallback, BuildSessionStatus } from '@hierarchidb/build-api';
import { CanonicalBuildSessionManager } from '@hierarchidb/build-runtime-services';
import { LocationBuildSession } from './LocationBuildSession.js';

export class LocationBuildManager extends CanonicalBuildSessionManager {
  async startBuildSession(nodeId: NodeId): Promise<BuildSessionStatus> {
    throw new Error(`startBuildSession requires config; use startLocationBuildSession(nodeId, config) instead. nodeId=${nodeId}`);
  }

  async startLocationBuildSession(
    nodeId: NodeId,
    config: LocationBuildConfig,
  ): Promise<NodeId> {
    const session = new LocationBuildSession(nodeId, config);
    await session.initialize();
    this.registerSession(session);

    const runPromise = session.start();
    void runPromise.catch((error: unknown) => {
      console.warn('[LocationBuildManager] Location build session failed', error);
    });
    void runPromise.finally(() => {
      this.sessions.delete(nodeId);
      this.cleanupSessionTracking(nodeId);
    });

    return nodeId;
  }

  async collectLocationPoints(
    nodeId: NodeId,
    config: LocationBuildConfig,
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

  onBuildProgress(nodeId: NodeId, callback: BuildProgressCallback): () => void {
    return super.onBuildProgress(nodeId, callback);
  }
}
