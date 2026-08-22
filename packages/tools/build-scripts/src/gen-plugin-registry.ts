/**
 * Script: gen-plugin-registry
 * Purpose: Generate the canonical plugin registry artefact consumed by both the app and
 *          runtime-worker worker. The registry is emitted to `packages/plugin-registry/generated/registry.ts`
 *          and other consumers derive runtime-worker data from that single source.
 * Invocation: executed via `pnpm --filter @hierarchidb/tools-stage-scripts run gen-plugin-registry`
 *             (root alias: `pnpm run tools:gen-plugin-registry`).
 * Output: writes `packages/plugin-registry/generated/registry.ts`. Legacy artefacts
 *         under `app/src/generated/*`, `app/src/plugin-registry/generated/*`,
 *         `packages/runtime-worker/worker/src/generated/*`, and `types/generated/*` are removed.
 */
import { promises as fs } from 'node:fs';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { removeLegacyArtifacts, writeFileIfChanged } from './plugin-registry/fs-utils.js';
import { collectManifests } from './plugin-registry/manifest-collector.js';
import {
  registryDatabaseLoadersFile,
  registryDeclarationsFile,
  registryDerivationsFile,
  registryGeneratedDir,
  registryIconLoadersFile,
  registryOutputFile,
  registryPluginDefinitionsFile,
  registryUiLoadersFile,
  registryWorkerLoadersFile,
} from './plugin-registry/paths.js';
import {
  generateDatabaseLoadersSource,
  generateDerivationsSource,
  generateIconLoadersSource,
  generateModuleDeclarationSource,
  generatePluginDefinitionsSource,
  generateRegistrySource,
  generateUiLoadersSource,
  generateWorkerLoadersSource,
} from './plugin-registry/registry-generator.js';
import type {
  GeneratePluginRegistryOptions,
  PluginSpecifierMode,
} from './plugin-registry/types.js';
import { validateEntryPaths } from './plugin-registry/validator.js';

export async function generatePluginRegistry(
  options: GeneratePluginRegistryOptions = {}
): Promise<void> {
  const requestedMode = (
    options.mode ??
    (process.env.HDB_PLUGIN_SPEC_MODE as PluginSpecifierMode | undefined) ??
    'package'
  ).toLowerCase() as PluginSpecifierMode;
  const summaries = await collectManifests(requestedMode);
  validateEntryPaths(summaries, requestedMode);
  const registrySource = generateRegistrySource(summaries, requestedMode);
  const declarationSource = generateModuleDeclarationSource(summaries);
  const uiLoadersSource = generateUiLoadersSource(summaries, requestedMode);
  const workerLoadersSource = generateWorkerLoadersSource(summaries, requestedMode);
  const iconLoadersSource = generateIconLoadersSource(summaries);
  const databaseLoadersSource = generateDatabaseLoadersSource(summaries, requestedMode);
  const pluginDefinitionsSource = generatePluginDefinitionsSource();
  const derivationsSource = generateDerivationsSource();
  await fs.mkdir(registryGeneratedDir, { recursive: true });
  const registryChanged = await writeFileIfChanged(registryOutputFile, registrySource);
  const declarationsChanged = await writeFileIfChanged(registryDeclarationsFile, declarationSource);
  const uiLoadersChanged = await writeFileIfChanged(registryUiLoadersFile, uiLoadersSource);
  const workerLoadersChanged = await writeFileIfChanged(
    registryWorkerLoadersFile,
    workerLoadersSource
  );
  const iconLoadersChanged = await writeFileIfChanged(registryIconLoadersFile, iconLoadersSource);
  const databaseLoadersChanged = await writeFileIfChanged(
    registryDatabaseLoadersFile,
    databaseLoadersSource
  );
  const derivationsChanged = await writeFileIfChanged(registryDerivationsFile, derivationsSource);
  const pluginDefinitionsChanged = await writeFileIfChanged(
    registryPluginDefinitionsFile,
    pluginDefinitionsSource
  );
  await removeLegacyArtifacts();

  console.log('[generate-plugin-registry] updated files', {
    registry: registryChanged,
    declarations: declarationsChanged,
    uiLoaders: uiLoadersChanged,
    workerLoaders: workerLoadersChanged,
    iconLoaders: iconLoadersChanged,
    databaseLoaders: databaseLoadersChanged,
    derivations: derivationsChanged,
    pluginDefinitions: pluginDefinitionsChanged,
  });
}

const isExecutedAsEntry = (() => {
  const entryPath = process.argv[1];
  if (!entryPath) return false;
  return pathToFileURL(entryPath).href === import.meta.url;
})();

if (isExecutedAsEntry) {
  await generatePluginRegistry();
}
