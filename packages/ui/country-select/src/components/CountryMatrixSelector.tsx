/**
 * @fileoverview CountryMatrixSelector - Main component for country and matrix selection
 * @module @hierarchidb/ui-country-select/components
 */

import {
  TreeTableSearchInput as SearchField,
  SelectionMatrix,
  type SelectionMatrixColumn,
  type SelectionMatrixRow,
} from '@hierarchidb/components';
import { Alert, Box, Chip, Stack, Typography } from '@mui/material';
import type { PrimitiveAtom } from 'jotai';
import { Provider } from 'jotai';
import type React from 'react';
import { useCountryI18n } from '~/hooks/useCountryI18n';
import type { Country } from '~/types/Country';
import type { MatrixConfig, MatrixSelection } from '~/types/MatrixColumn';
import {
  useCountryMatrixSelectorLogic,
  type VirtuosoHandle,
} from './useCountryMatrixSelectorLogic';
import { useCountryMatrixTableModel } from './useCountryMatrixTableModel';

export interface CountryMatrixSelectorProps {
  /** Available countries to select from */
  countries: Country[];
  /** Matrix configuration with columns */
  matrixConfig: MatrixConfig;
  /** Current selections atoms */
  selections: MatrixSelection[];
  /** Callback when selections change */
  onSelectionsChange: (selections: MatrixSelection[]) => void;
  /** Show row-level selection checkboxes */
  showRowSelection?: boolean;
  /** Whether to show alphabetical index chips */
  showAlphabetIndex?: boolean;
  /** Whether to show region index chips */
  showRegionIndex?: boolean;
  /** Scroll behavior for index chips */
  scrollBehavior?: ScrollBehavior;
  /** Optional scroll duration for index chips (ms). Overrides scrollBehavior when set. */
  indexScrollDurationMs?: number;
  /** Jump instead of scroll */
  jumpInsteadOfScroll?: boolean;
  /** Component height */
  height?: number | string;
  /** Optional maxHeight override */
  maxHeight?: number | string;
  /** Row height for virtualization */
  rowHeight?: number;
  /** Disable specific cells (e.g., by data source) */
  isCellEnabled?: (country: Country, columnId: string) => boolean;
  /** Show loading indicator */
  loading?: boolean;
  /** Error message to display instead of the table */
  errorMessage?: string | null;
}

export const CountryMatrixSelector: React.FC<CountryMatrixSelectorProps> = ({
  countries,
  matrixConfig,
  selections,
  onSelectionsChange,
  showRowSelection = false,
  showAlphabetIndex = true,
  showRegionIndex = true,
  scrollBehavior = 'smooth',
  indexScrollDurationMs,
  jumpInsteadOfScroll = false,
  height = 600,
  maxHeight,
  rowHeight = 40,
  isCellEnabled = () => true,
  loading = false,
  errorMessage = null,
}) => {
  const {
    virtuosoRef,
    search,
    setSearch,
    sortState,
    rows,
    selectionColumns,
    matrixStateAtom,
    store,
    selectedCountryCodes,
    scrollToRowIndex,
    handleSelectionChange,
    handleSelectAllColumn,
    handleSelectRow,
    handleSortToggle,
    getColumnSortDirection,
    getRowMetaSortDirection,
    isCellEnabledWrapper,
    flagFromCode,
    alphabetIndex,
    alphabetIndexSelections,
    regionIndex,
  } = useCountryMatrixSelectorLogic({
    countries,
    matrixConfig,
    selections,
    onSelectionsChange,
    scrollBehavior,
    indexScrollDurationMs,
    jumpInsteadOfScroll,
    isCellEnabled,
  });

  if (loading || !virtuosoRef) {
    return <Alert severity="info">Loading countries...</Alert>;
  }

  if (errorMessage) {
    return <Alert severity="error">{errorMessage}</Alert>;
  }

  if (!countries.length) {
    return <Alert severity="warning">No countries available.</Alert>;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1, minHeight: 0 }}>
      <Stack
        direction="row"
        spacing={2}
        alignItems="center"
        flexWrap="wrap"
        justifyContent="flex-start"
      >
        <Box sx={{ flexBasis: '260px', flexGrow: 0, flexShrink: 1, paddingBottom: 1 }}>
          <SearchField
            searchText={search}
            handleSearchTextChange={setSearch}
            placeholder="Search by country or code..."
            ariaLabel="Search countries"
            fullWidth
          />
        </Box>
        <Box display="flex" gap={1} alignItems="center" flexWrap="wrap" sx={{ flexGrow: 1 }}>
          {showAlphabetIndex && sortState.kind === 'country' && alphabetIndex.length > 0 && (
            <>
              <Typography variant="caption" color="text.secondary">
                Index
              </Typography>
              {alphabetIndex.map((entry) => (
                <Chip
                  key={entry.label}
                  label={`${entry.label} (${entry.count})`}
                  size="small"
                  color={alphabetIndexSelections.get(entry.label) ? 'primary' : 'default'}
                  onClick={() => {
                    const targetIndex = rows.findIndex((row) => row.id === entry.firstRowId);
                    if (targetIndex >= 0) {
                      scrollToRowIndex(targetIndex);
                    }
                  }}
                />
              ))}
            </>
          )}
          {showRegionIndex && sortState.kind === 'region' && regionIndex.length > 0 && (
            <>
              <Typography variant="caption" color="text.secondary">
                Region
              </Typography>
              {regionIndex.map((entry) => (
                <Chip
                  key={entry.label}
                  label={`${entry.label} (${entry.count})`}
                  size="small"
                  onClick={() => {
                    const targetIndex = rows.findIndex((row) => row.id === entry.firstRowId);
                    if (targetIndex >= 0) {
                      scrollToRowIndex(targetIndex);
                    }
                  }}
                />
              ))}
            </>
          )}
        </Box>
      </Stack>

      <Box sx={{ flex: 1, minHeight: 0 }}>
        <Provider store={store}>
          <CountryMatrixTable
            rows={rows}
            selectionColumns={selectionColumns}
            matrixStateAtom={matrixStateAtom}
            rowHeight={rowHeight}
            isCellEnabledWrapper={isCellEnabledWrapper}
            handleSelectionChange={handleSelectionChange}
            handleSelectAllColumn={handleSelectAllColumn}
            handleSelectRow={handleSelectRow}
            showRowSelection={showRowSelection}
            handleSortToggle={handleSortToggle}
            getColumnSortDirection={getColumnSortDirection}
            getRowMetaSortDirection={getRowMetaSortDirection}
            flagFromCode={flagFromCode}
            virtuosoRef={virtuosoRef}
            height={height}
            maxHeight={maxHeight}
            selectedCountryCodes={selectedCountryCodes}
          />
        </Provider>
      </Box>
    </Box>
  );
};

