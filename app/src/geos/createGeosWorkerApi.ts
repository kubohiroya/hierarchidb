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
import {
  getOriginCoordinatorSourceSha,
  installOriginCoordinatorBridgeResponder,
} from '@hierarchidb/origin-coordinator';
import { type Endpoint, expose } from 'comlink';
import type { GeosWorkerApi } from './geosWorkerTypes.ts';

const shouldAutoExpose =
  typeof self !== 'undefined' &&
  typeof (self as { postMessage?: unknown }).postMessage === 'function' &&
  typeof (self as { document?: unknown }).document === 'undefined';

if (shouldAutoExpose) {
  installOriginCoordinatorBridgeResponder({
    target: globalThis.navigator.serviceWorker,
    releaseId: getOriginCoordinatorSourceSha(),
    revokeLegacyYamlAccess: () => undefined,
  });
}

const initPromise = initGeos();

const ensureReady = async (): Promise<void> => {
  await initPromise;
};

export const createGeosWorkerApi = (): GeosWorkerApi => ({
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
  async simplifyRepeated(geojson, tolerance, repeats, options) {
    await ensureReady();
    const preserveTopology = options?.preserveTopology ?? true;
    let current = geojson;
    for (let i = 0; i < repeats; i += 1) {
      current = geosSimplify(current, tolerance, { preserveTopology });
    }
    return current;
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
});

export const exposeGeosWorker = (endpoint?: Endpoint): void => {
  expose(createGeosWorkerApi(), endpoint);
};

if (shouldAutoExpose) {
  exposeGeosWorker();
}
