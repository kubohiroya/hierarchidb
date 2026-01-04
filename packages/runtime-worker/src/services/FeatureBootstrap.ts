//import { FeatureRegistry } from '@hierarchidb/features-registry';
//import { importOptionalFeature } from '@hierarchidb/runtime-worker-shared-module-paths';
// Import features definitions (static list for now; scanning can be added later)

import { FeatureDefinition as AuthRecoveryFeatureDefinition } from '@hierarchidb/auth-recovery';
import { FeatureDefinition as DownloadFeatureDefinition } from '@hierarchidb/download';
import type { FeatureDefinition as FeatureDefinitionContract } from '@hierarchidb/feature-registry';
import { FeatureRegistry } from '@hierarchidb/feature-registry';
import { FeatureDefinition as ImportExportFeatureDefinition } from '@hierarchidb/import-export';
import { FeatureDefinition as MapSourceFeatureDefinition } from '@hierarchidb/map-source';
import { FeatureDefinition as TabularFeatureDefinition } from '@hierarchidb/tabular-source';
import { FeatureDefinition as TagFeatureDefinition } from '@hierarchidb/tag';

export async function bootstrapFeatures(): Promise<FeatureRegistry> {
  const registry = new FeatureRegistry();
  const coreDefinitions = [
    TagFeatureDefinition,
    ImportExportFeatureDefinition,
    TabularFeatureDefinition,
    // BatchFeatureDefinition,
    DownloadFeatureDefinition,
    MapSourceFeatureDefinition,
    AuthRecoveryFeatureDefinition,
  ];
  for (const definition of coreDefinitions) {
    registry.register(definition);
  }

  const isFeatureModule = (
    candidate: unknown
  ): candidate is { FeatureDefinition: FeatureDefinitionContract } =>
    Boolean(
      candidate &&
        typeof candidate === 'object' &&
        'FeatureDefinition' in candidate &&
        (candidate as { FeatureDefinition?: FeatureDefinitionContract }).FeatureDefinition
    );

  const registerOptionalDefinition = async (loader: () => Promise<unknown>) => {
    try {
      const mod = await loader();
      if (isFeatureModule(mod)) {
        registry.register(mod.FeatureDefinition);
      }
    } catch {
      // optional, ignore
    }
  };

  await registerOptionalDefinition(() => import('@hierarchidb/map-adapter'));
  await registerOptionalDefinition(() => import('@hierarchidb/tabular-source-xlsx'));
  await registry.startAll();
  return registry;
}
