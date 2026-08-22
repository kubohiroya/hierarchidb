import { afterAll, beforeAll } from 'vitest';
import { WorkerAPIImpl } from './mocks/WorkerAPIImpl.js';

export type WorkerClientRefLike = {
  client: any;
  isInitialized: boolean;
  initialize: () => Promise<void>;
  getAPI: () => any;
};

declare global {
  var __HDB_WORKER_CLIENT_REF__: WorkerClientRefLike | undefined;
}

const workerApi = new WorkerAPIImpl('test-services');

export const workerClientRef: WorkerClientRefLike = {
  client: null,
  isInitialized: false,
  async initialize() {
    if (!this.isInitialized) {
      await workerApi.initialize();
      this.isInitialized = true;
      this.client = workerApi;
    }
  },
  getAPI() {
    if (!this.isInitialized) {
      throw new Error('Worker API has not been initialised');
    }
    return workerApi;
  },
};

beforeAll(async () => {
  await workerClientRef.initialize();
  globalThis.__HDB_WORKER_CLIENT_REF__ = workerClientRef;
});

afterAll(async () => {
  await workerApi.shutdown();
  delete globalThis.__HDB_WORKER_CLIENT_REF__;
});

export const teardownWorkerClientRef = async () => {
  await workerApi.shutdown();
  delete globalThis.__HDB_WORKER_CLIENT_REF__;
};
