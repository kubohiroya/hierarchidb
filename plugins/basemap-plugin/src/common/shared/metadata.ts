import type { PluginMetadata } from '@hierarchidb/plugin-service-api';
import { PLUGIN_MANIFEST } from '../../plugin-manifest.js';

/**
 * Re-export plugin manifest for shared layer consumers.
 */
export const BaseMapPluginMetadata: PluginMetadata = PLUGIN_MANIFEST;