type CountryMatrixTableProps = {
  rows: SelectionMatrixRow<{ country: Country; sourceIndex: number }>[];
  selectionColumns: SelectionMatrixColumn[];
  matrixStateAtom: PrimitiveAtom<boolean[][]>;
  rowHeight: number;
  isCellEnabledWrapper: (
    row: SelectionMatrixRow<{ country: Country }>,
    column: SelectionMatrixColumn
  ) => boolean;
  handleSelectionChange: (rowIndex: number, colIndex: number, checked: boolean) => void;
  handleSelectAllColumn: (colIndex: number, checked: boolean, enabledRowIndices: number[]) => void;
  handleSelectRow: (rowIndex: number, checked: boolean, enabledColumnIndices: number[]) => void;
  showRowSelection: boolean;
  handleSortToggle: (kind: 'country' | 'region' | 'column', columnId?: string) => void;
  getColumnSortDirection: (colIndex: number) => 'asc' | 'desc' | 'none';
  getRowMetaSortDirection: (metaIndex: number) => 'asc' | 'desc' | 'none';
  flagFromCode: (code?: string) => string;
  virtuosoRef: React.MutableRefObject<VirtuosoHandle | null>;
  height: number | string;
  maxHeight?: number | string;
  selectedCountryCodes: ReadonlySet<string>;
};

const CountryMatrixTable: React.FC<CountryMatrixTableProps> = ({
  rows,
  selectionColumns,
  matrixStateAtom,
  rowHeight,
  isCellEnabledWrapper,
  handleSelectionChange,
  handleSelectAllColumn,
  handleSelectRow,
  showRowSelection,
  handleSortToggle,
  getColumnSortDirection,
  getRowMetaSortDirection,
  flagFromCode,
  virtuosoRef,
  height,
  maxHeight,
  selectedCountryCodes,
}) => {
  const { matrixState, rowsWithTooltip, columnHeaderState } = useCountryMatrixTableModel({
    rows,
    selectionColumns,
    matrixStateAtom,
    isCellEnabledWrapper,
  });

  const { getCountryDisplayName } = useCountryI18n();

  return (
    <SelectionMatrix
      rows={rowsWithTooltip}
      columns={selectionColumns}
      state={matrixState}
      onChange={handleSelectionChange}
      onSelectAll={handleSelectAllColumn}
      onSelectRow={handleSelectRow}
      showRowSelection={showRowSelection}
      rowMetaColumns={[
        {
          header: 'Region',
          render: (row: SelectionMatrixRow<{ country: Country }>) => (
            <Typography variant="body2" color="text.secondary">
              {row.subLabel ?? '-'}
            </Typography>
          ),
          width: 140,
        },
        {
          header: 'Country',
          render: (row: SelectionMatrixRow<{ country: Country }>) => (
            <Box display="flex" alignItems="center" gap={1.25}>
              <Typography
                variant="body2"
                component="span"
                color={selectedCountryCodes.has(row.data.country.code) ? 'primary' : 'text.primary'}
              >
                {row.data.country.flag || flagFromCode(row.data.country.code) || '⬜️'}{' '}
                {getCountryDisplayName(row.data.country)} ({row.data.country.code})
              </Typography>
            </Box>
          ),
          width: 220,
        },
      ]}
      rowHeaderLabel="Country / Type"
      dense
      rowHeight={rowHeight}
      isCellEnabled={isCellEnabledWrapper}
      getColumnHeaderState={(colIndex) =>
        columnHeaderState[colIndex] ?? { checked: false, indeterminate: false }
      }
      onColumnHeaderClick={(colIndex: number) => {
        const column = selectionColumns[colIndex];
        if (!column) return;
        handleSortToggle('column', column.id);
      }}
      onRowMetaHeaderClick={(metaIndex: number) =>
        handleSortToggle(metaIndex === 0 ? 'region' : 'country')
      }
      getColumnSortDirection={getColumnSortDirection}
      getRowMetaSortDirection={getRowMetaSortDirection}
      virtuosoRef={virtuosoRef}
      height={height}
      maxHeight={maxHeight}
    />
  );
};
