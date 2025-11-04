import {
  getPresentation as coreGetPresentation,
  getPresentations as coreGetPresentations,
  prefetchAllIcons as corePrefetchAllIcons,
  resetPluginPresentationCacheForTests as coreResetForTests,
  type PluginPresentation,
  type PluginPresentationDefinition,
  type PluginPresentationManifest,
  setPluginPresentationDefinitions,
} from '@hierarchidb/feature-core/plugin-presentation';
import type {
  PluginIconConfig,
  PluginManifest,
} from '@hierarchidb/feature-core/plugin-registry/types';
import { getInstalledPlugins, type InstalledPlugin } from './plugin-registry.js';

let currentSignature: string | null = null;

function normalizeManifestIcon(icon: PluginIconConfig | undefined | null) {
  if (!icon) return undefined;
  const component = icon.component ? { specifier: icon.component.specifier ?? null } : null;
  return {
    mui: icon.mui,
    muiIconName: icon.muiIconName,
    emoji: icon.emoji,
    color: icon.color,
    component,
  } satisfies PluginPresentationManifest['icon'];
}

function toPresentationManifest(
  manifest: PluginManifest | null
): PluginPresentationManifest | undefined {
  if (!manifest) return undefined;
  return {
    displayName: manifest.displayName ?? undefined,
    name: manifest.name ?? undefined,
    description: manifest.description ?? undefined,
    priority: manifest.priority ?? undefined,
    icon: normalizeManifestIcon(manifest.icon ?? undefined),
  } satisfies PluginPresentationManifest;
}

function mapToDefinition(plugin: InstalledPlugin): PluginPresentationDefinition {
  return {
    nodeType: plugin.nodeType,
    label: plugin.label,
    icon: plugin.icon ?? undefined,
    manifest: toPresentationManifest(plugin.manifest),
    createOrder: plugin.createOrder,
  };
}

function createSignature(defs: InstalledPlugin[]): string {
  try {
    const parts = defs.map((plugin) => [
      plugin.nodeType,
      plugin.label ?? '',
      plugin.icon?.muiIconName ?? '',
      plugin.icon?.color ?? '',
      plugin.manifest?.priority ?? '',
      plugin.createOrder ?? '',
    ]);
    return JSON.stringify(parts);
  } catch {
    return '';
  }
}

function ensureDefinitions(): void {
  const installed = getInstalledPlugins();
  const signature = createSignature(installed);
  if (signature === currentSignature) return;
  setPluginPresentationDefinitions(installed.map(mapToDefinition));
  currentSignature = signature;
}

export function getPresentation(nodeType: string): PluginPresentation | undefined {
  ensureDefinitions();
  return coreGetPresentation(nodeType);
}

export function getPresentations(): PluginPresentation[] {
  ensureDefinitions();
  return coreGetPresentations();
}

export async function prefetchAllIcons(): Promise<void> {
  ensureDefinitions();
  await corePrefetchAllIcons();
}

export function resetPluginPresentationCacheForTests(): void {
  currentSignature = null;
  coreResetForTests();
}

export type { PluginPresentation } from '@hierarchidb/feature-core/plugin-presentation';
