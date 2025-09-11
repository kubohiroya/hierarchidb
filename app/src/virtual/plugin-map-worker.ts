// Fallback for virtual:plugin-map-worker when Vite plugin is not active
// This provides an empty plugin loader map so the worker can still initialize.
export const pluginMap: Record<string, () => Promise<unknown>> = {};

export default pluginMap;

