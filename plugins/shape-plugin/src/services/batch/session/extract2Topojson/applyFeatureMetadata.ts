import type { FeatureCollection } from 'geojson';

export type FeatureMetadataToApply = {
  continent?: string;
  countryName?: string;
  countryCode?: string;
  adminCode?: string;
  originKey?: string;
  originKeyPropertyName?: string;
};

const applyIfMissingString = (
  properties: Record<string, unknown>,
  key: string,
  value: string | undefined,
): void => {
  if (!value) return;
  if (typeof properties[key] === 'string') return;
  properties[key] = value;
};

export const applyFeatureMetadata = (
  collection: FeatureCollection,
  meta: FeatureMetadataToApply,
): void => {
  for (const feature of collection.features) {
    if (!feature) continue;

    feature.properties ??= {} as Record<string, unknown>;
    const properties = feature.properties as Record<string, unknown>;

    applyIfMissingString(properties, 'continent', meta.continent);
    applyIfMissingString(properties, 'countryName', meta.countryName);
    applyIfMissingString(properties, 'countryCode', meta.countryCode);
    applyIfMissingString(properties, 'adminCode', meta.adminCode);

    if (meta.originKey && meta.originKeyPropertyName) {
      applyIfMissingString(properties, meta.originKeyPropertyName, meta.originKey);
    }
  }
};
