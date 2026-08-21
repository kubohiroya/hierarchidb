export {
  BaseBuildSessionManager,
  AbstractBuildSession,
  UnifiedBuildManagerBase,
  LaneSemaphoreRegistry,
  useBuildSessionTiming,
  reconcileByMetadata,
  type MetadataDescriptor,
  type BuildSessionTimingRecord,
  type BuildSessionTimingSnapshot,
  type UseBuildSessionTimingArgs,
} from '@hierarchidb/build';

export {
  runWithStageCheckpoint,
  createMemorySnapshot,
} from './progressHelpers.js';
export type {
  StageCheckpointPhase,
  StageCheckpointContext,
  StageCheckpointLogger,
  StageHeartbeatWriter,
} from './progressHelpers.js';

export {
  UnconditionalEventStreamer,
  unconditionalEventStreamer,
} from './eventStreamer.js';
export type {
  NotificationType,
  EventPayload,
} from './eventStreamer.js';

export {
  emitTaskProgressUpdated,
  emitHeartbeat,
} from './eventEmissionUtils.js';

export { emitSessionStatusUpdated } from './emitSessionStatusUpdated.js';
export { emitStageSnapshotUpdated } from './emitStageSnapshotUpdated.js';
export { createSessionStatusUpdatedPayload } from './createSessionStatusUpdatedPayload.js';
export {
  createLiveCanonicalPluginBuildSubscriptions,
} from './createLiveCanonicalPluginBuildSubscriptions.js';
export { requireCanonicalStageBuildConfig } from './requireCanonicalStageBuildConfig.js';
export { CanonicalBuildSessionManager } from './CanonicalBuildSessionManager.js';
export type { CanonicalBuildSessionEventSource } from './CanonicalBuildSessionManager.js';
