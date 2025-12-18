import type React from 'react';
import { useCallback, useMemo, useRef } from 'react';
import { useSnackbar } from 'notistack';
import { Box, CircularProgress, Typography } from '@mui/material';
import type { CountryMetadata, StepProps } from '../../../common/types/index.js';
import { useCountryMetadata } from '../../hooks/useCountryMetadata.js';
import { calculateEstimatedFeatures, calculateEstimatedSize, DATA_SOURCE_CONFIGS, formatBytes, formatNumber } from '../../../common/mock/data.js';
import { normalizeDataSourceName } from '../../../services/utils/utils.js';
import type { NodeId } from '@hierarchidb/common-types';
import type { ShapeEntity } from '../../../common/types/index.js';
import { SelectionMatrix, type SelectionMatrixRow, type SelectionMatrixColumn } from '@hierarchidb/components';

type ShapeDialogStepProps = StepProps;

export const ShapeCountrySelectionStep: React.FC<ShapeDialogStepProps> = ({ draft, onUpdate, disabled }) => {
  const { enqueueSnackbar } = useSnackbar();
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const draftData = draft ?? {};
  const dataSourceKey = normalizeDataSourceName(draftData.dataSourceName) ?? 'gadm';

  const {
    metadata: countries,
    loading,
    error,
  } = useCountryMetadata({
    dataSource: dataSourceKey,
  });

  const dataSourceConfig = DATA_SOURCE_CONFIGS[dataSourceKey];
  const maxAdminLevel = dataSourceConfig?.maxAdminLevel ?? 0;

  const checkboxMatrix = useMemo<boolean[][]>(() => {
    if (Array.isArray(draftData.checkboxState)) {
      return (draftData.checkboxState as unknown[]).map((row: unknown): boolean[] => {
        if (!Array.isArray(row)) {
          return Array.from({ length: maxAdminLevel + 1 }, () => false);
        }
        return Array.from({ length: maxAdminLevel + 1 }, (_, idx) => Boolean((row as unknown[])[idx]));
      });
    }
    return countries.map(() => Array.from({ length: maxAdminLevel + 1 }, () => false));
  }, [draftData.checkboxState, countries, maxAdminLevel]);

  const matrixState = useMemo<boolean[][]>(() => {
    return countries.map((_, countryIndex) => {
      const row = checkboxMatrix[countryIndex] ?? Array.from({ length: maxAdminLevel + 1 }, () => false);
      return Array.from({ length: maxAdminLevel + 1 }, (_, levelIndex) => Boolean(row[levelIndex]));
    });
  }, [checkboxMatrix, countries, maxAdminLevel]);

  const columns: SelectionMatrixColumn[] = useMemo(
    () =>
      Array.from({ length: maxAdminLevel + 1 }, (_, levelIndex) => ({
        id: `level-${levelIndex}`,
        label: `Level ${levelIndex}`,
        description: `Admin level ${levelIndex}`,
      })),
    [maxAdminLevel]
  );

  const rows: SelectionMatrixRow<CountryMetadata>[] = useMemo(
    () =>
      countries.map((country, countryIndex) => ({
        id: country.countryCode || `country-${countryIndex}`,
        label: country.countryCode ?? country.countryName ?? `#${countryIndex}`,
        subLabel: country.countryName ?? '',
        data: country,
        tooltip: country.countryName,
        disabled,
      })),
    [countries, disabled]
  );

  const isCellEnabled = useCallback(
    (row: SelectionMatrixRow<CountryMetadata>, _column: SelectionMatrixColumn, _rowIndex: number, colIndex: number) => {
      const available = row.data?.availableAdminLevels ?? [];
      return available.includes(colIndex);
    },
    []
  );

  const handleSelectAllColumn = useCallback(
    (colIndex: number, checked: boolean, enabledRowIndices: number[]) => {
      const clonedMatrix = checkboxMatrix.map((row) => [...row]);
      enabledRowIndices.forEach((rowIndex) => {
        const row = clonedMatrix[rowIndex] ?? Array.from({ length: maxAdminLevel + 1 }, () => false);
        row[colIndex] = checked;
        clonedMatrix[rowIndex] = row;
      });
      onUpdate({ checkboxState: clonedMatrix });
    },
    [checkboxMatrix, maxAdminLevel, onUpdate]
  );

  const handleCellChange = useCallback(
    (countryIndex: number, levelIndex: number, checked: boolean) => {
      const clonedMatrix = checkboxMatrix.map((row) => [...row]);
      const row = clonedMatrix[countryIndex];
      if (!row || levelIndex < 0 || levelIndex >= row.length) {
        return;
      }
      const nextRow = [...row];
      nextRow[levelIndex] = checked;
      clonedMatrix[countryIndex] = nextRow;
      onUpdate({
        checkboxState: clonedMatrix,
      });

      const nextStats = (() => {
        let totalSelected = 0;
        let countriesWithSelection = 0;

        clonedMatrix.forEach((r: boolean[]) => {
          let hasAny = false;
          r.forEach((val: boolean, idx: number) => {
            if (val && idx <= maxAdminLevel) {
              totalSelected += 1;
              hasAny = true;
            }
          });
          if (hasAny) countriesWithSelection += 1;
        });

        return {
          totalSelected,
          countriesWithSelection,
          estimatedSize: calculateEstimatedSize(totalSelected),
          estimatedFeatures: calculateEstimatedFeatures(totalSelected, countries),
        };
      })();

      enqueueSnackbar(
        `${nextStats.countriesWithSelection} countries / ${nextStats.totalSelected} selections — Est. Size: ${formatBytes(nextStats.estimatedSize)}, Est. Features: ${formatNumber(nextStats.estimatedFeatures)}`,
        { variant: 'info' }
      );
    },
    [checkboxMatrix, onUpdate, maxAdminLevel, countries, enqueueSnackbar]
  );

  if (loading) {
    return (
      <Box sx={{ height: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading country metadata...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ height: '70vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', p: 3 }}>
        <Typography color="error" variant="body2">
          Failed to load country metadata: {error.message}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h6" gutterBottom>
        Select Countries & Administrative Levels
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Select countries and their administrative levels to download. Use the matrix to make precise selections.
      </Typography>

      <SelectionMatrix
        rows={rows.map((row, idx) => ({
          ...row,
          label: `${row.label}`,
        }))}
        columns={columns}
        state={matrixState}
        onChange={(rowIndex, colIndex, checked) => handleCellChange(rowIndex, colIndex, checked)}
        onSelectAll={handleSelectAllColumn}
        rowHeaderLabel="Country"
        showSelectionCount
        stickyHeader
        dense
        isCellEnabled={isCellEnabled}
        getRowProps={(row) => {
          const letter = row.data?.countryName?.[0]?.toUpperCase() ?? '#';
          return {
            ref: (el: HTMLTableRowElement | null) => {
              if (!rowRefs.current[letter] && el) {
                rowRefs.current[letter] = el;
              }
            },
            'data-letter': letter,
          } as React.HTMLAttributes<HTMLTableRowElement>;
        }}
      />
    </Box>
  );
};
