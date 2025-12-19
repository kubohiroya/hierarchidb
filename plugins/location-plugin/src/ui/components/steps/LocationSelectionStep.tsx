/**
 * Location Selection Step
 */

import type React from 'react';
import { Alert, Box, Chip, Stack, Typography } from '@mui/material';
import { SearchField } from '@hierarchidb/ui-search-field';
import type { LocationEntity } from '../../../common/types/index.js';
import { useTranslation } from '../../../common/i18n/index.js';
import { SelectionMatrix } from '@hierarchidb/components';
import type { LocationType } from '../../../common/types/index.js';
import { useLocationSelection } from './useLocationSelection.js';

interface LocationSelectionStepProps {
  draft: Partial<LocationEntity>;
  onUpdate: (updates: Partial<LocationEntity>) => void;
}

export const LocationSelectionStep: React.FC<LocationSelectionStepProps> = ({ draft, onUpdate }) => {
  const { translations, t } = useTranslation();
  const {
    isoStatus,
    isoError,
    isEmpty,
    search,
    setSearch,
    sortState,
    columns,
    rowMetaColumns,
    matrixRows,
    matrixState,
    isCellEnabled,
    onChange,
    onSelectAll,
    onColumnHeaderClick,
    onRowMetaHeaderClick,
    getColumnSortDirection,
    getRowMetaSortDirection,
    alphabeticalIndex,
    regionIndex,
    selectedIndexByType,
    virtuosoRef,
  } = useLocationSelection({ draft, onUpdate });

  if (isoStatus === 'loading') {
    return (
      <Box>
        <Alert severity="info">{t('selection.loadingCountries', 'Loading countries...')}</Alert>
      </Box>
    );
  }

  if (isoStatus === 'error') {
    return (
      <Box>
        <Alert severity="error">
          {t('selection.loadError', 'Failed to load country list')}: {isoError}
        </Alert>
      </Box>
    );
  }

  if (isEmpty) {
    return (
      <Box>
        <Alert severity="warning">
          {t('selection.emptyCountries', 'No countries available. Please try again later.')}
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" spacing={2} mb={0.5} alignItems="center" flexWrap="wrap" justifyContent="flex-start">
        <Box sx={{ flexBasis: '250px', flexGrow: 0, flexShrink: 1, marginBottom: '3px !important' }}>
          <SearchField
            searchText={search}
            handleSearchTextChange={(value) => setSearch(value)}
            placeholder={t('selection.searchPlaceholder', 'Search by country or code...')}
            ariaLabel={t('selection.searchPlaceholder', 'Search by country or code...')}
            fullWidth
          />
        </Box>
        <Box display="flex" gap={1} alignItems="center" flexWrap="wrap" justifyContent="flex-start" sx={{ flexGrow: 1 }}>
          {sortState.kind === 'country' && alphabeticalIndex.length > 0 && (
            <>
              <Typography variant="caption" color="text.secondary">
                {translations.selection?.indexLabel ?? 'Index'}
              </Typography>
              {alphabeticalIndex.map((entry) => (
                <Chip
                  key={entry.label}
                  label={`${entry.label} (${entry.count})`}
                  size="small"
                  onClick={() => {
                    const targetIndex = matrixRows.findIndex((row) => row.id === entry.firstRowId);
                    if (targetIndex >= 0) {
                      virtuosoRef.current?.scrollToIndex({ index: targetIndex, align: 'start', behavior: 'smooth' });
                    } else {
                      const target = document.querySelector<HTMLElement>(`[data-row-id="${entry.firstRowId}"]`);
                      target?.scrollIntoView({ block: 'start', behavior: 'smooth' });
                    }
                  }}
                />
              ))}
            </>
          )}
          {sortState.kind === 'region' && regionIndex.length > 0 && (
            <>
              <Typography variant="caption" color="text.secondary">
                {translations.selection?.regionIndexLabel ?? 'Region Index'}
              </Typography>
              {regionIndex.map((entry) => (
                <Chip
                  key={entry.label}
                  label={`${entry.label} (${entry.count})`}
                  size="small"
                  onClick={() => {
                    const targetIndex = matrixRows.findIndex((row) => row.id === entry.firstRowId);
                    if (targetIndex >= 0) {
                      virtuosoRef.current?.scrollToIndex({ index: targetIndex, align: 'start', behavior: 'smooth' });
                    } else {
                      const target = document.querySelector<HTMLElement>(`[data-row-id="${entry.firstRowId}"]`);
                      target?.scrollIntoView({ block: 'start', behavior: 'smooth' });
                    }
                  }}
                />
              ))}
            </>
          )}
          {sortState.kind === 'type' && sortState.typeId && (
            (() => {
              const typeId = sortState.typeId as LocationType;
              const counts = selectedIndexByType[typeId] ?? { selected: 0, unselected: 0 };
              return (
                <>
                  <Typography variant="caption" color="text.secondary">
                    {translations.locationTypes?.[typeId] ?? typeId}
                  </Typography>
                  <Chip
                    label={(translations.selection?.selectedCountLabel ?? 'Selected: {{count}}').replace('{{count}}', String(counts.selected))}
                    size="small"
                    color="primary"
                  />
                  <Chip
                    label={(translations.selection?.notSelectedCountLabel ?? 'Not selected: {{count}}').replace('{{count}}', String(counts.unselected))}
                    size="small"
                  />
                </>
              );
            })()
          )}
        </Box>
      </Stack>
      <Box>
        <SelectionMatrix
          rows={matrixRows}
          columns={columns}
          state={matrixState}
          rowMetaColumns={rowMetaColumns}
          isCellEnabled={isCellEnabled}
          onChange={onChange}
          onSelectAll={onSelectAll}
          rowHeaderLabel={t('selectionMatrix.columnHeader', 'Country / Type')}
          dense
          rowHeight={40}
          onColumnHeaderClick={onColumnHeaderClick}
          onRowMetaHeaderClick={onRowMetaHeaderClick}
          getColumnSortDirection={getColumnSortDirection}
          getRowMetaSortDirection={getRowMetaSortDirection}
          getRowProps={(row) => ({
            'data-row-id': row.id,
          }) as React.HTMLAttributes<HTMLTableRowElement>}
          virtuosoRef={virtuosoRef}
        />
      </Box>
    </Box>
  );
};
