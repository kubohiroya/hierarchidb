import { pluginRegistry as canonicalRegistry } from '@hierarchidb/plugin-registry';
import { pluginDefinitions as canonicalDefinitions } from '@hierarchidb/plugin-registry/plugin-definitions';
import type { PluginDefinition, PluginRegistryEntry } from '@hierarchidb/plugin-registry/types';

export const pluginRegistry: PluginRegistryEntry[] = canonicalRegistry;

export const pluginDefinitions: PluginDefinition[] = canonicalDefinitions;
