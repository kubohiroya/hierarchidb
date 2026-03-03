import type { PluginManifest } from '@hierarchidb/plugin-base';
import { PLUGIN_MANIFEST } from '~/plugin-manifest';

/**
 * Re-export plugin manifest for shared layer consumers.
 */
export const BaseMapPluginManifest: PluginManifest = PLUGIN_MANIFEST;
