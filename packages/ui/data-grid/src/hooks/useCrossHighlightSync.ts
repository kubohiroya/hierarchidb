import * as React from 'react';
import type { Id } from '~/CrossViewStyles';
import { CrossViewStyles } from '~/CrossViewStyles';

const logCrossHighlightWarning = (message: string, error: unknown): void => {
  if (typeof console === 'undefined') return;
  console.warn('[useCrossHighlightSync]', message, error);
};

export interface UseCrossHighlightSyncOptions {
  datasetId: string;
  /** When true, deck.gl accessors (fill/line/width/elevation) are included */
  withDeckAccessors?: boolean;
}

export function useCrossHighlightSync({
  datasetId,
  withDeckAccessors = true,
}: UseCrossHighlightSyncOptions) {
  const [, force] = React.useReducer((x) => x + 1, 0);

  const toFeatureId = React.useCallback((value: unknown): Id | null => {
    if (typeof value === 'string' || typeof value === 'number') {
      return value;
    }
    return null;
  }, []);

  React.useEffect(() => {
    const unsub = CrossViewStyles.subscribe(datasetId, () => force());
    return () => {
      try {
        unsub();
      } catch (error) {
        logCrossHighlightWarning('Failed to unsubscribe CrossViewStyles listener', error);
      }
    };
  }, [datasetId]);

  const rowSets = React.useMemo(() => CrossViewStyles.getRowSets(datasetId), [datasetId, force]);

  // DataGrid helpers
  const dataGrid = React.useMemo(
    () => ({
      hoveredRows: rowSets.hovered,
      selectedRows: rowSets.selected,
      matchedRows: rowSets.matched,
      disabledRows: rowSets.disabled,
      draggingRows: rowSets.dragging,
      dropTargetRows: rowSets.dropTarget,
      onRowHover: (row: any, rowId: string | number) => {
        CrossViewStyles.setState(datasetId, 'rows', 'hovered', new Set<Id>([rowId]));
        CrossViewStyles.emitFocus(datasetId, { datasetId, source: 'row', id: rowId, data: row });
      },
      onRowLeave: (_row: any, _rowId: string | number) => {
        CrossViewStyles.setState(datasetId, 'rows', 'hovered', new Set());
        CrossViewStyles.emitBlur(datasetId);
      },
      rowSx: (state: { rowId: string | number }) =>
        CrossViewStyles.resolveRowStyle(datasetId, state.rowId)?.sx,
    }),
    [datasetId, rowSets]
  );

  // deck.gl helpers
  const deck = React.useMemo(() => {
    const acc = withDeckAccessors ? CrossViewStyles.getDeckAccessors(datasetId) : undefined;
    return {
      ...(acc || {}),
      onHover: (info: any) => {
        const fid = toFeatureId(info?.object?.id);
        if (fid != null) {
          CrossViewStyles.setState(datasetId, 'features', 'hovered', new Set<Id>([fid]));
          CrossViewStyles.emitFocus(datasetId, {
            datasetId,
            source: 'features',
            id: fid,
            data: info.object?.properties,
          });
        } else {
          CrossViewStyles.setState(datasetId, 'features', 'hovered', new Set());
          CrossViewStyles.emitBlur(datasetId);
        }
      },
      onClick: (info: any) => {
        const fid = toFeatureId(info?.object?.id);
        if (fid != null) {
          CrossViewStyles.setState(datasetId, 'features', 'selected', new Set<Id>([fid]));
        }
      },
    };
  }, [datasetId, toFeatureId, withDeckAccessors]);

  // MapLibre helpers
  function bindMapLibre(
    map: any,
    sourceId: string,
    layerIds: string[],
    opts?: { selectOnClick?: boolean }
  ) {
    const onMove = (e: any) => {
      const f = e.features?.[0];
      const fid = toFeatureId(f?.id);
      if (fid == null) {
        CrossViewStyles.emitBlur(datasetId);
        return;
      }
      CrossViewStyles.setState(datasetId, 'features', 'hovered', new Set<Id>([fid]));
      CrossViewStyles.emitFocus(datasetId, {
        datasetId,
        source: 'features',
        id: fid,
        data: f.properties,
      });
      CrossViewStyles.applyMapLibreFeatureState(datasetId, map, sourceId);
    };
    const onLeave = () => {
      CrossViewStyles.setState(datasetId, 'features', 'hovered', new Set());
      CrossViewStyles.emitBlur(datasetId);
      CrossViewStyles.applyMapLibreFeatureState(datasetId, map, sourceId);
    };
    const onClick = (e: any) => {
      if (!opts?.selectOnClick) return;
      const f = e.features?.[0];
      const fid = toFeatureId(f?.id);
      if (fid == null) return;
      CrossViewStyles.setState(datasetId, 'features', 'selected', new Set<Id>([fid]));
      CrossViewStyles.applyMapLibreFeatureState(datasetId, map, sourceId);
    };
    layerIds.forEach((lid) => {
      map.on('mousemove', lid, onMove);
      map.on('mouseleave', lid, onLeave);
      map.on('click', lid, onClick);
    });
    return () => {
      layerIds.forEach((lid) => {
        try {
          map.off('mousemove', lid, onMove);
        } catch (error) {
          logCrossHighlightWarning(`Failed to detach mousemove handler for ${lid}`, error);
        }
        try {
          map.off('mouseleave', lid, onLeave);
        } catch (error) {
          logCrossHighlightWarning(`Failed to detach mouseleave handler for ${lid}`, error);
        }
        try {
          map.off('click', lid, onClick);
        } catch (error) {
          logCrossHighlightWarning(`Failed to detach click handler for ${lid}`, error);
        }
      });
    };
  }

  return { rowSets, dataGrid, deck, bindMapLibre };
}
