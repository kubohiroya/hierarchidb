import type { FeatureMetadataPickers } from './featureMetadata.js';

export const FEATURE_METADATA_PICKER_KEYS = {
  adminName: [
    'adminName',
    'admin_name',
    'ADMIN_NAME',
    'shapeName',
    'NAME_0',
    'NAME_1',
    'NAME_2',
    'NAME_3',
    'NAME_4',
    'NAME_5',
    'name',
  ],
  countryCode: ['ISO_A3', 'ISO3', 'ADM0_A3', 'countryCode', 'COUNTRY_CODE'],
  countryName: ['COUNTRY_NAME', 'COUNTRY', 'NAME_0', 'countryName'],
  adminCode: ['GID_0', 'GID_1', 'GID_2', 'GID_3', 'shapeID', 'adminCode', 'code'],
} as const;

export function pickFirstString(properties: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = properties[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

export function pickAdminName(properties: Record<string, unknown>): string | undefined {
  return pickFirstString(properties, [...FEATURE_METADATA_PICKER_KEYS.adminName]);
}

export function pickCountryCode(properties: Record<string, unknown>): string | undefined {
  return pickFirstString(properties, [...FEATURE_METADATA_PICKER_KEYS.countryCode]);
}

export function pickCountryName(properties: Record<string, unknown>): string | undefined {
  return pickFirstString(properties, [...FEATURE_METADATA_PICKER_KEYS.countryName]);
}

export function pickAdminCode(properties: Record<string, unknown>): string | undefined {
  return pickFirstString(properties, [...FEATURE_METADATA_PICKER_KEYS.adminCode]);
}

export function pickAdminLevel(properties: Record<string, unknown>): number | undefined {
  const candidates = [
    properties.adminLevel,
    properties.admin_level,
    properties.ADM_LEVEL,
    properties.level,
  ];
  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

export function createFeatureMetadataPickers(): FeatureMetadataPickers {
  return {
    pickFirstString,
    pickAdminName,
    pickCountryCode,
    pickCountryName,
    pickAdminCode,
    pickAdminLevel,
  };
}
