import { describe, expect, it } from 'vitest';
import type { CountryMetadata, DataSourceName } from '~/common/types/index';
import { generateDownloadTaskPayloads } from '~/services/utils/utils';

const COUNTRY_METADATA: CountryMetadata[] = [
  {
    countryCode: 'JP',
    iso3: 'JPN',
    countryName: 'Japan',
    continent: 'AS',
    availableAdminLevels: [0, 1],
  },
  {
    countryCode: 'ID',
    iso3: 'IDN',
    countryName: 'Indonesia',
    continent: 'AS',
    availableAdminLevels: [0, 1],
  },
];

const COUNTRIES = ['JP', 'ID'];
const LEVELS = [0, 1];

const buildUrls = (source: DataSourceName): string[] =>
  generateDownloadTaskPayloads(source, COUNTRIES, LEVELS, COUNTRY_METADATA).map((meta) => meta.url);

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

describe('generateDownloadTaskPayloads', () => {
  it('creates naturalearth URLs for JP/ID levels 0/1', () => {
    const admin0 = 'https://www.naturalearthdata.com/download/50m/cultural/ne_50m_admin_0_countries.zip';
    const admin1 = 'https://www.naturalearthdata.com/download/50m/cultural/ne_50m_admin_1_states_provinces.zip';
    assertUrls('naturalearth', [admin0, admin1, admin0, admin1]);
  });

  it('creates geoboundaries URLs for JP/ID levels 0/1', () => {
    assertUrls('geoboundaries', [
      'https://geoboundaries.org/api/gbOpen/JPN/ADM0',
      'https://geoboundaries.org/api/gbOpen/JPN/ADM1',
      'https://geoboundaries.org/api/gbOpen/IDN/ADM0',
      'https://geoboundaries.org/api/gbOpen/IDN/ADM1',
    ]);
  });

  it('creates gadm URLs for JP/ID levels 0/1', () => {
    assertUrls('gadm', [
      'https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_JPN_0.json',
      'https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_JPN_1.json.zip',
      'https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_IDN_0.json',
      'https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_IDN_1.json.zip',
    ]);
  });

});

describe('generateDownloadTaskPayloads (network)', () => {
  it('fetches URLs successfully for each data source', async () => {
    const sources: DataSourceName[] = ['naturalearth', 'geoboundaries', 'gadm'];
    const urlLists = sources.flatMap((source) => buildUrls(source));
    for (const url of urlLists) {
      await fetchUrlOk(url);
    }
  });
});
