// Minimal entry with UI steps registration for Linker
import './ui/steps-provider';
import { PLUGIN_MANIFEST } from './extension/plugin-manifest.js';

export { PLUGIN_MANIFEST as LinkerPluginManifest } from './extension/plugin-manifest.js';

export const version = PLUGIN_MANIFEST.version;
export default {} as const;
