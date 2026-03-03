import React from 'react';
import { IconButton } from '@mui/material';
import { Hexagon } from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import { Recycling as RecyclingIcon } from '@mui/icons-material';
import type { WindowState } from '@hierarchidb/ui-floating-window';
import { FloatingWindow } from '@hierarchidb/ui-floating-window';
import {
  MapPreviewFloatingTable,
  type MapPreviewErrorSummaryById,
  type MapPreviewErrorColumnLabels,
  type MapPreviewStatusLabels,
} from './MapPreviewFloatingTable.js';
import type { FeatureTableSearchConfig } from './FeatureTableToolbar.js';
import { useShapePreviewListView } from './useShapePreviewListView.js';

type ShapePreviewRowBase = {
  recycling?: boolean;
  id: string;
  featureId?: string;
  memberFeatureIds?: string[];
  aggregationLevel?: 'feature' | 'admin' | 'country';
  countryName?: string;
  countryCode?: string;
  adminName?: string;
  adminLevel?: number;
  adminCode?: string;
  dataSource?: string;
  createdAt?: number;
  vertexCount?: number;
  polygonCount?: number;
  bbox?: [number, number, number, number];
  area?: number;
};

export type ShapePreviewFeatureRow = ShapePreviewRowBase;

export type ShapePreviewColumnLabels = {
  featureId: string;
  countryName: string;
  countryCode: string;
  adminName: string;
  adminLevel: string;
  adminCode: string;
  dataSource: string;
  createdAt: string;
  vertexCount: string;
  polygonCount: string;
  bbox: string;
  area: string;
};

export type ShapePreviewListCountLabels = {
  matched: string;
  rows: string;
};

export type ShapePreviewListProps = {
  title: string;
  rows: ShapePreviewFeatureRow[];
  columnLabels: ShapePreviewColumnLabels;
  search?: FeatureTableSearchConfig;
  matchedRows?: Set<string>;
  selectedRows?: Set<string>;
  onSelectionChange?: (selected: Set<string | number>) => void;
  loading?: boolean;
  error?: string;
  countText?: string;
  countLabels?: ShapePreviewListCountLabels;
  emptyContent?: React.ReactNode;
  errorSummaryById?: MapPreviewErrorSummaryById;
  errorColumnLabels?: MapPreviewErrorColumnLabels;
  statusLabels?: MapPreviewStatusLabels;
  maxHeight?: number;
  onClose?: () => void;
  onToggleRecycling?: () => void;
  onWindowStateChange?: (state: Pick<WindowState, 'isMinimized' | 'isVisible'>) => void;
  rowFilterConfig?: {
    mode: 'all' | 'viewport';
    onModeChange: (mode: 'all' | 'viewport') => void;
    searchOnly: boolean;
    onSearchOnlyChange: (value: boolean) => void;
    labels?: {
      title?: string;
      allRows?: string;
      viewportRows?: string;
      searchOnly?: string;
    };
  };
};

export const ShapePreviewList: React.FC<ShapePreviewListProps> = ({
  title,
  rows,
  columnLabels,
  search,
  matchedRows,
  selectedRows,
  onSelectionChange,
  loading,
  error,
  countText,
  countLabels,
  emptyContent,
  errorSummaryById,
  errorColumnLabels,
  statusLabels,
  maxHeight,
  onClose,
  onToggleRecycling,
  rowFilterConfig,
  onWindowStateChange,
}) => {
  const theme = useTheme();
  const {
    handlers,
    noGrouping,
    recyclingSelectionState,
    resolvedMatchedRows,
    resolvedTitle,
    tableRows,
    windowState,
    columns,
  } = useShapePreviewListView({
    title,
    rows,
    columnLabels,
    search,
    matchedRows,
    countText,
    countLabels,
    errorSummaryById,
    statusLabels,
    selectedRows,
    rowFilterConfig,
    onWindowStateChange,
  });

  return (
    <FloatingWindow
      title={resolvedTitle}
      titleIcon={<Hexagon sx={{ fontSize: '1rem', ml: 1 }} />}
      initialState={windowState}
      onStateChange={handlers.onStateChange}
      onClose={onClose}
    >
      <MapPreviewFloatingTable
        title={resolvedTitle}
        showTitle={false}
        rows={tableRows}
        columns={columns}
        persistKeyBase="hierarchidb:grid:shape:step6:features"
        defaultSorting={[{ id: 'featureId', desc: false }]}
        search={search}
        loading={loading}
        error={error}
        matchedRows={resolvedMatchedRows}
        selectable={Boolean(onSelectionChange)}
        selectionMode="multiple"
        selectedRows={selectedRows}
        onSelectionChange={onSelectionChange}
        rowSx={(state) => {
          if (state.selected) {
            const selectedBg = theme.palette.primary.light;
            const selectedText = theme.palette.getContrastText(selectedBg);
            return {
              backgroundColor: selectedBg,
              color: selectedText,
              '& td, & td *': { color: selectedText },
            };
          }
          if (state.matched) {
            const matchedBg = alpha(theme.palette.secondary.main, 0.08);
            const matchedBorder = alpha(theme.palette.secondary.main, 0.4);
            return {
              backgroundColor: matchedBg,
              boxShadow: `inset 3px 0 0 0 ${matchedBorder}`,
            };
          }
          if (state.hovered) {
            return { backgroundColor: theme.palette.action.hover };
          }
          return undefined;
        }}
        emptyContent={emptyContent}
        errorSummaryById={errorSummaryById}
        errorColumnLabels={errorColumnLabels}
        statusLabels={statusLabels}
        statusAdornment={(row) => (row.recycling ? <RecyclingIcon fontSize="small" color="success" /> : null)}
        toolbarActions={onToggleRecycling ? (
          <IconButton
            aria-label="Toggle recycling"
            size="small"
            onClick={onToggleRecycling}
            disabled={recyclingSelectionState === 'none'}
          >
            <RecyclingIcon
              fontSize="small"
              color={recyclingSelectionState === 'on' ? 'success' : recyclingSelectionState === 'partial' ? 'warning' : 'inherit'}
            />
          </IconButton>
          ) : null}
        maxHeight={maxHeight}
        rowFilterConfig={rowFilterConfig}
        grouping={noGrouping}
        containerSx={{
          position: 'static',
          width: '100%',
          maxWidth: '100%',
          height: '100%',
          maxHeight: '100%',
          top: 'auto',
          right: 'auto',
          boxShadow: 'none',
        }}
      />
    </FloatingWindow>
  );
};
