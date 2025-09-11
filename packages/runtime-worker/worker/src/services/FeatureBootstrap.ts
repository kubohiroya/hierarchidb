import { FeatureRegistry } from '@hierarchidb/feature-registry';

// Import feature definitions (static list for now; scanning can be added later)
import { featureDefinition as tag } from '@hierarchidb/tag';
import { featureDefinition as ie } from '@hierarchidb/import-export';
import { featureDefinition as tabular } from '@hierarchidb/tabular';
// tabular-xlsx is optional; load lazily in bootstrap below
import { featureDefinition as compute } from '@hierarchidb/compute';
import { featureDefinition as batch } from '@hierarchidb/batch';
import { featureDefinition as download } from '@hierarchidb/download';
import { featureDefinition as mapSource } from '@hierarchidb/map-source';
import { featureDefinition as authRecovery } from '@hierarchidb/auth-recovery';

export async function bootstrapFeatures(): Promise<FeatureRegistry> {
  const registry = new FeatureRegistry();
  [tag, ie, tabular, compute, batch, download, mapSource, authRecovery].forEach((f) => registry.register(f));
  // Optional: map-adapter (UI adapter only)
  try {
    const name = '@' + 'hierarchidb/map-adapter';
    const mod: any = await import(/* @vite-ignore */ (name as string));
    if (mod?.featureDefinition) registry.register(mod.featureDefinition);
  } catch {
    // optional, ignore
  }
  // Optional feature: tabular-xlsx
  try {
    const mod: any = await import(/* @vite-ignore */ '@hierarchidb/tabular-xlsx');
    if (mod?.featureDefinition) registry.register(mod.featureDefinition);
  } catch {
    // optional, ignore
  }
  await registry.startAll();
  return registry;
}
