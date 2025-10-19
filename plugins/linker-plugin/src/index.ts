// Minimal entry with UI steps registration for Linker
import './ui/index.js';
import { PLUGIN_MANIFEST } from './plugin-manifest.js';

export { PLUGIN_MANIFEST as LinkerPluginManifest } from './plugin-manifest.js';
export { LinkerResourceService, linkerServices, type LinkerResource } from './services/index.js';

export const version = PLUGIN_MANIFEST.version;
const Index = {} as const;
export { Index };

let initialized = false;

export async function onRegister(): Promise<void> {
  if (initialized) return;
  initialized = true;
  // Linker plugin currently exposes only in-memory services; nothing to pre-initialize.
}
