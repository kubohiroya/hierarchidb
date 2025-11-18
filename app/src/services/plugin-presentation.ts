import {
  getPresentation as coreGetPresentation,
  getPresentations as coreGetPresentations,
  prefetchAllIcons as corePrefetchAllIcons,
  resetPluginPresentationCacheForTests as coreResetForTests,
  type PluginPresentation,
  type PluginPresentationDefinition,
  type PluginPresentationManifest,
  setPluginPresentationDefinitions,
} from '@hierarchidb/plugin-presentation';
import { i18n } from '@hierarchidb/ui-i18n';
import type {
  PluginIconConfig,
  PluginManifest,
} from '@hierarchidb/plugin-registry/types';
import { getInstalledPlugins, type InstalledPlugin } from './plugin-registry.js';

let currentSignature: string | null = null;
let languageListenerAttached = false;

const PLUGIN_TRANSLATION_NAMESPACE = 'common';

const getLocalizedPluginDescription = (
  nodeType: string,
  fallback?: string
): string | undefined => {
  const key = `plugins.${nodeType}.description`;
  try {
    const translator =
      typeof i18n.getFixedT === 'function'
        ? i18n.getFixedT(i18n.language ?? 'en', PLUGIN_TRANSLATION_NAMESPACE)
        : typeof i18n.t === 'function'
          ? (translationKey: string, options?: Record<string, unknown>) =>
              i18n.t(translationKey, { ns: PLUGIN_TRANSLATION_NAMESPACE, ...(options ?? {}) })
          : undefined;
    const translated = translator?.(key, { defaultValue: fallback ?? '' });
    if (translated && typeof translated === 'string') {
      const trimmed = translated.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  } catch {
    // Ignore translation failures and fall back to manifest provided description
  }
  return fallback;
};

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
  nodeType: string,
  manifest: PluginManifest | null
): PluginPresentationManifest | undefined {
  if (!manifest) return undefined;
  return {
    displayName: manifest.displayName ?? undefined,
    name: manifest.name ?? undefined,
    description: getLocalizedPluginDescription(nodeType, manifest.description ?? undefined),
    priority: manifest.priority ?? undefined,
    icon: normalizeManifestIcon(manifest.icon ?? undefined),
  } satisfies PluginPresentationManifest;
}

function mapToDefinition(plugin: InstalledPlugin): PluginPresentationDefinition {
  return {
    nodeType: plugin.nodeType,
    label: plugin.label,
    icon: plugin.icon ?? undefined,
    manifest: toPresentationManifest(plugin.nodeType, plugin.manifest),
    createOrder: plugin.createOrder,
  };
}

function createSignature(defs: InstalledPlugin[]): string {
  try {
    const languageTag = i18n.language ?? 'en';
    const parts = [languageTag];
    defs.forEach((plugin) => {
      parts.push([
        plugin.nodeType,
        plugin.label ?? '',
        plugin.icon?.muiIconName ?? '',
        plugin.icon?.color ?? '',
        plugin.manifest?.description ?? '',
        plugin.manifest?.priority ?? '',
        plugin.createOrder ?? '',
      ]);
    });
    return JSON.stringify(parts);
  } catch {
    return '';
  }
}

function attachLanguageListener(): void {
  if (languageListenerAttached) return;
  if (typeof i18n?.on === 'function') {
    i18n.on('languageChanged', () => {
      currentSignature = null;
      ensureDefinitions();
    });
    languageListenerAttached = true;
  }
}

function ensureDefinitions(): void {
  attachLanguageListener();
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

export type { PluginPresentation } from '@hierarchidb/plugin-presentation';
