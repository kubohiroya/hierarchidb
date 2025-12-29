import { configurePluginDownloadDefaults, downloadJson, getCorsProxyBaseURL } from '@hierarchidb/download';

const ensureShapeDownloadDefaults = (): void => {
  const corsProxyBaseURL = getCorsProxyBaseURL() || undefined;
  configurePluginDownloadDefaults('shape', {
    dbPrefix: 'shape',
    corsProxyBaseURL,
  });
};

const parseAdminLevel = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value !== 'string') return null;
  const match = value.toUpperCase().match(/ADM\s*([0-5])/);
  const level = match?.[1];
  if (!level) return null;
  return Number.parseInt(level, 10);
};

const readFirstString = (record: Record<string, unknown>, keys: string[]): string | null => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  return null;
};

export type GeoBoundariesAvailability = {
  entries: Map<string, number[]>;
  totalItems: number;
};

export async function fetchGeoBoundariesAvailability(
  url: string,
): Promise<GeoBoundariesAvailability> {
  ensureShapeDownloadDefaults();
  const availabilityPayload = await downloadJson<unknown>('shape', url, 'geoboundaries:availability');
  const items = Array.isArray(availabilityPayload)
    ? availabilityPayload
    : Array.isArray((availabilityPayload as { data?: unknown }).data)
      ? (availabilityPayload as { data: unknown[] }).data
      : [];
  const entries = new Map<string, number[]>();
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const iso3 = readFirstString(record, [
      'boundaryISO',
      'iso3',
      'ISO3',
      'countryCode',
      'countryISO',
    ]);
    const boundaryType = readFirstString(record, [
      'boundaryType',
      'boundaryLevel',
      'adm',
      'ADM',
    ]);
    if (!iso3 || !boundaryType) continue;
    const parsed = parseAdminLevel(boundaryType);
    if (parsed === null) continue;
    const key = iso3.toUpperCase();
    const existing = entries.get(key) ?? [];
    if (!existing.includes(parsed)) {
      entries.set(key, [...existing, parsed].sort((a, b) => a - b));
    }
  }
  return { entries, totalItems: items.length };
}
