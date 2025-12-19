import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';
import type { CountryRecord } from '@hierarchidb/gen-iso3166-2';
import type { SelectionMatrixColumn, SelectionMatrixRow } from '@hierarchidb/components';
import type { LocationEntity, LocationType } from '../../../common/types/index.js';
import { useTranslation } from '../../../common/i18n/index.js';
import { useIsoCountries } from '../hooks/useIsoCountries.js';
import { BASE_LOCATION_TYPES, resolveTypesForSource } from './locationTypes.js';

export type RowData = CountryRecord & { sourceIndex: number };
export type LocationRow = SelectionMatrixRow<RowData>;

const normalizeMatrix = (
  matrix: boolean[][] | undefined,
  rows: SelectionMatrixRow[],
  types: typeof BASE_LOCATION_TYPES,
): boolean[][] => {
  const safe = matrix ?? [];
  return rows.map((_, rowIndex) => {
    const row = safe[rowIndex] ?? [];
    return types.map((__, columnIndex) => Boolean(row[columnIndex]));
  });
};

const toFlagEmoji = (alpha2: string | undefined): string => {
  if (!alpha2 || alpha2.length !== 2) return '🏳️';
  const codePoints = [...alpha2.toUpperCase()].map((char) => 0x1F1E6 - 65 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

const deepEqualMatrix = (a: boolean[][], b: boolean[][]): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const rowA = a[i] ?? [];
    const rowB = b[i] ?? [];
    if (rowA.length !== rowB.length) return false;
    for (let j = 0; j < rowA.length; j += 1) {
      if (rowA[j] !== rowB[j]) return false;
    }
  }
  return true;
};

interface UseLocationSelectionParams {
  draft: Partial<LocationEntity>;
  onUpdate: (updates: Partial<LocationEntity>) => void;
}

