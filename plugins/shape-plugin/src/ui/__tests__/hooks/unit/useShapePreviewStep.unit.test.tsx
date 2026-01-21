import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { getDBName } from '@hierarchidb/util';
import { useShapePreviewStep } from '../../../components/step6/useShapePreviewStep.js';

const shapeQueryAPIImpl = vi.hoisted(() => ({
  getVectorTile: vi.fn(),
  getVectorTileSummary: vi.fn(),
  listSourceMetadata: vi.fn(),
  listFeatureMetadata: vi.fn(),
  listTransformErrorRecords: vi.fn(),
}));

vi.mock('../../../../services/batch/ShapeBuildAPIClient.ts', () => ({
  shapeQueryAPIImpl,
}));

vi.mock('@hierarchidb/ui-worker-provider', () => ({
  getWorkerClientHook: () => () => null,
}));

vi.mock('@hierarchidb/ui-map', async () => {
  const { atom } = await import('jotai');
  return {
    buildErrorSummaryById: () => new Map(),
    mapHoverCandidatesAtom: atom([]),
    mapHoverMatchesAtom: atom([]),
    mapSearchMatchesAtom: atom([]),
    mapSelectedMatchesAtom: atom([]),
    useVectorTilePreviewMetadata: () => ({
      metadataRows: [],
      metadataLoading: false,
      metadataError: null,
      metadataLoaded: true,
    }),
    useVectorTilePreviewSearch: () => {},
    useVectorTilePreviewSelection: () => ({
      selectedIdSet: new Set<string>(),
      hoveredIdSet: new Set<string>(),
      hoverMessage: '',
      handleMapIdentify: () => {},
    }),
  };
});

vi.mock('../../../i18n.js', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const shouldRunUiHookTests = Boolean(process.env.ENABLE_SHAPE_UI_TESTS);
const describeUiHooks = shouldRunUiHookTests ? describe : describe.skip;

describeUiHooks('useShapePreviewStep', () => {
  beforeEach(() => {
    shapeQueryAPIImpl.getVectorTile.mockReset();
    shapeQueryAPIImpl.getVectorTileSummary.mockReset();
    shapeQueryAPIImpl.listSourceMetadata.mockReset();
    shapeQueryAPIImpl.listFeatureMetadata.mockReset();
    shapeQueryAPIImpl.listTransformErrorRecords.mockReset();
    shapeQueryAPIImpl.getVectorTileSummary.mockResolvedValue({ tiles: 1, totalBytes: 128 });
  });

  it('uses ShapeDB as tile source and resolves tiles via shapeQueryAPIImpl', async () => {
    const tileBytes = new Uint8Array([1, 2, 3]);
    shapeQueryAPIImpl.getVectorTile.mockResolvedValue(tileBytes);

    const { result } = renderHook(() => useShapePreviewStep({
      nodeId: 'node-1',
    }, 'node-1'));

    const data = await result.current.tileDataProvider(2, 3, 4, 'node-1');

    expect(result.current.tileDbName).toBe(getDBName('shape'));
    expect(shapeQueryAPIImpl.getVectorTile).toHaveBeenCalledWith('node-1', 2, 3, 4);
    expect(data).not.toBeNull();
    expect((data as ArrayBuffer).byteLength).toBe(tileBytes.byteLength);
  });
});

if (!shouldRunUiHookTests) {
  describe.skip('useShapePreviewStep (UI tests disabled)', () => {});
}
