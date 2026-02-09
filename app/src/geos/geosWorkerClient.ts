import type { Feature } from 'geojson';
import type { Remote } from 'comlink';
import { releaseProxy, wrap } from 'comlink';
import type { Bbox, GeoJSON, GeosSimplifyOptions, GeosWorkerApi } from './geosWorker.types.ts';

const IDLE_TIMEOUT_MS = 30_000;

let geosWorker: Worker | null = null;
let geosApi: Remote<GeosWorkerApi> | null = null;
let geosApiPromise: Promise<Remote<GeosWorkerApi>> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let inFlight = 0;

const createWorker = (): Worker => new Worker(
  new URL('./geosWorker.entry.ts', import.meta.url),
  { type: 'module' },
);

const clearIdleTimer = (): void => {
  if (!idleTimer) return;
  clearTimeout(idleTimer);
  idleTimer = null;
};

const shutdownWorker = (): void => {
  clearIdleTimer();
  if (geosApi) {
    const releaser = (geosApi as unknown as { [releaseProxy]?: () => void | Promise<void> })[releaseProxy];
    if (releaser) {
      void Promise.resolve(releaser());
    }
  }
  geosWorker?.terminate();
  geosWorker = null;
  geosApi = null;
  geosApiPromise = null;
};

const scheduleIdleShutdown = (): void => {
  clearIdleTimer();
  idleTimer = setTimeout(() => {
    if (inFlight > 0) {
      scheduleIdleShutdown();
      return;
    }
    shutdownWorker();
  }, IDLE_TIMEOUT_MS);
};

const ensureClient = async (): Promise<Remote<GeosWorkerApi>> => {
  if (geosApi) return geosApi;
  if (geosApiPromise) return geosApiPromise;
  if (typeof Worker === 'undefined') {
    throw new Error('Geos worker is not available in this environment.');
  }
  geosApiPromise = (async () => {
    const worker = createWorker();
    geosWorker = worker;
    const api = wrap<GeosWorkerApi>(worker);
    await api.init();
    geosApi = api;
    scheduleIdleShutdown();
    return api;
  })().catch((error) => {
    shutdownWorker();
    throw error;
  });
  return geosApiPromise;
};

const callWithClient = async <T>(call: (client: Remote<GeosWorkerApi>) => Promise<T>): Promise<T> => {
  const client = await ensureClient();
  clearIdleTimer();
  inFlight += 1;
  try {
    return await call(client);
  } finally {
    inFlight = Math.max(0, inFlight - 1);
    if (inFlight === 0) {
      scheduleIdleShutdown();
    }
  }
};

export const geosWorkerClient = {
  area: (geojson: GeoJSON): Promise<number> => callWithClient((client) => client.area(geojson)),
  bbox: (geojson: GeoJSON): Promise<Bbox | null> => callWithClient((client) => client.bbox(geojson)),
  clip: (feature: Feature, bbox: Bbox): Promise<Feature | null> => callWithClient((client) => client.clip(feature, bbox)),
  simplify: (geojson: GeoJSON, tolerance: number, options?: GeosSimplifyOptions): Promise<GeoJSON> => (
    callWithClient(async (client) => {
      const result = await client.simplify(geojson, tolerance, options);
      return result as GeoJSON;
    })
  ),
  isValid: (geojson: GeoJSON): Promise<boolean> => callWithClient((client) => client.isValid(geojson)),
  makeValid: (geojson: GeoJSON): Promise<GeoJSON> => (
    callWithClient(async (client) => {
      const result = await client.makeValid(geojson);
      return result as GeoJSON;
    })
  ),
  contains: (left: GeoJSON, right: GeoJSON): Promise<boolean> => callWithClient((client) => client.contains(left, right)),
  shutdown: (): void => shutdownWorker(),
};
