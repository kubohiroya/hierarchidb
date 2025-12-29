import { releaseProxy, wrap } from 'comlink';
import type { Remote } from 'comlink';
import { AuthRecoveryService } from '@hierarchidb/auth-recovery';
import type { ShapeStageWorkerAPI } from '../workers/ShapeStageWorkerTypes.js';

type WorkerHandle = {
  worker: Worker;
  api: Remote<ShapeStageWorkerAPI>;
};

export class ShapeWorkerPool {
  private readonly handles: WorkerHandle[];
  private nextIndex = 0;
  private authHeader?: string;

  private constructor(handles: WorkerHandle[], authHeader?: string) {
    this.handles = handles;
    this.authHeader = authHeader;
  }

  static async create(size: number): Promise<ShapeWorkerPool> {
    const count = Math.max(1, size);
    const auth = await AuthRecoveryService.getSingleton();
    const authHeader = auth.getAuthHeaders().Authorization;
    const handles = Array.from({ length: count }, () => {
      const worker = new Worker(new URL('@hierarchidb/shape-plugin/shape-stage-worker', import.meta.url), {
        type: 'module',
      });
      const api = wrap<ShapeStageWorkerAPI>(worker);
      return { worker, api };
    });
    const pool = new ShapeWorkerPool(handles, authHeader);
    await pool.syncAuthHeader(authHeader);
    return pool;
  }

  get size(): number {
    return this.handles.length;
  }

  async run<T>(runner: (api: Remote<ShapeStageWorkerAPI>) => Promise<T>): Promise<T> {
    const auth = await AuthRecoveryService.getSingleton();
    const authHeader = auth.getAuthHeaders().Authorization;
    if (authHeader !== this.authHeader) {
      await this.syncAuthHeader(authHeader);
    }
    const handle = this.handles[this.nextIndex % this.handles.length];
    if (!handle) {
      throw new Error('Shape worker handle is unavailable');
    }
    this.nextIndex += 1;
    return runner(handle.api);
  }

  private async syncAuthHeader(header?: string): Promise<void> {
    if (!header) {
      this.authHeader = undefined;
      return;
    }
    const [type, token] = header.split(' ');
    if (!token || (type !== 'Bearer' && type !== 'Basic')) {
      this.authHeader = undefined;
      return;
    }
    await Promise.all(this.handles.map(({ api }) => api.setAuthToken(token, type)));
    this.authHeader = header;
  }

  async shutdown(): Promise<void> {
    await Promise.all(this.handles.map(async ({ api, worker }) => {
      await (api as unknown as { [releaseProxy]?: () => void })[releaseProxy]?.();
      worker.terminate();
    }));
  }
}
