import { expose } from 'comlink';
import {
  geosArea,
  geosBbox,
  geosClip,
  geosContains,
  geosIsValid,
  geosMakeValid,
  geosSimplify,
  initGeos,
} from '@hierarchidb/gis-sdk';
import type { GeosWorkerApi } from './geosWorker.types.ts';

const initPromise = initGeos();

const ensureReady = async (): Promise<void> => {
  await initPromise;
};

const api: GeosWorkerApi = {
  async init() {
    await ensureReady();
  },
  async area(geojson) {
    await ensureReady();
    return geosArea(geojson);
  },
  async bbox(geojson) {
    await ensureReady();
    return geosBbox(geojson);
  },
  async clip(feature, bbox) {
    await ensureReady();
    return geosClip(feature, bbox);
  },
  async simplify(geojson, tolerance, options) {
    await ensureReady();
    return geosSimplify(geojson, tolerance, {
      preserveTopology: options?.preserveTopology ?? true,
    });
  },
  async isValid(geojson) {
    await ensureReady();
    return geosIsValid(geojson);
  },
  async makeValid(geojson) {
    await ensureReady();
    return geosMakeValid(geojson);
  },
  async contains(left, right) {
    await ensureReady();
    return geosContains(left, right);
  },
};

expose(api);
