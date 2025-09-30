type MapLibreModule = typeof import('maplibre-gl');

let cachedModule: MapLibreModule | null = null;
let modulePromise: Promise<MapLibreModule | null> | null = null;

export const loadMapLibreModule = async (): Promise<MapLibreModule | null> => {
  if (cachedModule) return cachedModule;
  if (!modulePromise) {
    modulePromise = import('maplibre-gl')
      .then((mod) => {
        cachedModule = mod;
        return mod;
      })
      .catch((error) => {
        if (typeof console !== 'undefined') {
          console.warn('[ui-map] Failed to load maplibre-gl', error);
        }
        return null;
      });
  }
  return modulePromise;
};

export const resetMapLibreModuleForTests = () => {
  cachedModule = null;
  modulePromise = null;
};
