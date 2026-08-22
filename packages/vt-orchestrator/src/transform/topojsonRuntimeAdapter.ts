import type { Feature, FeatureCollection } from 'geojson';
import type { Topology } from 'topojson-specification';

type TopojsonClientModule = {
  feature: (topology: Topology, object: Topology['objects'][string]) => FeatureCollection | Feature;
};

type TopojsonServerModule = {
  topology: (objects: Record<string, unknown>) => Topology;
};

type TopojsonSimplifyModule = {
  presimplify: (topology: Topology) => Topology;
  simplify: (topology: Topology, minWeight?: number) => Topology;
};

export type TopojsonRuntime = {
  feature: TopojsonClientModule['feature'];
  topology: TopojsonServerModule['topology'];
  presimplify: TopojsonSimplifyModule['presimplify'];
  simplify: TopojsonSimplifyModule['simplify'];
};

let topojsonRuntimePromise: Promise<TopojsonRuntime> | null = null;
let topojsonRuntimeLoadCount = 0;

const loadTopojsonRuntime = async (): Promise<TopojsonRuntime> => {
  if (!topojsonRuntimePromise) {
    topojsonRuntimeLoadCount += 1;
    topojsonRuntimePromise = (async () => {
      const [client, server, simplify] = await Promise.all([
        import('topojson-client') as Promise<TopojsonClientModule>,
        import('topojson-server') as Promise<TopojsonServerModule>,
        import('topojson-simplify') as Promise<TopojsonSimplifyModule>,
      ]);
      return {
        feature: client.feature,
        topology: server.topology,
        presimplify: simplify.presimplify,
        simplify: simplify.simplify,
      };
    })();
  }
  return topojsonRuntimePromise;
};

export const getTopojsonRuntime = async (): Promise<TopojsonRuntime> => loadTopojsonRuntime();

export const __getTopojsonRuntimeLoadCount = (): number => topojsonRuntimeLoadCount;

export const __resetTopojsonRuntimeForTests = (): void => {
  topojsonRuntimePromise = null;
  topojsonRuntimeLoadCount = 0;
};
