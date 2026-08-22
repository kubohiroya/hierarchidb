import { PLUGIN_MANIFEST } from './plugin-manifest.js';

export { PLUGIN_MANIFEST as TimelinePluginManifest } from './plugin-manifest.js';
export type { TimelineFrame } from './services/index.js';
export { TimelineFramesService, timelineServices } from './services/index.js';

export const version = PLUGIN_MANIFEST.version;
const Index = {};
export { Index };

let initialized = false;

export async function onRegister(): Promise<void> {
  if (initialized) return;
  initialized = true;
  // Timeline plugin has no stateful dependencies to warm up at the moment.
}
