import { describe, expect, it } from 'vitest';
import { indexOriginMetadata } from './metadata/originMetadata.js';

import type { DownloadStageOutput } from '../strategies/DownloadStageStrategy.js';

describe('originMetadata', () => {
  it('builds stable originKey and indices', () => {
    const outputs: DownloadStageOutput[] = [
      {
        inputBufferId: 'buf-1',
        dataSource: 'naturalearth',
        countryCode: ' jpn ',
        adminLevel: 1,
        featureGroupId: 'JP.01',
        featureLabel: 'Hokkaido',
      },
    ] as unknown as DownloadStageOutput[];

    const index = indexOriginMetadata({
      outputs,
    });

    expect(index.entries).toHaveLength(1);
    const entry = index.entries[0];
    expect(entry).toBeTruthy();
    if (!entry) return;
    expect(entry.originKey).toBe('naturalearth|JPN|ADM1|JP.01');
    expect(index.byKey.get(entry.originKey)?.inputBufferId).toBe('buf-1');
    expect(index.byBuffer.get('buf-1')?.originKey).toBe(entry.originKey);
  });
});
