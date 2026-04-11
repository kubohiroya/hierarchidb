export {
  BaseBuildSessionManager,
  AbstractBuildSession,
  UnifiedBuildManagerBase,
  LaneSemaphoreRegistry,
  useBuildProgress,
  useBuildSessionTiming,
  createAdapterFromProgressSubscribe,
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
