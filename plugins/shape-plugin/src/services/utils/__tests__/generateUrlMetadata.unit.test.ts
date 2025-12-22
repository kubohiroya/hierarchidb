import { describe, expect, it } from 'vitest';
import type { CountryMetadata, DataSourceName } from '../../../common/types/index.js';
import { generateUrlMetadata } from '../utils.js';

const COUNTRY_METADATA: CountryMetadata[] = [
  {
    countryCode: 'JP',
    countryName: 'Japan',
    continent: 'AS',
    availableAdminLevels: [0, 1],
  },
  {
    countryCode: 'ID',
    countryName: 'Indonesia',
    continent: 'AS',
    availableAdminLevels: [0, 1],
  },
];

const COUNTRIES = ['JP', 'ID'];
const LEVELS = [0, 1];

const buildUrls = (source: DataSourceName): string[] =>
  generateUrlMetadata(source, COUNTRIES, LEVELS, COUNTRY_METADATA).map((meta) => meta.url);

const assertUrls = (source: DataSourceName, expected: string[]) => {
  const urls = buildUrls(source);
  expect(urls).toEqual(expected);
  urls.forEach((url) => expect(url).not.toBe(''));
};

const fetchUrlOk = async (url: string): Promise<void> => {
  const head = await fetch(url, { method: 'HEAD' });
  if (head.ok) return;
  if (head.status !== 405) {
    throw new Error(`HEAD ${url} failed with status ${head.status}`);
  }
  const range = await fetch(url, { headers: { Range: 'bytes=0-0' } });
  if (!range.ok) {
    throw new Error(`GET ${url} failed with status ${range.status}`);
  }
};

describe('generateUrlMetadata', () => {
  it('creates naturalearth URLs for JP/ID levels 0/1', () => {
    const admin0 = 'https://www.naturalearthdata.com/download/50m/cultural/ne_50m_admin_0_countries.zip';
    const admin1 = 'https://www.naturalearthdata.com/download/50m/cultural/ne_50m_admin_1_states_provinces.zip';
    assertUrls('naturalearth', [admin0, admin1, admin0, admin1]);
  });

  it('creates geoboundaries URLs for JP/ID levels 0/1', () => {
    assertUrls('geoboundaries', [
      'https://www.geoboundaries.org/api/gbOpen/JP/ADM0',
      'https://www.geoboundaries.org/api/gbOpen/JP/ADM1',
      'https://www.geoboundaries.org/api/gbOpen/ID/ADM0',
      'https://www.geoboundaries.org/api/gbOpen/ID/ADM1',
    ]);
  });

  it('creates gadm URLs for JP/ID levels 0/1', () => {
    assertUrls('gadm', [
      'https://geodata.ucdavis.edu/gadm/gadm4.1/gpkg/JP_adm_gpkg.zip',
      'https://geodata.ucdavis.edu/gadm/gadm4.1/gpkg/JP_adm_gpkg.zip',
      'https://geodata.ucdavis.edu/gadm/gadm4.1/gpkg/ID_adm_gpkg.zip',
      'https://geodata.ucdavis.edu/gadm/gadm4.1/gpkg/ID_adm_gpkg.zip',
    ]);
  });

  it('creates openstreetmap URLs for JP/ID levels 0/1', () => {
    assertUrls('openstreetmap', [
      'https://download.geofabrik.de/jp-latest.osm.pbf',
      'https://download.geofabrik.de/jp-latest.osm.pbf',
      'https://download.geofabrik.de/id-latest.osm.pbf',
      'https://download.geofabrik.de/id-latest.osm.pbf',
    ]);
  });
});

describe('generateUrlMetadata (network)', () => {
  const shouldRun = process.env.ENABLE_INTEGRATION_TESTS === '1';
  const testFn = shouldRun ? it : it.skip;

  testFn('fetches URLs successfully for each data source', async () => {
    const sources: DataSourceName[] = ['naturalearth', 'geoboundaries', 'gadm', 'openstreetmap'];
    const urlLists = sources.flatMap((source) => buildUrls(source));
    for (const url of urlLists) {
      await fetchUrlOk(url);
    }
  });
});
