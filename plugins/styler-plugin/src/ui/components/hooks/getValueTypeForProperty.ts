import {
  MAPLIBRE_PROPERTY_METADATA,
  type StylerValueType,
  type MapLibreStyleProperty,
} from '@hierarchidb/styler-plugin';

export const getValueTypeForProperty = (property: MapLibreStyleProperty|null): StylerValueType => {

  if(! property) return 'color';

  const normalized = property.toLowerCase();
  if (normalized.endsWith('color')) return 'color';
  if (normalized.endsWith('opacity') || normalized.endsWith('radius') || normalized.endsWith('width')) {
    return 'number';
  }
  return MAPLIBRE_PROPERTY_METADATA[property]?.type ?? 'color';
};
