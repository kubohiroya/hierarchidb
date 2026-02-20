import 'fake-indexeddb/auto';
import type { NodeId } from '@hierarchidb/core-types';
import type { ShapeBuildSessionRecord, ShapeMutationAPI, ShapeQueryAPI } from '@hierarchidb/shape-api';
import * as Comlink from 'comlink';
import { unpackTileId } from '@hierarchidb/vt-orchestrator';

vi.mock('comlink', async () => (
  await vi.importActual('comlink')
));
import { describe, expect, it, vi } from 'vitest';
vi.mock('@hierarchidb/gis-sdk', async () => (
  await import('@hierarchidb/gis-sdk')
));

vi.mock('@hierarchidb/vt-orchestrator', async () => {
  const actual = await vi.importActual<typeof import('@hierarchidb/vt-orchestrator')>('@hierarchidb/vt-orchestrator');
  //const { unpackTileId } = await import('@hierarchidb/vt-orchestrator');
  const createVtHandler: typeof actual.createVtHandler = (context) => {
    type HandlerTask = Parameters<ReturnType<typeof actual.createVtHandler>>[0];
    return async (task: HandlerTask) => {
      const input = task.inputData;
      if (!input) {
        return { status: 'failed', errorMessage: 'vt task input is missing' };
      }
      const parent = unpackTileId(input.tileId, input.zBase);
      await context.tileWriter({
        tileId: input.tileId,
        z: parent.z,
        x: parent.x,
        y: parent.y,
        data: new Uint8Array([1]).buffer,
        layers: {},
        bufferSetHash: input.sourceKey ?? 'mock',
      });
      return { status: 'completed', progress: 100 };
    };
  };
  return { ...actual, createVtHandler };
});

import { MessageChannel, type MessagePort as NodeMessagePort } from 'worker_threads';
import { createEndpointFromMessagePort } from '../../e2e/test-utils/messagePortEndpoint';

type WorkerTestAPI = {
  getShapeQueryAPI(): Promise<ShapeQueryAPI>;
  getShapeMutationAPI(): Promise<ShapeMutationAPI>;
};

type WorkerSetup = {
  client: Comlink.Remote<WorkerTestAPI>;
  port1: NodeMessagePort;
  port2: NodeMessagePort;
  terminateAll: () => void;
};

const setupWorker = async (): Promise<WorkerSetup> => {
  vi.resetModules();
  const [{ SingletonMixin }, { exposeShapeTestAPI }] = await Promise.all([
    import('@hierarchidb/util'),
    import('../../e2e/shape-test-worker.entry'),
  ]);
  SingletonMixin.terminateAll();
  const { port1, port2 } = new MessageChannel();
  await exposeShapeTestAPI(createEndpointFromMessagePort(port1));
  const client = Comlink.wrap<WorkerTestAPI>(createEndpointFromMessagePort(port2));
  return {
    client,
    port1,
    port2,
    terminateAll: () => SingletonMixin.terminateAll(),
  };
};

const cleanupWorker = async (setup: WorkerSetup): Promise<void> => {
  const release = (setup.client as { [Comlink.releaseProxy]?: () => Promise<void> })[
    Comlink.releaseProxy
  ];
  if (release) {
    await release.call(setup.client);
  }
  setup.port1.close();
  setup.port2.close();
  setup.terminateAll();
};

const createBaseSession = (nodeId: NodeId, timestamp: number): ShapeBuildSessionRecord => ({
  nodeId,
  status: 'running',
  config: {
    download: {},
    extract1: {},
    extract2: {},
    vectorTiles: {},
  },
  startedAt: timestamp,
  updatedAt: timestamp,
  progress: {
    total: 1,
    completed: 0,
    failed: 0,
    skipped: 0,
    percentage: 0,
    taskType: 'fetch',
  },
  stages: {
    fetch: { status: 'queued', progress: 0, tasksTotal: 0, tasksCompleted: 0, tasksFailed: 0 },
    transform: { status: 'queued', progress: 0, tasksTotal: 0, tasksCompleted: 0, tasksFailed: 0 },
    vt: { status: 'queued', progress: 0, tasksTotal: 0, tasksCompleted: 0, tasksFailed: 0 },
  },
});

describe('Comlink + fake-indexeddb integration: shape build pause on leave', () => {
  it('persists route-leave stopReason and remains paused after worker restart', async () => {
    const nodeId = 'shape-build-test-1' as NodeId;
    const first = await setupWorker();

    try {
      const mutation = await first.client.getShapeMutationAPI();
      const query = await first.client.getShapeQueryAPI();
      await mutation.deleteBuildSession(nodeId);
      const baseSession = createBaseSession(nodeId, Date.now());
      await mutation.upsertBuildSession(baseSession);
      await mutation.updateBuildSession(nodeId, {
        status: 'paused',
        stopReason: 'route-leave',
        updatedAt: Date.now(),
      });

      const paused = await query.getBuildSessionRecord(nodeId);
      expect(paused?.status).toBe('paused');
      expect(paused?.stopReason).toBe('route-leave');
    } finally {
      await cleanupWorker(first);
    }

    const second = await setupWorker();
    try {
      const query = await second.client.getShapeQueryAPI();
      const record = await query.getBuildSessionRecord(nodeId);
      expect(record?.status).toBe('paused');
      expect(record?.stopReason).toBe('route-leave');

      await new Promise((resolve) => setTimeout(resolve, 50));
      const afterWait = await query.getBuildSessionRecord(nodeId);
      expect(afterWait?.status).toBe('paused');
    } finally {
      await cleanupWorker(second);
    }
  }, 15_000);
});
