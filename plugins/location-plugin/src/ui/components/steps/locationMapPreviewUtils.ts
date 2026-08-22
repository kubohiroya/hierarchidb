import type { LocationType } from '~/common/types/index';
import { KNOWN_LOCATION_TYPES } from './locationMapPreviewConstants.js';

export const resolveLocationType = (value: string): LocationType =>
  (KNOWN_LOCATION_TYPES as readonly string[]).includes(value)
    ? (value as LocationType)
    : 'area_centroid';

export const formatTimestamp = (value?: number): string | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return new Date(value).toISOString();
};

export const resolveCountryFlag = (countryCode?: string): string | undefined => {
  if (!countryCode || countryCode.length !== 2) return undefined;
  const normalized = countryCode.toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return undefined;
  const base = 0x1f1e6;
  const codes = Array.from(normalized).map((char) => base + char.charCodeAt(0) - 65);
  return String.fromCodePoint(...codes);
};