export function useLocationSelection({
  draft,
  onUpdate,
}: UseLocationSelectionParams) {
  const { translations, t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const iso = useIsoCountries();
  const selectionTranslations = translations.selection ?? {};
  const virtuosoRef = useRef<any>(null);
  const [search, setSearch] = useState('');
  const [sortState, setSortState] = useState<{ kind: 'country' | 'region' | 'type'; typeId?: LocationType; direction: 'asc' | 'desc' }>({
    kind: 'country',
    direction: 'asc',
  });

  const columns = useMemo<SelectionMatrixColumn[]>(() => {
    const typeLabels = translations.locationTypes ?? {};
    const descriptions = selectionTranslations.typeDescriptions ?? {};
    return BASE_LOCATION_TYPES.map((t) => {
      const name = typeLabels[t.id] ?? t.id;
      const descriptionKey = t.id as keyof typeof descriptions;
      return {
        id: t.id,
        label: `${t.icon} ${name}`,
        description: descriptions[descriptionKey] ?? name,
      };
    });
  }, [selectionTranslations.typeDescriptions, translations.locationTypes]);

  const selectionMatrixSource = useMemo(() => draft.selectionMatrix ?? [], [draft.selectionMatrix]);

  const baseRows = useMemo<LocationRow[]>(() => {
    if (iso.status !== 'ready') return [];
    const sorted = [...iso.countries].sort((a, b) => a.alpha2.localeCompare(b.alpha2));
    return sorted.map((country, index) => ({
      id: country.alpha2,
      label: country.countryEn,
      subLabel: country.location,
      data: { ...country, sourceIndex: index },
    }));
  }, [iso]);

  const selectionMatrix = useMemo(
    () => normalizeMatrix(selectionMatrixSource, baseRows, BASE_LOCATION_TYPES),
    [selectionMatrixSource, baseRows],
  );

  const allowedTypes = useMemo<LocationType[]>(() => {
    const source = draft.dataSource ?? '';
    return resolveTypesForSource(source);
  }, [draft.dataSource]);
  const allowedTypeSet = useMemo(() => new Set(allowedTypes), [allowedTypes]);

  useEffect(() => {
    if (baseRows.length === 0) return;
    const next = selectionMatrix.map((row) => {
      const safeRow = row ?? [];
      return BASE_LOCATION_TYPES.map((type, colIdx) =>
        allowedTypeSet.has(type.id) ? Boolean(safeRow[colIdx]) : false,
      );
    });
    const soleType = allowedTypes.length === 1 ? allowedTypes[0] : null;
    if (soleType) {
      const soleIndex = BASE_LOCATION_TYPES.findIndex((t) => t.id === soleType);
      if (soleIndex >= 0) {
        next.forEach((row) => {
          row[soleIndex] = true;
        });
      }
    }
    if (!deepEqualMatrix(selectionMatrix, next)) {
      onUpdate({ selectionMatrix: next });
    }
  }, [allowedTypeSet, allowedTypes, onUpdate, baseRows.length, selectionMatrix]);

  const handleChange = useCallback(
    (viewRowIndex: number, colIndex: number, checked: boolean, viewRows: LocationRow[]) => {
      const baseIndex = viewRows[viewRowIndex]?.data?.sourceIndex ?? viewRowIndex;
      const next = selectionMatrix.map((row, rIdx) =>
        row.map((cell, cIdx) => (rIdx === baseIndex && cIdx === colIndex ? checked : cell)),
      );
      const count = next.flat().filter(Boolean).length;
      enqueueSnackbar(`${t('selection.selectedCount', 'Selected')}: ${count}`, { variant: 'info' });
      onUpdate({ selectionMatrix: next });
    },
    [enqueueSnackbar, onUpdate, selectionMatrix, t],
  );

  const handleSelectAllColumn = useCallback(
    (_colIndex: number, checked: boolean, enabledRowIndices: number[], viewRows: LocationRow[]) => {
      const next = selectionMatrix.map((row) => [...row]);
      enabledRowIndices.forEach((viewRowIdx) => {
        const baseIndex = viewRows[viewRowIdx]?.data?.sourceIndex ?? viewRowIdx;
        const targetRow = next[baseIndex] ?? [];
        next[baseIndex] = targetRow.map((cell, cIdx) => (cIdx === _colIndex ? checked : cell));
      });
      const count = next.flat().filter(Boolean).length;
      enqueueSnackbar(`${t('selection.selectedCount', 'Selected')}: ${count}`, { variant: 'info' });
      onUpdate({ selectionMatrix: next });
    },
    [enqueueSnackbar, onUpdate, selectionMatrix, t],
  );

  const filteredSorted = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const filtered: LocationRow[] = baseRows
      .map((row, idx) => ({
        ...row,
        data: { ...row.data, sourceIndex: row.data?.sourceIndex ?? idx },
      }))
      .filter((row) => {
        if (!keyword) return true;
        return row.label.toLowerCase().includes(keyword)
          || row.subLabel?.toLowerCase().includes(keyword)
          || (row.id?.toLowerCase?.() ?? '').includes(keyword);
      });

    const compareBy = (a: string, b: string, dir: 'asc' | 'desc') => (dir === 'asc' ? a.localeCompare(b) : b.localeCompare(a));
    if (sortState.kind === 'country') {
      filtered.sort((a, b) => compareBy(a.label, b.label, sortState.direction));
    } else if (sortState.kind === 'region') {
      filtered.sort((a, b) => compareBy(a.subLabel ?? '', b.subLabel ?? '', sortState.direction));
    } else if (sortState.kind === 'type' && sortState.typeId) {
      const colIdx = BASE_LOCATION_TYPES.findIndex((t) => t.id === sortState.typeId);
      filtered.sort((a, b) => {
        const selA = Boolean(selectionMatrix[a.data.sourceIndex]?.[colIdx]);
        const selB = Boolean(selectionMatrix[b.data.sourceIndex]?.[colIdx]);
        if (selA === selB) return a.label.localeCompare(b.label);
        return sortState.direction === 'desc' ? Number(selB) - Number(selA) : Number(selA) - Number(selB);
      });
    }
    const sortedMatrix = filtered.map((row) => selectionMatrix[row.data.sourceIndex] ?? []);
    return { rows: filtered, matrix: sortedMatrix };
  }, [baseRows, search, sortState, selectionMatrix]);

  const alphabeticalIndex = useMemo(() => {
    const groups: Record<string, { count: number; firstRowId: string }> = {};
    filteredSorted.rows.forEach((row) => {
      const letter = (row.label?.[0] ?? '#').toUpperCase();
      if (!groups[letter]) {
        groups[letter] = { count: 0, firstRowId: row.id };
      }
      groups[letter].count += 1;
    });
    return Object.entries(groups)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([letter, value]) => ({ label: letter, count: value.count, firstRowId: value.firstRowId }));
  }, [filteredSorted.rows]);

  const regionIndex = useMemo(() => {
    const groups: Record<string, { count: number; firstRowId: string }> = {};
    filteredSorted.rows.forEach((row) => {
      const region = (row.subLabel ?? '-').toString();
      if (!groups[region]) {
        groups[region] = { count: 0, firstRowId: row.id };
      }
      groups[region].count += 1;
    });
    return Object.entries(groups)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([region, value]) => ({ label: region, count: value.count, firstRowId: value.firstRowId }));
  }, [filteredSorted.rows]);

  const selectedIndexByType = useMemo(() => {
    const result = Object.fromEntries(
      BASE_LOCATION_TYPES.map((t) => [t.id, { selected: 0, unselected: 0 }]),
    ) as Record<LocationType, { selected: number; unselected: number }>;
    filteredSorted.rows.forEach((row) => {
      const rowState = selectionMatrix[row.data.sourceIndex] ?? [];
      BASE_LOCATION_TYPES.forEach((type, colIdx) => {
        const checked = Boolean(rowState[colIdx]);
        if (checked) result[type.id].selected += 1;
        else result[type.id].unselected += 1;
      });
    });
    return result;
  }, [filteredSorted.rows, selectionMatrix]);

  const handleSortToggle = useCallback((kind: 'country' | 'region' | 'type', typeId?: LocationType) => {
    setSortState((prev) => {
      if (prev.kind === kind && prev.typeId === typeId) {
        return { kind, typeId, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { kind, typeId, direction: 'asc' };
    });
  }, []);

  const boundOnChange = useCallback(
    (rowIndex: number, colIndex: number, checked: boolean) =>
      handleChange(rowIndex, colIndex, checked, filteredSorted.rows),
    [filteredSorted.rows, handleChange],
  );

  const boundOnSelectAll = useCallback(
    (colIndex: number, checked: boolean, enabledRowIndices: number[]) =>
      handleSelectAllColumn(colIndex, checked, enabledRowIndices, filteredSorted.rows),
    [filteredSorted.rows, handleSelectAllColumn],
  );

  const isCellEnabled = useCallback(
    (_row: LocationRow, column: SelectionMatrixColumn) => allowedTypeSet.has(column.id as LocationType),
    [allowedTypeSet],
  );

  const resolvedRowMetaColumns = useMemo(() => [
    {
      header: selectionTranslations.regionHeader ?? t('selection.regionHeader', 'Region'),
      render: (row: SelectionMatrixRow) => {
        const country = row.data as RowData | undefined;
        return (
          <Typography variant="body2" color="text.secondary">
            {country?.location ?? row.subLabel ?? '-'}
          </Typography>
        );
      },
      width: 180,
    },
    {
      header: selectionTranslations.countryHeader ?? t('selection.countryHeader', 'Country'),
      render: (row: SelectionMatrixRow) => {
        const country = row.data as RowData | undefined;
        const flag = country?.alpha2 ? toFlagEmoji(country.alpha2) : '🏳️';
        return (
          <Box display="flex" alignItems="center" gap={1.25}>
            <Typography component="span" fontSize="1.1rem" aria-label={country?.countryEn ?? row.label}>
              {flag}
            </Typography>
            <Box>
              <Typography variant="body2">
                {country?.countryEn ?? row.label}
              </Typography>
              {country?.alpha3 && (
                <Typography variant="caption" color="text.secondary">
                  {country.alpha3}
                </Typography>
              )}
            </Box>
          </Box>
        );
      },
      width: 220,
    },
  ], [selectionTranslations.countryHeader, selectionTranslations.regionHeader, t]);

  return {
    isoStatus: iso.status,
    isoError: iso.status === 'error' ? iso.message : null,
    isEmpty: baseRows.length === 0,
    translations,
    search,
    setSearch,
    sortState,
    handleSortToggle,
    columns,
    rowMetaColumns: resolvedRowMetaColumns,
    matrixRows: filteredSorted.rows,
    matrixState: filteredSorted.matrix,
    isCellEnabled,
    onChange: boundOnChange,
    onSelectAll: boundOnSelectAll,
    onColumnHeaderClick: (colIndex: number) => {
      const col = columns[colIndex];
      if (!col) return;
      handleSortToggle('type', col.id as LocationType);
    },
    onRowMetaHeaderClick: (metaIndex: number) => handleSortToggle(metaIndex === 0 ? 'region' : 'country'),
    getColumnSortDirection: (colIndex: number) => {
      if (sortState.kind !== 'type') return 'none';
      const col = columns[colIndex];
      if (!col || col.id !== sortState.typeId) return 'none';
      return sortState.direction;
    },
    getRowMetaSortDirection: (metaIndex: number) => {
      if (metaIndex === 0 && sortState.kind === 'region') return sortState.direction;
      if (metaIndex === 1 && sortState.kind === 'country') return sortState.direction;
      return 'none';
    },
    alphabeticalIndex,
    regionIndex,
    selectedIndexByType,
    virtuosoRef,
  };
}
