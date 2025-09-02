import { FeatureRegistry } from '@hierarchidb/feature-registry';

// Import feature definitions (static list for now; scanning can be added later)
import { featureDefinition as tag } from '@hierarchidb/tag';
import { featureDefinition as ie } from '@hierarchidb/import-export';
import { featureDefinition as tabular } from '@hierarchidb/tabular';
import { featureDefinition as tabularXlsx } from '@hierarchidb/tabular-xlsx';
import { featureDefinition as compute } from '@hierarchidb/compute';
import { featureDefinition as batch } from '@hierarchidb/batch';
import { featureDefinition as download } from '@hierarchidb/download';
import { featureDefinition as mapSource } from '@hierarchidb/map-source';
import { featureDefinition as mapView } from '@hierarchidb/map-view';

export async function bootstrapFeatures(): Promise<FeatureRegistry> {
  const registry = new FeatureRegistry();
  [tag, ie, tabular, tabularXlsx, compute, batch, download, mapSource, mapView].forEach((f) => registry.register(f));
  await registry.startAll();
  return registry;
}

