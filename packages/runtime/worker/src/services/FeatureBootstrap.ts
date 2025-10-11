//import { FeatureRegistry } from '@hierarchidb/feature-registry';
//import { importOptionalFeature } from '@hierarchidb/runtime-shared-module-paths';

// Import feature definitions (static list for now; scanning can be added later)
import { FeatureDefinition as TagFeatureDefinition } from '@hierarchidb/tag';
import { FeatureDefinition as ImportExportFeatureDefinition } from '@hierarchidb/import-export';
import { FeatureDefinition as TabularFeatureDefinition } from '@hierarchidb/tabular';
// tabular-source-xlsx is optional; load lazily in bootstrap below
import { FeatureDefinition as ComputeFeatureDefinition } from '@hierarchidb/compute';
import { FeatureDefinition as DownloadFeatureDefinition } from '@hierarchidb/download';
import { FeatureDefinition as MapSourceFeatureDefinition } from '@hierarchidb/map-source';
import { FeatureDefinition as AuthRecoveryFeatureDefinition } from '@hierarchidb/auth-recovery';
import { FeatureRegistry } from '@hierarchidb/feature-registry';

export async function bootstrapFeatures(): Promise<FeatureRegistry> {
  const registry = new FeatureRegistry();
  [
    TagFeatureDefinition,
    ImportExportFeatureDefinition,
    TabularFeatureDefinition,
    ComputeFeatureDefinition,
    // BatchFeatureDefinition,
    DownloadFeatureDefinition,
    MapSourceFeatureDefinition,
    AuthRecoveryFeatureDefinition,
  ].forEach((definition) => registry.register(definition));
  // Optional: map-adapter (UI adapter only)
  // Optional module: map-adapter
  await import('@hierarchidb/map-adapter')
    .then((mod: any) => {
      if (mod?.FeatureDefinition) registry.register(mod.FeatureDefinition);
    })
    .catch(() => {
      // optional, ignore
    });

  // Optional feature: tabular-source-xlsx
  await import('@hierarchidb/tabular-xlsx')
    .then((mod: any) => {
      if (mod?.FeatureDefinition) registry.register(mod.FeatureDefinition);
    })
    .catch(() => {
      // optional, ignore
    });
  await registry.startAll();
  return registry;
}
