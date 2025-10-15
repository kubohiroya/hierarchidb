import { PluginMetadata } from '@hierarchidb/plugin-api';
import { PLUGIN_MANIFEST } from '../../plugin-manifest.js';

/**
 * Re-export plugin manifest for shared layer consumers.
 */
export const BaseMapPluginMetadata: PluginMetadata = PLUGIN_MANIFEST;
