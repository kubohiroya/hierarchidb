import type { PluginMetadata } from '@hierarchidb/common-type';
import { PLUGIN_MANIFEST } from '../extension/plugin-manifest.js';

/**
 * Re-export plugin manifest for shared layer consumers.
 */
export const BaseMapPluginMetadata: PluginMetadata = PLUGIN_MANIFEST;
