import type { SelectionMatrixColumn, SelectionMatrixRow } from '@hierarchidb/components';
import type { PrimitiveAtom } from 'jotai';
import { atom } from 'jotai';
import { createStore } from 'jotai/vanilla';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Country } from '~/types/Country';
import { CONTINENTS } from '~/types/Country';
import type { MatrixConfig, MatrixSelection } from '~/types/MatrixColumn';

export type ScrollToIndexOptions = {
  index: number;
  align: 'start' | 'center' | 'end';
  behavior: ScrollBehavior;
};

export type VirtuosoHandle = {
  scrollToIndex: (options: ScrollToIndexOptions) => void;
  scrollTo: (options: ScrollToOptions) => void;
  getState: (stateCb: (state: { scrollTop: number }) => void) => void;
};

export interface UseCountryMatrixSelectorLogicParams {
  countries: Country[];
  matrixConfig: MatrixConfig;
  selections: MatrixSelection[];
  onSelectionsChange: (selections: MatrixSelection[]) => void;
  scrollBehavior: ScrollBehavior;
  indexScrollDurationMs?: number;
  jumpInsteadOfScroll: boolean;
  isCellEnabled: (country: Country, columnId: string) => boolean;
}

export function useCountryMatrixSelectorLogic({
  countries,
  matrixConfig,
  selections,
  onSelectionsChange,
  scrollBehavior,
  indexScrollDurationMs,
  jumpInsteadOfScroll,
  isCellEnabled,
}: UseCountryMatrixSelectorLogicParams) {
  const virtuosoRef = useRef<VirtuosoHandle | null>(null);
  const [search, setSearch] = useState('');
  const [sortState, setSortState] = useState<{
    kind: 'country' | 'region' | 'column';
    columnId?: string;
    direction: 'asc' | 'desc';
  }>({
    kind: 'country',
    direction: 'asc',
  });

  const selectionMap = useMemo(() => {
    const map = new Map<string, Record<string, boolean>>();
    selections.map((selection) => map.set(selection.countryCode, selection.selections));
    return map;
  }, [selections]);

  const selectedCountryCodes = useMemo(() => {
    const selected = new Set<string>();
    selections.forEach((selection) => {
      if (Object.values(selection.selections ?? {}).some(Boolean)) {
        selected.add(selection.countryCode);
      }
    });
    return selected;
  }, [selections]);

  const disabledColumnIdSet = useMemo(
    () => new Set(matrixConfig.disabledColumnIds ?? []),
    [matrixConfig.disabledColumnIds]
  );

  const selectionColumns: SelectionMatrixColumn[] = useMemo(
    () =>
      matrixConfig.columns.map((column) => ({
        id: column.id,
        label: column.label,
        description: column.description,
        icon: column.icon,
        width: column.width,
        disabled: disabledColumnIdSet.has(column.id),
      })),
    [disabledColumnIdSet, matrixConfig.columns]
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
                handle.scrollToIndex({
                  index: targetIndex,
                  align: 'start',
                  behavior: scrollBehavior,
                });
                return;
              }

              handle.scrollTo({ top: startTop, behavior: 'auto' });
              const durationMs = Math.max(16, indexScrollDurationMs);
              const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
              const easeOutCubic = (value: number) => 1 - Math.pow(1 - value, 3);
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
    [indexScrollDurationMs, jumpInsteadOfScroll, scrollBehavior]
  );

  const continentAliases: Record<string, keyof typeof CONTINENTS> = useMemo(
    () => ({
      'north america': 'NA',
      'south america': 'SA',
      'central america': 'NA',
      europe: 'EU',
      asia: 'AS',
      oceania: 'OC',
      australia: 'OC',
      africa: 'AF',
      antarctica: 'AN',
      'n/a': 'XX',
      unknown: 'XX',
      unspecified: 'XX',
      none: 'XX',
      アフリカ: 'AF',
      アメリカ: 'NA',
      北アメリカ: 'NA',
      南アメリカ: 'SA',
      中南アメリカ: 'SA',
      ヨーロッパ: 'EU',
      欧州: 'EU',
      オセアニア: 'OC',
      大洋州: 'OC',
      アジア: 'AS',
      中東: 'AS',
      南極: 'AN',
      南極大陸: 'AN',
      不明: 'XX',
      不詳: 'XX',
    }),
    []
  );

  const toRegionLabel = useCallback(
    (continent?: string) => {
      if (!continent) return '-';
      const key = continent.toLowerCase().trim();
      const alias = continentAliases[key];
      if (alias && CONTINENTS[alias]) return CONTINENTS[alias].name;
      if (CONTINENTS[continent as keyof typeof CONTINENTS]) {
        return CONTINENTS[continent as keyof typeof CONTINENTS].name;
      }
      return continent;
    },
    [continentAliases]
  );

  const flagFromCode = useCallback((code?: string) => {
    if (!code || code.length !== 2) return '';
    const base = 0x1f1e6 - 'A'.charCodeAt(0);
    const upper = code.toUpperCase();
    const chars = upper.split('').map((char) => String.fromCodePoint(base + char.charCodeAt(0)));
    return chars.join('');
  }, []);

  const selectionMapForSort = sortState.kind === 'column' ? selectionMap : null;
  const selectAllBatchRef = useRef<{ map: Map<string, Record<string, boolean>> } | null>(null);
  const selectAllScheduledRef = useRef(false);

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const enriched = countries.map((country, index) => {
      const regionLabel = toRegionLabel(country.continent as string | undefined);
      const native =
        country.nativeName && country.nativeName !== country.name ? country.nativeName : undefined;
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
        country.name.toLowerCase().includes(keyword) ||
        country.nativeName?.toLowerCase?.().includes(keyword) ||
        country.code.toLowerCase().includes(keyword)
      );
    });

    const compare = (left: string, right: string, direction: 'asc' | 'desc') =>
      direction === 'asc' ? left.localeCompare(right) : right.localeCompare(left);

    filtered.sort((left, right) => {
      if (sortState.kind === 'region') {
        return compare(left.regionLabel ?? '', right.regionLabel ?? '', sortState.direction);
      }
      if (sortState.kind === 'column' && sortState.columnId) {
        const activeSelectionMap = selectionMapForSort ?? selectionMap;
        const leftSelected =
          activeSelectionMap.get(left.country.code)?.[sortState.columnId] ?? false;
        const rightSelected =
          activeSelectionMap.get(right.country.code)?.[sortState.columnId] ?? false;
        if (leftSelected === rightSelected)
          return compare(left.country.name, right.country.name, 'asc');
        return sortState.direction === 'desc'
          ? Number(rightSelected) - Number(leftSelected)
          : Number(leftSelected) - Number(rightSelected);
      }
      return compare(left.country.name, right.country.name, sortState.direction);
    });

    return filtered;
  }, [
    countries,
    flagFromCode,
    search,
    selectionMap,
    selectionMapForSort,
    sortState.columnId,
    sortState.direction,
    sortState.kind,
    toRegionLabel,
  ]);

  const rows: SelectionMatrixRow<{ country: Country; sourceIndex: number }>[] = useMemo(
    () =>
      filteredRows.map(({ country, index, regionLabel, label }) => ({
        id: country.code,
        label,
        subLabel: regionLabel,
        data: { country, sourceIndex: index },
      })),
    [filteredRows]
  );

  const matrixState = useMemo(() => {
    return rows.map((row) =>
      selectionColumns.map(
        (column) => selectionMap.get(row.data.country.code)?.[column.id] ?? false
      )
    );
  }, [rows, selectionColumns, selectionMap]);

  const storeRef = useRef<ReturnType<typeof createStore> | undefined>(undefined);
  if (!storeRef.current) {
    storeRef.current = createStore();
  }
  const store = storeRef.current;

  const matrixAtomRef = useRef<PrimitiveAtom<boolean[][]> | undefined>(undefined);
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
      const selectionByCode = new Map(
        nextSelections.map((selection) => [selection.countryCode, selection.selections])
      );
      const nextMatrix = rows.map((row) =>
        selectionColumns.map((column) =>
          Boolean(selectionByCode.get(row.data.country.code)?.[column.id])
        )
      );
      pendingSyncRef.current = true;
      store.set(matrixStateAtom, nextMatrix);
    },
    [matrixStateAtom, rows, selectionColumns, store]
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

  const handleSortToggle = useCallback(
    (kind: 'country' | 'region' | 'column', columnId?: string) => {
      setSortState((prev) => {
        if (prev.kind === kind && prev.columnId === columnId) {
          return { kind, columnId, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
        }
        return { kind, columnId, direction: 'asc' };
      });
    },
    []
  );

  const handleSelectionChange = useCallback(
    (rowIndex: number, colIndex: number, checked: boolean) => {
      const row = rows[rowIndex];
      const column = selectionColumns[colIndex];
      if (!row || !column) return;
      const countryCode = row.data.country.code;
      const next = new Map(selectionMap);
      const existing = next.get(countryCode) ?? {};
      next.set(countryCode, { ...existing, [column.id]: checked });
      const normalized: MatrixSelection[] = countries.map((country) => ({
        countryCode: country.code,
        selections: next.get(country.code) ?? {},
      }));
      setMatrixFromSelections(normalized);
      onSelectionsChange(normalized);
    },
    [countries, onSelectionsChange, rows, selectionColumns, selectionMap, setMatrixFromSelections]
  );

  const handleSelectAllColumn = useCallback(
    (colIndex: number, checked: boolean, enabledRowIndices: number[]) => {
      const column = selectionColumns[colIndex];
      if (!column) return;
      const base = selectAllBatchRef.current?.map ?? new Map(selectionMap);
      enabledRowIndices.forEach((rowIndex) => {
        const row = rows[rowIndex];
        if (!row) return;
        const prev = base.get(row.data.country.code) ?? {};
        base.set(row.data.country.code, { ...prev, [column.id]: checked });
      });
      selectAllBatchRef.current = { map: base };
      if (!selectAllScheduledRef.current) {
        selectAllScheduledRef.current = true;
        queueMicrotask(() => {
          selectAllScheduledRef.current = false;
          const snapshot = selectAllBatchRef.current?.map;
          if (!snapshot) return;
          selectAllBatchRef.current = null;
          const normalized: MatrixSelection[] = countries.map((country) => ({
            countryCode: country.code,
            selections: snapshot.get(country.code) ?? {},
          }));
          setMatrixFromSelections(normalized);
          onSelectionsChange(normalized);
        });
      }
    },
    [countries, onSelectionsChange, rows, selectionColumns, selectionMap, setMatrixFromSelections]
  );

  const handleSelectRow = useCallback(
    (rowIndex: number, checked: boolean, enabledColumnIndices: number[]) => {
      const row = rows[rowIndex];
      if (!row) return;
      const countryCode = row.data.country.code;
      const next = new Map(selectionMap);
      const existing = next.get(countryCode) ?? {};
      const updated = { ...existing };
      enabledColumnIndices.forEach((colIndex) => {
        const column = selectionColumns[colIndex];
        if (!column) return;
        updated[column.id] = checked;
      });
      next.set(countryCode, updated);
      const normalized: MatrixSelection[] = countries.map((country) => ({
        countryCode: country.code,
        selections: next.get(country.code) ?? {},
      }));
      setMatrixFromSelections(normalized);
      onSelectionsChange(normalized);
    },
    [countries, onSelectionsChange, rows, selectionColumns, selectionMap, setMatrixFromSelections]
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
      .map(([letter, value]) => ({
        label: letter,
        count: value.count,
        firstRowId: value.firstRowId,
      }));
  }, [rows]);

  const alphabetIndexSelections = useMemo(() => {
    const selectedByLetter = new Map<string, boolean>();
    rows.forEach((row) => {
      const letter = (row.data.country.name?.[0] ?? '#').toUpperCase();
      const selectionsByColumn = selectionMap.get(row.data.country.code);
      const hasSelection = Boolean(
        selectionsByColumn && Object.values(selectionsByColumn).some(Boolean)
      );
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
    [disabledColumnIdSet, isCellEnabled]
  );

  const getColumnSortDirection = useCallback(
    (colIndex: number) => {
      const column = selectionColumns[colIndex];
      if (!column || sortState.kind !== 'column' || sortState.columnId !== column.id) return 'none';
      return sortState.direction;
    },
    [selectionColumns, sortState]
  );

  const getRowMetaSortDirection = useCallback(
    (metaIndex: number) => {
      if (metaIndex === 0 && sortState.kind === 'region') return sortState.direction;
      if (metaIndex === 1 && sortState.kind === 'country') return sortState.direction;
      return 'none';
    },
    [sortState]
  );

  return {
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
  };
}
