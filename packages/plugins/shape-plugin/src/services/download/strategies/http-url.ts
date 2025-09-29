import type { IShapeDownloadStrategy } from '../strategy.js';
import type { BatchTaskLike } from '../../../types/BatchTaskLike.js';
import { DexieChunkStoragePort, DownloadService, FetchNetworkPort } from '@hierarchidb/download';

export class HttpUrlStrategy implements IShapeDownloadStrategy {
  readonly id = 'http-url-default';

  supports(_task: BatchTaskLike): boolean {
    return true;
  }

  async download(task: BatchTaskLike): Promise<{ text: string; sizeBytes?: number; featureCount?: number }> {
    const url = this.buildUrl(task);
    const net = new FetchNetworkPort({ perHostConcurrency: 4, retries: 3 });
    const store = new DexieChunkStoragePort('hidb-chunks');
  const dl = new DownloadService(net, store, undefined as unknown as never);
    const taskConfig = task as BatchTaskLike & { config?: { country?: string; adminLevel?: number; dataSource?: string } };
    const fileId = `${task.sessionId}-${taskConfig.config?.country ?? 'unknown'}-L${taskConfig.config?.adminLevel ?? 0}`;
    const res = await dl.download(url, fileId, {});
    let text: string;
    if (typeof store.readAll === 'function') {
  const buf = await (store as { readAll: (id: string) => Promise<Uint8Array | ArrayBuffer> }).readAll(fileId);
      text = new TextDecoder('utf-8').decode(new Uint8Array(buf));
    } else {
      const { authFetch } = await import('../../utils/authFetch.js');
      text = await (await authFetch(url)).text();
    }
    return { text, sizeBytes: res.sizeBytes };
  }

  private buildUrl(task: BatchTaskLike): string {
    const taskConfig = task as BatchTaskLike & { config?: { dataSource?: string; country?: string; adminLevel?: number } };
    const dataSource = (taskConfig.config?.dataSource || 'gadm').toLowerCase();
    const country = taskConfig.config?.country || 'JP';
    const level = taskConfig.config?.adminLevel || 0;
    switch (dataSource) {
      case 'gadm':
        return `https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_${country}_${level}.json`;
      case 'naturalearth': {
        const scale = level === 0 ? '10m' : level === 1 ? '50m' : '110m';
        return `https://www.naturalearthdata.com/http//www.naturalearthdata.com/download/${scale}/cultural/ne_${scale}_admin_${level}_countries.geojson`;
      }
      case 'geoboundaries': {
        const levels = ['ADM0', 'ADM1', 'ADM2', 'ADM3', 'ADM4'];
        return `https://www.geoboundaries.org/api/current/gbOpen/${country}/${levels[level]}/`;
      }
      default:
        return `https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_${country}_${level}.json`;
    }
  }
}
