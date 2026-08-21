import type {
  CanonicalPluginBuildAPI,
  HeartbeatEvent,
  SessionStatusUpdatedEvent,
  StageSnapshotUpdatedEvent,
  TaskProgressUpdatedEvent,
  WorkerLogEvent,
} from '@hierarchidb/build-api';
import { unconditionalEventStreamer } from './eventStreamer.js';

type CanonicalPluginBuildSubscriptions = Pick<
  CanonicalPluginBuildAPI,
  | 'subscribeStageSnapshots'
  | 'subscribeTaskProgress'
  | 'subscribeSessionState'
  | 'subscribeSessionHeartbeat'
  | 'subscribeWorkerLog'
>;

export const createLiveCanonicalPluginBuildSubscriptions =
  (): CanonicalPluginBuildSubscriptions => ({
    subscribeStageSnapshots: (nodeId, callback) =>
      unconditionalEventStreamer.subscribe(nodeId, 'stage-snapshot', (event) => {
        callback(event as StageSnapshotUpdatedEvent);
      }),
    subscribeTaskProgress: (nodeId, callback) =>
      unconditionalEventStreamer.subscribe(nodeId, 'task-progress', (event) => {
        callback(event as TaskProgressUpdatedEvent);
      }),
    subscribeSessionState: (nodeId, callback) =>
      unconditionalEventStreamer.subscribe(nodeId, 'session-state', (event) => {
        callback(event as SessionStatusUpdatedEvent);
      }),
    subscribeSessionHeartbeat: (nodeId, callback) =>
      unconditionalEventStreamer.subscribe(nodeId, 'heartbeat', (event) => {
        callback(event as HeartbeatEvent);
      }),
    subscribeWorkerLog: (nodeId, callback) =>
      unconditionalEventStreamer.subscribe(nodeId, 'worker-log', (event) => {
        callback(event as WorkerLogEvent);
      }),
  });
