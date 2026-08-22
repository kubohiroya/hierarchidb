import { describe, expect, it } from 'vitest';
import { resolveShapeIso3166CsvUrlFromPath } from '../../services/utils/iso3166.js';

describe('resolveShapeIso3166CsvUrlFromPath', () => {
  it('keeps the package fallback URL when no worker base path can be inferred', () => {
    expect(resolveShapeIso3166CsvUrlFromPath('/iso3166-2-level1.csv')).toBe(
      '/iso3166-2-level1.csv',
    );
    expect(resolveShapeIso3166CsvUrlFromPath('/iso3166-2-level1.csv', '/')).toBe(
      '/iso3166-2-level1.csv',
    );
  });

  it('infers the app base path from the production shared worker URL', () => {
    expect(
      resolveShapeIso3166CsvUrlFromPath(
        '/iso3166-2-level1.csv',
        '/hierarchidb/shared-worker.js',
      ),
    ).toBe('/hierarchidb/iso3166-2-level1.csv');
  });

  it('infers the app base path from bundled worker asset URLs', () => {
    expect(
      resolveShapeIso3166CsvUrlFromPath(
        '/iso3166-2-level1.csv',
        '/hierarchidb/assets/worker-CysXHPfJ.js',
      ),
    ).toBe('/hierarchidb/iso3166-2-level1.csv');
  });
});
