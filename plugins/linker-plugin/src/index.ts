// Minimal entry with UI steps registration for Linker
import './ui/steps-provider';
import { PLUGIN_MANIFEST } from './plugin-manifest.js';

export { PLUGIN_MANIFEST as LinkerPluginManifest } from './plugin-manifest.js';

export const version = PLUGIN_MANIFEST.version;
const Index = {} as const;
export { Index };
