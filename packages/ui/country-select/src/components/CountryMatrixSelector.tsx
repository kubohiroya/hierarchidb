/**
 * @fileoverview CountryMatrixSelector - Main component for country and matrix selection
 * @module @hierarchidb/ui-country-select/components
 */

import type React from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Box, Chip, Stack, Typography, Alert } from '@mui/material';
import { SelectionMatrix, type SelectionMatrixColumn, type SelectionMatrixRow } from '@hierarchidb/components';
import { SearchField } from '@hierarchidb/ui-search-field';
import type { Country } from '../types/Country.js';
import { CONTINENTS } from '../types/Country.js';
import type { MatrixConfig, MatrixSelection } from '../types/MatrixColumn.js';

export interface CountryMatrixSelectorProps {
  /** Available countries to select from */
  countries: Country[];
  /** Matrix configuration with columns */
  matrixConfig: MatrixConfig;
  /** Current selections state */
  selections: MatrixSelection[];
  /** Callback when selections change */
  onSelectionsChange: (selections: MatrixSelection[]) => void;
  /** Whether to show alphabetical index chips */
  showAlphabetIndex?: boolean;
  /** Whether to show region index chips */
  showRegionIndex?: boolean;
  /** Scroll behavior for index chips */
  scrollBehavior?: ScrollBehavior;
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
  showAlphabetIndex = true,
  showRegionIndex = true,
  scrollBehavior = 'smooth',
  jumpInsteadOfScroll = false,
  height = 600,
  maxHeight,
  rowHeight = 40,
  isCellEnabled = () => true,
  loading = false,
  errorMessage = null,
}) => {
  const virtuosoRef = useRef<any>(null);
  const [search, setSearch] = useState('');
  const [sortState, setSortState] = useState<{ kind: 'country' | 'region' | 'column'; columnId?: string; direction: 'asc' | 'desc' }>({
    kind: 'country',
    direction: 'asc',
  });

  const selectionMap = useMemo(() => {
    const map = new Map<string, Record<string, boolean>>();
    selections.forEach((sel) => map.set(sel.countryCode, sel.selections));
    return map;
  }, [selections]);

  const selectionColumns: SelectionMatrixColumn[] = useMemo(
    () =>
      matrixConfig.columns.map((col) => ({
        id: col.id,
        label: col.label,
        description: col.description,
        width: col.width,
      })),
    [matrixConfig.columns],
  );

  const continentAliases: Record<string, keyof typeof CONTINENTS> = useMemo(() => ({
    'north america': 'NA',
    'south america': 'SA',
    'central america': 'NA',
    'europe': 'EU',
    'asia': 'AS',
    'oceania': 'OC',
    'australia': 'OC',
    'africa': 'AF',
    'antarctica': 'AN',
    'アフリカ': 'AF',
    'アメリカ': 'NA',
    '北アメリカ': 'NA',
    '南アメリカ': 'SA',
    '中南アメリカ': 'SA',
    'ヨーロッパ': 'EU',
    '欧州': 'EU',
    'オセアニア': 'OC',
    '大洋州': 'OC',
    'アジア': 'AS',
    '中東': 'AS',
    '南極': 'AN',
    '南極大陸': 'AN',
  }), []);

  const toRegionLabel = useCallback((continent?: string) => {
    if (!continent) return '-';
    const key = continent.toLowerCase().trim();
    const alias = continentAliases[key];
    if (alias && CONTINENTS[alias]) return CONTINENTS[alias].name;
    if (CONTINENTS[continent as keyof typeof CONTINENTS]) {
      return CONTINENTS[continent as keyof typeof CONTINENTS].name;
    }
    return continent;
  }, [continentAliases]);

  const flagFromCode = useCallback((code?: string) => {
    if (!code || code.length !== 2) return '';
    const base = 0x1f1e6 - 'A'.charCodeAt(0);
    const upper = code.toUpperCase();
    const chars = upper.split('').map((c) => String.fromCodePoint(base + c.charCodeAt(0)));
    return chars.join('');
  }, []);

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const enriched = countries.map((country, index) => {
      const regionLabel = toRegionLabel(country.continent as string | undefined);
      const native = country.nativeName && country.nativeName !== country.name ? country.nativeName : undefined;
      const code = country.code?.length === 2 ? country.code : '';
      const flag = country.flag || flagFromCode(code);
      const label = `${flag ? `${flag} ` : ''}${country.name}${code ? ` (${code})` : ''}${native ? ` / ${native}` : ''}`;
      return {
        country,
        index,
        regionLabel,
        label,
      };
    });
    const filtered = enriched.filter(({ country }) => {
      if (!keyword) return true;
      return (
        country.name.toLowerCase().includes(keyword)
        || country.nativeName?.toLowerCase?.().includes(keyword)
        || country.code.toLowerCase().includes(keyword)
      );
    });
    const compare = (a: string, b: string, dir: 'asc' | 'desc') =>
      dir === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
    filtered.sort((a, b) => {
      if (sortState.kind === 'region') {
        return compare(a.regionLabel ?? '', b.regionLabel ?? '', sortState.direction);
      }
      if (sortState.kind === 'column' && sortState.columnId) {
        const aSelected = selectionMap.get(a.country.code)?.[sortState.columnId] ?? false;
        const bSelected = selectionMap.get(b.country.code)?.[sortState.columnId] ?? false;
        if (aSelected === bSelected) return compare(a.country.name, b.country.name, 'asc');
        return sortState.direction === 'desc' ? Number(bSelected) - Number(aSelected) : Number(aSelected) - Number(bSelected);
      }
      return compare(a.country.name, b.country.name, sortState.direction);
    });
    return filtered;
  }, [countries, search, selectionMap, sortState]);

  const rows: SelectionMatrixRow<{ country: Country; sourceIndex: number }>[] = useMemo(
    () =>
      filteredRows.map(({ country, index, regionLabel, label }) => ({
        id: country.code,
        label,
        subLabel: regionLabel,
        data: { country, sourceIndex: index },
      })),
    [filteredRows],
  );

  const matrixState = useMemo(() => {
    return rows.map((row) =>
      selectionColumns.map((col) => selectionMap.get(row.data.country.code)?.[col.id] ?? false),
    );
  }, [rows, selectionColumns, selectionMap]);

  const handleSortToggle = useCallback((kind: 'country' | 'region' | 'column', columnId?: string) => {
    setSortState((prev) => {
      if (prev.kind === kind && prev.columnId === columnId) {
        return { kind, columnId, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { kind, columnId, direction: 'asc' };
    });
  }, []);

  const handleSelectionChange = useCallback(
    (rowIndex: number, colIndex: number, checked: boolean) => {
      const row = rows[rowIndex];
      const col = selectionColumns[colIndex];
      if (!row || !col) return;
      const countryCode = row.data.country.code;
      const next = new Map(selectionMap);
      const existing = next.get(countryCode) ?? {};
      next.set(countryCode, { ...existing, [col.id]: checked });
      const normalized: MatrixSelection[] = countries.map((country) => ({
        countryCode: country.code,
        selections: next.get(country.code) ?? {},
      }));
      onSelectionsChange(normalized);
    },
    [countries, onSelectionsChange, rows, selectionColumns, selectionMap],
  );

  const handleSelectAllColumn = useCallback(
    (colIndex: number, checked: boolean, enabledRowIndices: number[]) => {
      const col = selectionColumns[colIndex];
      if (!col) return;
      const next = new Map(selectionMap);
      enabledRowIndices.forEach((rowIdx) => {
        const row = rows[rowIdx];
        if (!row) return;
        const prev = next.get(row.data.country.code) ?? {};
        next.set(row.data.country.code, { ...prev, [col.id]: checked });
      });
      const normalized: MatrixSelection[] = countries.map((country) => ({
        countryCode: country.code,
        selections: next.get(country.code) ?? {},
      }));
      onSelectionsChange(normalized);
    },
    [countries, onSelectionsChange, rows, selectionColumns, selectionMap],
  );

  const alphabetIndex = useMemo(() => {
    const groups: Record<string, { count: number; firstRowId: string }> = {};
    rows.forEach((row) => {
      const letter = (row.data.country.name?.[0] ?? '#').toUpperCase();
      if (!groups[letter]) groups[letter] = { count: 0, firstRowId: row.id };
      groups[letter].count += 1;
    });
    return Object.entries(groups)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([letter, value]) => ({ label: letter, count: value.count, firstRowId: value.firstRowId }));
  }, [rows]);

  const regionIndex = useMemo(() => {
    const groups: Record<string, { count: number; firstRowId: string }> = {};
    rows.forEach((row) => {
      const region = row.subLabel ?? '-';
      if (!groups[region]) groups[region] = { count: 0, firstRowId: row.id };
      groups[region].count += 1;
    });
    return Object.entries(groups)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, value]) => ({ label, count: value.count, firstRowId: value.firstRowId }));
  }, [rows]);

  const isCellEnabledWrapper = useCallback(
    (row: SelectionMatrixRow<{ country: Country }>, column: SelectionMatrixColumn) =>
      isCellEnabled(row.data.country, column.id),
    [isCellEnabled],
  );

  const getColumnSortDirection = useCallback(
    (colIndex: number) => {
      const column = selectionColumns[colIndex];
      if (!column || sortState.kind !== 'column' || sortState.columnId !== column.id) return 'none';
      return sortState.direction;
    },
    [selectionColumns, sortState],
  );

  const getRowMetaSortDirection = useCallback(
    (metaIndex: number) => {
      if (metaIndex === 0 && sortState.kind === 'region') return sortState.direction;
      if (metaIndex === 1 && sortState.kind === 'country') return sortState.direction;
      return 'none';
    },
    [sortState],
  );

  if (loading) {
    return (
      <Alert severity="info">Loading countries...</Alert>
    );
  }

  if (errorMessage) {
    return (
      <Alert severity="error">{errorMessage}</Alert>
    );
  }

  if (!countries.length) {
    return (
      <Alert severity="warning">No countries available.</Alert>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1, minHeight: 0 }}>
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" justifyContent="flex-start">
        <Box sx={{ flexBasis: '260px', flexGrow: 0, flexShrink: 1 }}>
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
              onClick={() => {
                const targetIndex = rows.findIndex((row) => row.id === entry.firstRowId);
                if (targetIndex >= 0) {
                  virtuosoRef.current?.scrollToIndex({
                    index: targetIndex,
                    align: 'start',
                    behavior: jumpInsteadOfScroll ? 'auto' : scrollBehavior,
                  });
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
                  virtuosoRef.current?.scrollToIndex({
                    index: targetIndex,
                    align: 'start',
                    behavior: jumpInsteadOfScroll ? 'auto' : scrollBehavior,
                  });
                }
              }}
            />
          ))}
            </>
          )}
        </Box>
      </Stack>

      <Box sx={{ flex: 1, minHeight: 0 }}>
        <SelectionMatrix
        rows={rows.map((row) => ({
          ...row,
          tooltip: row.data.country.name,
        }))}
        columns={selectionColumns}
        state={matrixState}
        onChange={handleSelectionChange}
        onSelectAll={handleSelectAllColumn}
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
                <Typography variant="body2" component="span">
                  {row.data.country.flag || flagFromCode(row.data.country.code) || '⬜️'}{' '}
                  {row.data.country.name} ({row.data.country.code})
                  {row.data.country.nativeName && row.data.country.nativeName !== row.data.country.name && (
                    <Typography
                      component="span"
                      variant="caption"
                      color="text.secondary"
                      sx={{ ml: 0.75 }}
                    >
                      {row.data.country.nativeName}
                    </Typography>
                  )}
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
        onColumnHeaderClick={(colIndex: number) => {
          const column = selectionColumns[colIndex];
          if (!column) return;
          handleSortToggle('column', column.id);
        }}
        onRowMetaHeaderClick={(metaIndex: number) => handleSortToggle(metaIndex === 0 ? 'region' : 'country')}
        getColumnSortDirection={getColumnSortDirection}
        getRowMetaSortDirection={getRowMetaSortDirection}
        virtuosoRef={virtuosoRef}
        height={height}
        maxHeight={maxHeight}
        />
      </Box>
    </Box>
  );
};
