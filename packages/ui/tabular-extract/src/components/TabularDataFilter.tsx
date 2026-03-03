/**
 * @file TabularFilterStep.tsx
 * @description Filter rule creation and preview for Tabular data
 */

import { type ReactNode } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  GlobalStyles,
  Paper,
  Typography,
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon, Preview as PreviewIcon } from '@mui/icons-material';
import type { TabularTableMetadata } from '@hierarchidb/tabular-store';
import type { TabularDataResult, TabularFilterRule } from '../types/index';
import { TabularDataFilterRulesVirtual } from './TabularDataFilterRulesVirtual.js';
import { LinearProgress } from '@mui/material';
import { TabularPreviewGrid } from './TabularPreviewGrid.js';
import { FILTER_OPERATORS, useTabularDataFilter } from './useTabularDataFilter.js';

export interface TabularDataFilterProps {
  tableMetadata: TabularTableMetadata;
  /**
   * (Optional) Notify parent immediately when filters change.
   * Use sparingly: syncing on every keystroke can be expensive for host dialogs.
   */
  onFiltersChanged?: (filters: TabularFilterRule[]) => void;
  onPreviewData?: (data: TabularDataResult) => void;
  /** Optional: provide raw rows separately to avoid bloating dialogData */
  onPreviewRows?: (rows: TabularDataResult['rows']) => void;
  pluginId: string;
  maxPreviewRows?: number;
  initialFilters?: TabularFilterRule[];
  /** 明示的に親へ同期したいときに使うコールバックを受け取る */
  onSyncFilters?: (filters: TabularFilterRule[]) => void;
  /** When provided, keep menus/portals inside the dialog container */
  menuContainer?: Element | null;
  /** Custom renderer for filter/preview sections */
  renderSections?: (sections: {
    filterRules: ReactNode;
    preview: ReactNode | null;
    error: ReactNode | null;
    previewDirty: boolean;
  }) => ReactNode;
}

export const TabularDataFilter: React.FC<TabularDataFilterProps> = ({
  tableMetadata,
  onFiltersChanged,
  onPreviewData,
  onPreviewRows,
  pluginId,
  initialFilters = [],
  onSyncFilters,
  menuContainer,
  renderSections,
}) => {
  void menuContainer;
  const view = useTabularDataFilter({
    tableMetadata,
    pluginId,
    initialFilters,
    onFiltersChanged,
    onPreviewData,
    onPreviewRows,
    onSyncFilters,
  });

  const filterRulesNode = (
    <TabularDataFilterRulesVirtual
      filters={view.filters}
      onChange={view.handleFiltersChange}
      onDirty={() => view.setPreviewDirty(true)}
      columns={view.columnOptions}
      operatorOptions={FILTER_OPERATORS}
      maxVisibleRows={10}
      rowHeight={view.rowHeight}
      renderAsAccordion={!renderSections}
      title={renderSections ? '' : 'Filter Rules'}
    />
  );

  const previewNode = view.previewData ? (
    <Paper variant="outlined" sx={{ height: view.previewHeight, overflowY: 'auto' }}>
      <TabularPreviewGrid
        rows={view.previewData.rows ?? []}
        columns={view.previewColumns.map((c) => c.name ?? '').filter(Boolean)}
        height={view.previewHeight}
        onCreateFilter={view.handleCreateFilterFromCell}
        initialVisibleRows={10}
        resizable
        headerCellSx={{ py: 0.5 }}
        totalRowCount={tableMetadata.totalRows}
        filteredRowCount={view.previewData.totalRows ?? view.previewData.rows.length}
        hasFilters={view.filters.length > 0}
      />
    </Paper>
  ) : null;

  const errorNode = view.error ? (
    <Alert severity="error" sx={{ mb: 3, mt: 2 }}>
      {view.error}
    </Alert>
  ) : null;

  if (renderSections) {
    return (
      <Box sx={{ p: 2 }}>
        {renderSections({
          filterRules: filterRulesNode,
          preview: previewNode,
          error: errorNode,
          previewDirty: view.previewBusy,
        })}
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <GlobalStyles
        styles={{
          '.MuiPopover-root[aria-hidden="true"], .MuiModal-root[aria-hidden="true"]': {
            pointerEvents: 'none !important',
          },
          '.MuiPopover-root[aria-hidden="true"] *': {
            pointerEvents: 'none !important',
          },
        }}
      />
      {filterRulesNode}
      {errorNode}

      {view.previewData && (
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box>
              <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <PreviewIcon fontSize="small" />
                Preview Tabular
              </Typography>
              {view.previewBusy && <LinearProgress variant="indeterminate" sx={{ mt: 0.5 }} />}
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pb: 4, mb: 4 }}>
            {previewNode}
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  );
};
