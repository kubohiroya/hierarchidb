import type { LocationDataSource, LocationSearchConfig } from '~/common/entities/LocationEntity.js';
import {
  LOCATION_CANONICAL_LOCATION_TYPES,
  LOCATION_CANONICAL_NETWORK_DATA_SOURCES,
  type LocationCanonicalNetworkDataSource,
  type LocationSourcePlan,
  type LocationSourceSelectionEntry,
} from './LocationSourcePlan.js';
import { createLocationSourcePlanIdentity } from './locationSourceIdentityUtils.js';

const CANONICAL_NETWORK_SOURCE_SET = new Set<LocationDataSource>(
  LOCATION_CANONICAL_NETWORK_DATA_SOURCES
);

export const isCanonicalLocationNetworkDataSource = (
  value: LocationDataSource
): value is LocationCanonicalNetworkDataSource => CANONICAL_NETWORK_SOURCE_SET.has(value);

export const createLocationSourcePlan = (input: {
  dataSource: LocationDataSource;
  selectedArrayByCountries: Record<string, readonly boolean[]>;
}): LocationSourcePlan => {
  if (!isCanonicalLocationNetworkDataSource(input.dataSource)) {
    throw new Error(
      `[location source plan] ${input.dataSource} does not have a canonical Worker source strategy`
    );
  }
  const selection = createSelection(input.selectedArrayByCountries);
  const searchConfigs = selection.map(
    (entry): LocationSearchConfig => ({
      dataSource: input.dataSource,
      countryCode: entry.countryCode,
      types: [...entry.types],
    })
  );
  return {
    sourceKind: 'network',
    dataSource: input.dataSource,
    selection,
    searchConfigs,
    identity: createLocationSourcePlanIdentity({
      dataSource: input.dataSource,
      selection,
      searchConfigs,
    }),
  };
};

const createSelection = (
  selectedArrayByCountries: Record<string, readonly boolean[]>
): readonly LocationSourceSelectionEntry[] => {
  const selection = Object.entries(selectedArrayByCountries)
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([rawCountryCode, rawRow]) => {
      if (!/^[A-Z]{2}$/.test(rawCountryCode)) {
        throw new Error(
          `[location source plan] selected country code must be an uppercase ISO 3166-1 alpha-2 code: ${rawCountryCode}`
        );
      }
      if (!Array.isArray(rawRow) || rawRow.length !== LOCATION_CANONICAL_LOCATION_TYPES.length) {
        throw new Error(
          `[location source plan] selection row for ${rawCountryCode} must contain ${String(LOCATION_CANONICAL_LOCATION_TYPES.length)} booleans`
        );
      }
      if (!rawRow.every((selected) => typeof selected === 'boolean')) {
        throw new Error(
          `[location source plan] selection row for ${rawCountryCode} must contain only booleans`
        );
      }
      const types = LOCATION_CANONICAL_LOCATION_TYPES.filter((_type, index) => rawRow[index]);
      return types.length === 0 ? [] : [{ countryCode: rawCountryCode, types }];
    });
  if (selection.length === 0) {
    throw new Error(
      '[location source plan] selectedArrayByCountries must select at least one location type'
    );
  }
  return selection;
};
