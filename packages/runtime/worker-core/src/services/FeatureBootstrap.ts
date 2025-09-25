import { FeatureRegistry } from '@hierarchidb/feature-registry';
import { importOptionalFeature } from '@hierarchidb/runtime-shared-module-paths';

// Import feature definitions (static list for now; scanning can be added later)
import { FeatureDefinition as TagFeatureDefinition } from '@hierarchidb/tag';
import { FeatureDefinition as ImportExportFeatureDefinition } from '@hierarchidb/import-export';
import { FeatureDefinition as TabularFeatureDefinition } from '@hierarchidb/tabular';
// tabular-xlsx is optional; load lazily in bootstrap below
import { FeatureDefinition as ComputeFeatureDefinition } from '@hierarchidb/compute';
import { FeatureDefinition as BatchFeatureDefinition } from '@hierarchidb/batch';
import { FeatureDefinition as DownloadFeatureDefinition } from '@hierarchidb/download';
import { FeatureDefinition as MapSourceFeatureDefinition } from '@hierarchidb/map-source';
import { FeatureDefinition as AuthRecoveryFeatureDefinition } from '@hierarchidb/auth-recovery';

export async function bootstrapFeatures(): Promise<FeatureRegistry> {
  const registry = new FeatureRegistry();
  [
    TagFeatureDefinition,
    ImportExportFeatureDefinition,
    TabularFeatureDefinition,
    ComputeFeatureDefinition,
    BatchFeatureDefinition,
    DownloadFeatureDefinition,
    MapSourceFeatureDefinition,
    AuthRecoveryFeatureDefinition,
  ].forEach((definition) => registry.register(definition));
  // Optional: map-adapter (UI adapter only)
  // Optional module: map-adapter
  await importOptionalFeature('mapAdapter')
    .then((mod: any) => {
      if (mod?.FeatureDefinition) registry.register(mod.FeatureDefinition);
    })
    .catch(() => {
      // optional, ignore
    });

  // Optional feature: tabular-xlsx
  await importOptionalFeature('tabularXlsx')
    .then((mod: any) => {
      if (mod?.FeatureDefinition) registry.register(mod.FeatureDefinition);
    })
    .catch(() => {
      // optional, ignore
    });
  await registry.startAll();
  return registry;
}
