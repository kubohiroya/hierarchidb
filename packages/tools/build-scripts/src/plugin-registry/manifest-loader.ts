import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { fileExists } from './fs-utils.js';
import { repoRoot } from './paths.js';

type PluginManifestLoader = (manifestPath: string) => Promise<unknown>;

let loader: PluginManifestLoader | null = null;
let resolved = false;

async function resolveLoader(): Promise<PluginManifestLoader | null> {
  if (resolved) return loader;
  resolved = true;

  try {
    const imported = await import('@hierarchidb/tools-load-plugin-manifest');
    loader = imported.loadPluginManifestFromFile as PluginManifestLoader;
    return loader;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[generate-plugin-registry] Failed to load manifest loader via workspace import:', message);
  }

  const fallbackDist = path.join(repoRoot, 'packages', 'tools', 'load-plugin-manifest', 'dist', 'index.js');
  if (await fileExists(fallbackDist)) {
    try {
      const imported = await import(pathToFileURL(fallbackDist).href);
      loader = imported.loadPluginManifestFromFile as PluginManifestLoader;
      console.warn('[generate-plugin-registry] Fallback: loaded manifest loader from local dist stage.');
      return loader;
    } catch (fallbackError) {
      const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      console.warn('[generate-plugin-registry] Fallback import failed:', fallbackMessage);
    }
  } else {
    console.warn('[generate-plugin-registry] Fallback dist missing at', fallbackDist);
  }

  console.warn('[generate-plugin-registry] Continuing without manifest introspection.');
  return null;
}

export async function loadPluginManifestFromFile(manifestPath: string): Promise<unknown> {
  const resolvedLoader = await resolveLoader();
  if (!resolvedLoader) {
    return undefined;
  }
  return resolvedLoader(manifestPath);
}
