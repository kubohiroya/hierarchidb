import { LocationDataSources } from './LocationDataSourceDefinitions.js';

export type LocationAttributionInfo = {
  id: string;
  label: string;
  attribution?: string;
  url?: string;
  license?: string;
  licenseUrl?: string;
};

const FALLBACK_ATTRIBUTIONS: Record<string, LocationAttributionInfo> = {
  wikidata: {
    id: 'wikidata',
    label: 'Wikidata',
    attribution: 'Data from Wikidata contributors',
    url: 'https://www.wikidata.org/',
    license: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
  custom: {
    id: 'custom',
    label: 'Custom',
    attribution: undefined,
    url: undefined,
    license: 'Custom terms',
    licenseUrl: undefined,
  },
  manual: {
    id: 'manual',
    label: 'User provided',
    attribution: undefined,
    url: undefined,
    license: 'User provided',
    licenseUrl: undefined,
  },
};

const buildFromDefinition = (key: string, source: typeof LocationDataSources[keyof typeof LocationDataSources]): LocationAttributionInfo => ({
  id: key,
  label: source.displayName ?? source.name,
  attribution: source.attribution,
  url: source.website ?? source.baseUrl,
  license: source.license,
  licenseUrl: source.licenseUrl,
});

export const resolveLocationAttribution = (dataSource?: string | null): LocationAttributionInfo | null => {
  if (!dataSource) return null;
  const normalized = dataSource.toLowerCase();
  const alias = normalized === 'openstreetmap' || normalized === 'overpass'
    ? 'openstreetmap-overpass'
    : normalized;
  const source = LocationDataSources[alias];
  if (source) return buildFromDefinition(normalized, source);
  return FALLBACK_ATTRIBUTIONS[normalized] ?? null;
};
