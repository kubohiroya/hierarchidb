/**
 * @fileoverview CountryMatrixSelector - Main component for country and matrix selection
 * @module @hierarchidb/ui-country-select/components
 */

import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Chip, Stack, Typography, Alert } from '@mui/material';
import { SelectionMatrix, type SelectionMatrixColumn, type SelectionMatrixRow } from '@hierarchidb/components';
import { SearchField } from '@hierarchidb/ui-search-field';
import type { PrimitiveAtom } from 'jotai';
import { Provider, atom, useAtomValue } from 'jotai';
import { createStore } from 'jotai/vanilla';
import type { Country } from '../types/Country.js';
import { CONTINENTS } from '../types/Country.js';
import type { MatrixConfig, MatrixSelection } from '../types/MatrixColumn.js';

export interface CountryMatrixSelectorProps {
  /** Available countries to select from */
  countries: Country[];
  /** Matrix configuration with columns */
  matrixConfig: MatrixConfig;
  /** Current selections atoms */
  selections: MatrixSelection[];
  /** Callback when selections change */
  onSelectionsChange: (selections: MatrixSelection[]) => void;
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

type ScrollToIndexOptions = {
  index: number;
  align: 'start' | 'center' | 'end';
  behavior: ScrollBehavior;
};

type VirtuosoHandle = {
  scrollToIndex: (options: ScrollToIndexOptions) => void;
  scrollTo: (options: ScrollToOptions) => void;
  getState: (stateCb: (state: { scrollTop: number }) => void) => void;
};

export const CountryMatrixSelector: React.FC<CountryMatrixSelectorProps> = ({
  countries,
  matrixConfig,
  selections,
  onSelectionsChange,
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
  const virtuosoRef = useRef<VirtuosoHandle | null>(null);
  const [search, setSearch] = useState('');
  const [sortState, setSortState] = useState<{ kind: 'country' | 'region' | 'column'; columnId?: string; direction: 'asc' | 'desc' }>({
    kind: 'country',
    direction: 'asc',
  });

  const selectionMap = useMemo(() => {
    const map = new Map<string, Record<string, boolean>>();
    selections.map((sel) => map.set(sel.countryCode, sel.selections));
    return map;
  }, [selections]);

  const selectedCountryCodes = useMemo(() => {
    const set = new Set<string>();
    selections.forEach((sel) => {
      if (Object.values(sel.selections ?? {}).some(Boolean)) {
        set.add(sel.countryCode);
      }
    });
    return set;
  }, [selections]);

  const disabledColumnIdSet = useMemo(
    () => new Set(matrixConfig.disabledColumnIds ?? []),
    [matrixConfig.disabledColumnIds],
  );

  const selectionColumns: SelectionMatrixColumn[] = useMemo(
    () =>
      matrixConfig.columns.map((col) => ({
        id: col.id,
        label: col.label,
        description: col.description,
        icon: col.icon,
        width: col.width,
        disabled: disabledColumnIdSet.has(col.id),
      })),
    [disabledColumnIdSet, matrixConfig.columns],
  );

  const scrollToRowIndex = useCallback(
    (targetIndex: number) => {
      const handle = virtuosoRef.current;
      if (!handle) return;

      if (jumpInsteadOfScroll || !indexScrollDurationMs || indexScrollDurationMs <= 0) {
        handle.scrollToIndex({
          index: targetIndex,
          align: 'start',
          behavior: jumpInsteadOfScroll ? 'auto' : scrollBehavior,
        });
        return;
      }

      if (typeof requestAnimationFrame === 'undefined') {
        handle.scrollToIndex({ index: targetIndex, align: 'start', behavior: 'auto' });
        return;
      }

      handle.getState((state) => {
        const startTop = state.scrollTop ?? 0;
        handle.scrollToIndex({ index: targetIndex, align: 'start', behavior: 'auto' });
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            handle.getState((afterState) => {
              const targetTop = afterState.scrollTop ?? startTop;
              const delta = targetTop - startTop;
              if (Math.abs(delta) < 2) {
                handle.scrollToIndex({ index: targetIndex, align: 'start', behavior: scrollBehavior });
                return;
              }

              handle.scrollTo({ top: startTop, behavior: 'auto' });
              const durationMs = Math.max(16, indexScrollDurationMs);
              const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
              const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
              const step = (now: number) => {
                const currentTime = typeof performance !== 'undefined' ? now : Date.now();
                const elapsed = currentTime - startTime;
                const t = Math.min(1, elapsed / durationMs);
                const eased = easeOutCubic(t);
                handle.scrollTo({ top: startTop + delta * eased, behavior: 'auto' });
                if (t < 1) {
                  requestAnimationFrame(step);
                }
              };
              requestAnimationFrame(step);
            });
          });
        });
      });
    },
    [indexScrollDurationMs, jumpInsteadOfScroll, scrollBehavior],
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
    'n/a': 'XX',
    'unknown': 'XX',
    'unspecified': 'XX',
    'none': 'XX',
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
    '不明': 'XX',
    '不詳': 'XX',
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

  const selectionMapForSort = sortState.kind === 'column' ? selectionMap : null;

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
        const activeSelectionMap = selectionMapForSort ?? selectionMap;
        const aSelected = activeSelectionMap.get(a.country.code)?.[sortState.columnId] ?? false;
        const bSelected = activeSelectionMap.get(b.country.code)?.[sortState.columnId] ?? false;
        if (aSelected === bSelected) return compare(a.country.name, b.country.name, 'asc');
        return sortState.direction === 'desc' ? Number(bSelected) - Number(aSelected) : Number(aSelected) - Number(bSelected);
      }
      return compare(a.country.name, b.country.name, sortState.direction);
    });
    return filtered;
  }, [countries, flagFromCode, search, selectionMap, selectionMapForSort, sortState.columnId, sortState.direction, sortState.kind, toRegionLabel]);

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

  const storeRef = useRef<ReturnType<typeof createStore>>();
  if (!storeRef.current) {
    storeRef.current = createStore();
  }
  const store = storeRef.current;

  const matrixAtomRef = useRef<PrimitiveAtom<boolean[][]>>();
  if (!matrixAtomRef.current) {
    matrixAtomRef.current = atom<boolean[][]>([]);
  }
  const matrixStateAtom = matrixAtomRef.current;
  const pendingSyncRef = useRef(false);

  const isMatrixEqual = useCallback((left: boolean[][], right: boolean[][]): boolean => {
    if (left === right) return true;
    if (left.length !== right.length) return false;
    for (let rowIndex = 0; rowIndex < left.length; rowIndex += 1) {
      const leftRow = left[rowIndex] ?? [];
      const rightRow = right[rowIndex] ?? [];
      if (leftRow.length !== rightRow.length) return false;
      for (let colIndex = 0; colIndex < leftRow.length; colIndex += 1) {
        if (Boolean(leftRow[colIndex]) !== Boolean(rightRow[colIndex])) return false;
      }
    }
    return true;
  }, []);

  const setMatrixFromSelections = useCallback(
    (nextSelections: MatrixSelection[]) => {
      const selectionByCode = new Map(nextSelections.map((sel) => [sel.countryCode, sel.selections]));
      const nextMatrix = rows.map((row) =>
        selectionColumns.map((col) => Boolean(selectionByCode.get(row.data.country.code)?.[col.id])),
      );
      pendingSyncRef.current = true;
      store.set(matrixStateAtom, nextMatrix);
    },
    [matrixStateAtom, rows, selectionColumns, store],
  );

  useEffect(() => {
    const prev = store.get(matrixStateAtom);
    if (isMatrixEqual(prev, matrixState)) {
      pendingSyncRef.current = false;
      return;
    }
    if (pendingSyncRef.current) return;
    store.set(matrixStateAtom, matrixState);
  }, [isMatrixEqual, matrixState, matrixStateAtom, store]);

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
      setMatrixFromSelections(normalized);
      onSelectionsChange(normalized);
    },
    [countries, onSelectionsChange, rows, selectionColumns, selectionMap, setMatrixFromSelections],
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
      setMatrixFromSelections(normalized);
      onSelectionsChange(normalized);
    },
    [countries, onSelectionsChange, rows, selectionColumns, selectionMap, setMatrixFromSelections],
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

  const alphabetIndexSelections = useMemo(() => {
    const selectedByLetter = new Map<string, boolean>();
    rows.forEach((row) => {
      const letter = (row.data.country.name?.[0] ?? '#').toUpperCase();
      const selectionsByColumn = selectionMap.get(row.data.country.code);
      const hasSelection = Boolean(selectionsByColumn && Object.values(selectionsByColumn).some(Boolean));
      if (hasSelection) {
        selectedByLetter.set(letter, true);
        return;
      }
      if (!selectedByLetter.has(letter)) {
        selectedByLetter.set(letter, false);
      }
    });
    return selectedByLetter;
  }, [rows, selectionMap]);

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
      !disabledColumnIdSet.has(column.id) && isCellEnabled(row.data.country, column.id),
    [disabledColumnIdSet, isCellEnabled],
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

  if (loading || !virtuosoRef) {
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
  handleSortToggle,
  getColumnSortDirection,
  getRowMetaSortDirection,
  flagFromCode,
  virtuosoRef,
  height,
  maxHeight,
  selectedCountryCodes,
}) => {
  const matrixState = useAtomValue(matrixStateAtom);
  const rowsWithTooltip = useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        tooltip: row.data.country.name,
      })),
    [rows],
  );

  const columnHeaderState = useMemo(() => {
    return selectionColumns.map((column, colIndex) => {
      let enabled = 0;
      let selected = 0;
      rows.forEach((row, rowIndex) => {
        if (!isCellEnabledWrapper(row as SelectionMatrixRow<{ country: Country }>, column)) {
          return;
        }
        enabled += 1;
        if (matrixState[rowIndex]?.[colIndex]) selected += 1;
      });
      return {
        checked: enabled > 0 && selected === enabled,
        indeterminate: enabled > 0 && selected > 0 && selected < enabled,
      };
    });
  }, [isCellEnabledWrapper, matrixState, rows, selectionColumns]);

  return (
    <SelectionMatrix
      rows={rowsWithTooltip}
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
              <Typography
                variant="body2"
                component="span"
                color={selectedCountryCodes.has(row.data.country.code) ? 'primary' : 'text.primary'}
              >
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
      getColumnHeaderState={(colIndex) => columnHeaderState[colIndex] ?? { checked: false, indeterminate: false }}
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
  );
};
