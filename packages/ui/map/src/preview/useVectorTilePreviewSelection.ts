import { useCallback, useEffect, useMemo } from 'react';
import type { MapFeatureIdentifyResult } from '~/types/unified-map-props';

type RowIdGetter<Row> = (row: Row) => string;
type HoverLabelGetter<Row> = (row: Row) => string;

export type SelectionResult<Context> = {
  selectedIds: string[];
  nextContext: Context | null;
};

export type SelectionResolver<Row, Context> = (
  row: Row,
  current: Context | null,
  allRows: Row[]
) => SelectionResult<Context>;

export type SelectionContextDeriver<Row, Context> = (
  rows: Row[],
  selectedIds: string[]
) => Context | null;

type FeatureIdResolver = (feature: {
  id?: unknown;
  properties?: Record<string, unknown> | null;
}) => string;

type Args<Row, Context> = {
  rows: Row[];
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  hoveredId: string | null;
  selectionContext: Context | null;
  setSelectionContext: (context: Context | null) => void;
  getRowId: RowIdGetter<Row>;
  resolveSelection: SelectionResolver<Row, Context>;
  deriveSelectionContext: SelectionContextDeriver<Row, Context>;
  getHoverLabel?: HoverLabelGetter<Row>;
  resolveFeatureId?: FeatureIdResolver;
};

const defaultResolveFeatureId: FeatureIdResolver = (feature) =>
  String(feature.id ?? feature.properties?.id ?? '');

export const useVectorTilePreviewSelection = <Row, Context>({
  rows,
  selectedIds,
  setSelectedIds,
  hoveredId,
  selectionContext,
  setSelectionContext,
  getRowId,
  resolveSelection,
  deriveSelectionContext,
  getHoverLabel,
  resolveFeatureId = defaultResolveFeatureId,
}: Args<Row, Context>) => {
  useEffect(() => {
    setSelectionContext(deriveSelectionContext(rows, selectedIds));
  }, [deriveSelectionContext, rows, selectedIds, setSelectionContext]);

  const metadataById = useMemo(
    () => new Map(rows.map((row) => [getRowId(row), row])),
    [getRowId, rows]
  );

  const selectedIdSet = useMemo<Set<string>>(() => new Set(selectedIds), [selectedIds]);
  const hoveredIdSet = useMemo<Set<string>>(
    () => (hoveredId ? new Set([hoveredId]) : new Set<string>()),
    [hoveredId]
  );

  const handleMapIdentify = useCallback(
    (result: MapFeatureIdentifyResult) => {
      const feature = result.features?.[0];
      if (!feature) {
        setSelectedIds([]);
        setSelectionContext(null);
        return;
      }
      const featureId = resolveFeatureId(feature);
      if (!featureId) {
        setSelectedIds([]);
        setSelectionContext(null);
        return;
      }
      const row = metadataById.get(featureId);
      if (!row) {
        setSelectedIds([]);
        setSelectionContext(null);
        return;
      }
      const { selectedIds: nextIds, nextContext } = resolveSelection(row, selectionContext, rows);
      setSelectedIds(nextIds);
      setSelectionContext(nextContext);
    },
    [
      metadataById,
      resolveFeatureId,
      resolveSelection,
      rows,
      selectionContext,
      setSelectedIds,
      setSelectionContext,
    ]
  );

  const hoverMessage = useMemo(() => {
    if (!hoveredId || !getHoverLabel) return '';
    const row = metadataById.get(hoveredId);
    if (!row) return '';
    return getHoverLabel(row);
  }, [getHoverLabel, hoveredId, metadataById]);

  return {
    metadataById,
    selectedIdSet,
    hoveredIdSet,
    hoverMessage,
    handleMapIdentify,
  };
};
