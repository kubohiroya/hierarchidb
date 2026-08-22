import type { ISO2 } from '@hierarchidb/core-types';
import type { IdeGsmRouteSelectionEntry } from './ideGsmRouteTypes.js';
import { ROUTE_MODES, type RouteMode } from './ROUTE_MODES.js';

export const IDE_GSM_ROUTE_SELECTION_MODE_ORDER = [
  ROUTE_MODES.AIRWAY,
  ROUTE_MODES.WATERWAY,
  ROUTE_MODES.H_RAILWAY,
  ROUTE_MODES.RAILWAY,
  ROUTE_MODES.ROAD,
] as const satisfies readonly RouteMode[];

export const IDE_GSM_ROUTE_SELECTION_ROW_LENGTH = IDE_GSM_ROUTE_SELECTION_MODE_ORDER.length * 2;

export const buildIdeGsmRouteSelectionEntries = (
  selectedArrayByCountries: unknown
): IdeGsmRouteSelectionEntry[] => {
  if (
    selectedArrayByCountries === null ||
    typeof selectedArrayByCountries !== 'object' ||
    Array.isArray(selectedArrayByCountries)
  ) {
    throw new Error('[ide-gsm route selection] selectedArrayByCountries must be an object');
  }

  const entries: IdeGsmRouteSelectionEntry[] = [];
  for (const [rawCountryCode, row] of Object.entries(selectedArrayByCountries)) {
    const countryCode = requireIso2CountryCode(rawCountryCode);
    const cells = requireSelectionRow(countryCode, row);
    const orModes: RouteMode[] = [];
    const andModes: RouteMode[] = [];
    IDE_GSM_ROUTE_SELECTION_MODE_ORDER.forEach((mode, modeIndex) => {
      const orSelected = cells[modeIndex];
      const andSelected = cells[modeIndex + IDE_GSM_ROUTE_SELECTION_MODE_ORDER.length];
      if (orSelected && !andSelected) {
        throw new Error(
          `[ide-gsm route selection] OR selection for ${countryCode}/${mode} requires the matching AND cell to be true`
        );
      }
      if (orSelected) {
        orModes.push(mode);
      }
      if (andSelected) {
        andModes.push(mode);
      }
    });
    if (orModes.length > 0 || andModes.length > 0) {
      entries.push({ countryCode, orModes, andModes });
    }
  }

  if (entries.length === 0) {
    throw new Error('[ide-gsm route selection] selectedArrayByCountries has no selected routes');
  }

  return entries.sort((left, right) => left.countryCode.localeCompare(right.countryCode));
};

const requireIso2CountryCode = (value: string): ISO2 => {
  if (!/^[A-Z]{2}$/u.test(value)) {
    throw new Error(
      `[ide-gsm route selection] country code must be an uppercase ISO 3166-1 alpha-2 code: ${value}`
    );
  }
  return value as ISO2;
};

const requireSelectionRow = (countryCode: ISO2, value: unknown): boolean[] => {
  if (!Array.isArray(value) || value.length !== IDE_GSM_ROUTE_SELECTION_ROW_LENGTH) {
    throw new Error(
      `[ide-gsm route selection] selection row for ${countryCode} must contain exactly ${String(IDE_GSM_ROUTE_SELECTION_ROW_LENGTH)} boolean cells`
    );
  }
  value.forEach((cell, index) => {
    if (typeof cell !== 'boolean') {
      throw new Error(
        `[ide-gsm route selection] selection row for ${countryCode} cell ${String(index)} must be boolean`
      );
    }
  });
  return value;
};
