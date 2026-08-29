import type { MountedIdeGsmCsvSourceReference, StylerEntity } from '@hierarchidb/styler-store';
import { describe, expect, it, vi } from 'vitest';
import {
  getMountedIdeGsmCsvSourceReference,
  loadMountedIdeGsmCsvSource,
  MountedIdeGsmCsvSourceLoadError,
  type MountedIdeGsmCsvSourceReader,
} from '../mountedIdeGsmCsvSourceService.js';

const validReference: MountedIdeGsmCsvSourceReference = {
  version: 1,
  kind: 'ide-gsm-mounted-csv',
  mountId: 'project-a',
  sourceKind: 'project-root',
  projectId: 'group/project',
  relativePath: 'result-files/sim/result.csv',
};

function makeReader(csvText: string | null): MountedIdeGsmCsvSourceReader {
  return {
    readMountedCsv: vi.fn().mockResolvedValue(csvText),
  };
}

describe('mountedIdeGsmCsvSourceService', () => {
  it('loads mounted CSV through the injected reader boundary', async () => {
    const reader = makeReader('id,fillColor,opacity\nzone-a,#ff0000,0.5\nzone-b,#00ff00,\n');

    const result = await loadMountedIdeGsmCsvSource(validReference, reader);

    expect(reader.readMountedCsv).toHaveBeenCalledWith(validReference);
    expect(result.columns).toEqual(['id', 'fillColor', 'opacity']);
    expect(result.rows).toEqual([
      { id: 'zone-a', fillColor: '#ff0000', opacity: 0.5 },
      { id: 'zone-b', fillColor: '#00ff00', opacity: null },
    ]);
  });

  it('accepts fdm-space mounted CSV references', async () => {
    const reference: MountedIdeGsmCsvSourceReference = {
      version: 1,
      kind: 'ide-gsm-mounted-csv',
      mountId: 'fdm-default',
      sourceKind: 'fdm-space-root',
      spaceId: 'default',
      relativePath: 'case-a/result.csv',
    };
    const reader = makeReader('id,strokeWidth\nr1,2\n');

    await expect(loadMountedIdeGsmCsvSource(reference, reader)).resolves.toMatchObject({
      columns: ['id', 'strokeWidth'],
      rows: [{ id: 'r1', strokeWidth: 2 }],
    });
  });

  it('returns null for legacy Styler records without mounted source', () => {
    const legacy = {} as Pick<StylerEntity, 'source'>;

    expect(getMountedIdeGsmCsvSourceReference(legacy)).toBeNull();
  });

  it('returns the validated source for stored mounted Styler records', () => {
    const entity = { source: validReference } as Pick<StylerEntity, 'source'>;

    expect(getMountedIdeGsmCsvSourceReference(entity)).toEqual(validReference);
  });

  it('rejects forbidden public fields before reading', async () => {
    const reader = makeReader('id,value\n1,2\n');
    const reference = {
      ...validReference,
      endpointUrl: 'https://ide-gsm.example.test/graphql',
    };

    await expect(loadMountedIdeGsmCsvSource(reference, reader)).rejects.toMatchObject({
      code: 'FORBIDDEN_PUBLIC_FIELD',
    });
    expect(reader.readMountedCsv).not.toHaveBeenCalled();
  });

  it('rejects absolute and parent traversal paths', async () => {
    const reader = makeReader('id,value\n1,2\n');

    await expect(
      loadMountedIdeGsmCsvSource({ ...validReference, relativePath: '/tmp/result.csv' }, reader)
    ).rejects.toMatchObject({ code: 'INVALID_LOGICAL_PATH' });
    await expect(
      loadMountedIdeGsmCsvSource({ ...validReference, relativePath: '../result.csv' }, reader)
    ).rejects.toMatchObject({ code: 'INVALID_LOGICAL_PATH' });
    expect(reader.readMountedCsv).not.toHaveBeenCalled();
  });

  it('reports missing source without leaking reader errors', async () => {
    const reader: MountedIdeGsmCsvSourceReader = {
      readMountedCsv: vi.fn().mockRejectedValue(new Error('https://secret.example.test/token')),
    };

    await expect(loadMountedIdeGsmCsvSource(validReference, reader)).rejects.toMatchObject({
      code: 'CSV_SOURCE_MISSING',
      message: 'CSV_SOURCE_MISSING',
    });
  });

  it('reports credential unavailable separately with a sanitized code', async () => {
    const reader: MountedIdeGsmCsvSourceReader = {
      readMountedCsv: vi.fn().mockRejectedValue({ code: 'CREDENTIALS_UNAVAILABLE' }),
    };

    await expect(loadMountedIdeGsmCsvSource(validReference, reader)).rejects.toMatchObject({
      code: 'CSV_SOURCE_CREDENTIALS_UNAVAILABLE',
      message: 'CSV_SOURCE_CREDENTIALS_UNAVAILABLE',
    });
  });

  it('rejects malformed CSV content', async () => {
    await expect(
      loadMountedIdeGsmCsvSource(validReference, makeReader('id,value\n"unterminated,1\n'))
    ).rejects.toBeInstanceOf(MountedIdeGsmCsvSourceLoadError);
    await expect(
      loadMountedIdeGsmCsvSource(validReference, makeReader('id,id\n1,2\n'))
    ).rejects.toMatchObject({ code: 'CSV_SOURCE_MALFORMED' });
  });

  it('does not call legacy string-only fallback readers', async () => {
    const legacyStringOnlyDirectoryRead = vi.fn();
    const reader = {
      readMountedCsv: vi.fn().mockResolvedValue('id,value\n1,2\n'),
      legacyStringOnlyDirectoryRead,
    } satisfies MountedIdeGsmCsvSourceReader & {
      legacyStringOnlyDirectoryRead: () => void;
    };

    await loadMountedIdeGsmCsvSource(validReference, reader);

    expect(legacyStringOnlyDirectoryRead).not.toHaveBeenCalled();
  });
});
