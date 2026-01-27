import type { Country } from '@hierarchidb/ui-country-select';
import type { IdeGsmSelectionEntry } from '@hierarchidb/plugin-service-api';
import type { LocationPointProperties, LocationType } from '@hierarchidb/location-store';

export const buildIdeGsmSelectionHash = (selection: Record<string, boolean[]>): string => {
  const keys = Object.keys(selection).sort();
  if (keys.length === 0) return '';
  return keys
    .map((key) => {
      const row = selection[key] ?? [];
      const flags = row.map((value) => (value ? '1' : '0')).join('');
      return `${key}:${flags}`;
    })
    .join('|');
};

export const buildAvailabilityMapFromIdeGsmPoints = (
  points: LocationPointProperties[],
  baseTypes: ReadonlyArray<{ id: LocationType }>,
): Record<string, boolean[]> => {
  const typeIndex = new Map(baseTypes.map((typeDef, index) => [typeDef.id, index]));
  const availabilityMap: Record<string, boolean[]> = {};
  points.forEach((point) => {
    const countryCode = point.countryCode?.toUpperCase();
    if (!countryCode) return;
    const idx = typeIndex.get(point.type as LocationType);
    if (idx == null) return;
    if (!availabilityMap[countryCode]) {
      availabilityMap[countryCode] = Array(baseTypes.length).fill(false);
    }
    availabilityMap[countryCode][idx] = true;
  });
  return availabilityMap;
};

export const buildSelectionMapFromAvailability = (
  availabilityMap: Record<string, boolean[]>,
): Record<string, boolean[]> => {
  const selectionMap: Record<string, boolean[]> = {};
  Object.entries(availabilityMap).forEach(([countryCode, row]) => {
    selectionMap[countryCode] = row.slice();
  });
  return selectionMap;
};

export const buildSelectionMapFromIdeGsmPoints = (
  points: LocationPointProperties[],
  baseTypes: ReadonlyArray<{ id: LocationType }>,
): Record<string, boolean[]> => (
  buildSelectionMapFromAvailability(buildAvailabilityMapFromIdeGsmPoints(points, baseTypes))
);

export const buildIdeGsmSelectionEntries = (
  selection: Record<string, boolean[]>,
  countries: Country[],
  baseTypes: ReadonlyArray<{ id: LocationType }>,
): IdeGsmSelectionEntry[] => {
  const countryNameByCode = new Map(countries.map((country) => [country.code, country.name]));
  const entries: IdeGsmSelectionEntry[] = [];
  Object.entries(selection).forEach(([countryCode, row]) => {
    const types = row
      .map((selected, index) => (selected ? baseTypes[index]?.id : undefined))
      .filter((value): value is LocationType => Boolean(value));
    if (types.length === 0) return;
    entries.push({
      countryCode: countryCode,
      countryName: countryNameByCode.get(countryCode) ?? countryCode,
      types: types.map((type) => type as string),
    });
  });
  return entries;
};
