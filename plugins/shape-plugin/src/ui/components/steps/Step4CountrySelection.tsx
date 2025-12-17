import type React from 'react';
import { useCallback, useMemo } from 'react';
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';
import type { CountryMetadata, StepProps } from '../../../common/types/index.js';
import { normalizeDataSourceName } from '../../../services/utils/utils.js';
import { useCountryMetadata } from '../../hooks/useCountryMetadata.js';
import {
  calculateEstimatedFeatures,
  calculateEstimatedSize,
  // calculateEstimatedProcessingTime,
  DATA_SOURCE_CONFIGS,
  formatBytes,
  formatNumber,
} from '../../../common/mock/data.js';
import { useRef } from 'react';
import {
  SelectionMatrix,
  type SelectionMatrixColumn,
  type SelectionMatrixRow,
} from '@hierarchidb/components';

/**
 * Step 5: Country & Admin Level Selection
 * Uses real country metadata from @hierarchidb/fetch-save-metadata
 */
type AlphabeticalIndexProps = {
  letters: string[];
  onSelect: (letter: string) => void;
};

const AlphabeticalIndex: React.FC<AlphabeticalIndexProps> = ({ letters, onSelect }) => {
  if (!letters.length) return null;
  return (
    <Stack
      direction="row"
      spacing={0.5}
      flexWrap="nowrap"
      sx={{ mb: 1, overflowX: 'auto', justifyContent: 'center', flexShrink: 0, py: 0.5 }}
    >
      {letters.map((letter) => (
        <Button
          key={letter}
          size="small"
          variant="outlined"
          sx={{ minWidth: 32, px: 1, py: 0.25, flexShrink: 0 }}
          onClick={() => onSelect(letter)}
        >
          {letter}
        </Button>
      ))}
    </Stack>
  );
};

export const Step4CountrySelection: React.FC<StepProps> = ({ draft, onUpdate, disabled }) => {
  const draftData = draft ?? {};
  const { enqueueSnackbar } = useSnackbar();
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  // Load country metadata from 02-fetch-save-metadata
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

  const alphaIndex = useMemo(() => {
    const letters = new Set<string>();
    countries.forEach((country: CountryMetadata) => {
      const letter = country.countryName?.[0]?.toUpperCase() ?? '#';
      letters.add(letter);
    });
    return Array.from(letters).sort();
  }, [countries]);

  const scrollToLetter = useCallback((letter: string) => {
    const target = rowRefs.current[letter];
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const toFlagEmoji = useCallback((code?: string) => {
    if (!code || code.length < 2) return '🏳️';
    const iso2 = code.slice(0, 2).toUpperCase();
    const codePoints = Array.from(iso2).map((c) => 0x1f1e6 - 65 + c.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  }, []);

  // Initialize checkbox matrix
  const checkboxMatrix = useMemo<boolean[][]>(() => {
    if (Array.isArray(draftData.checkboxState)) {
      return (draftData.checkboxState as unknown[]).map((row: unknown): boolean[] => {
        if (!Array.isArray(row)) {
          return Array.from({ length: maxAdminLevel + 1 }, () => false);
        }
        return Array.from({ length: maxAdminLevel + 1 }, (_, idx) => Boolean((row as unknown[])[idx]));
      });
    }
    // Initialize empty matrix based on loaded countries
    return countries.map(() => Array.from({ length: maxAdminLevel + 1 }, () => false));
  }, [draftData.checkboxState, countries, maxAdminLevel]);

  /*
  // Calculate statistics
  const stats = useMemo(() => {
    let totalSelected = 0;
    let countriesWithSelection = 0;
    const levelCounts = Array(maxAdminLevel + 1).fill(0);

    checkboxMatrix.forEach((row: boolean[]) => {
      let hasAnySelection = false;
      row.forEach((selected: boolean, levelIndex: number) => {
        if (selected && levelIndex <= maxAdminLevel) {
          totalSelected++;
          levelCounts[levelIndex]++;
          hasAnySelection = true;
        }
      });
      if (hasAnySelection) {
        countriesWithSelection++;
      }
    });

    return {
      totalSelected,
      countriesWithSelection,
      levelCounts,
      estimatedSize: calculateEstimatedSize(totalSelected),
      estimatedFeatures: calculateEstimatedFeatures(
        totalSelected,
        countries,
      ),
      estimatedTime: calculateEstimatedProcessingTime(totalSelected),
    };
  }, [checkboxMatrix, countries, maxAdminLevel]);

   */

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
        { variant: 'info' },
      );
    },
    [checkboxMatrix, onUpdate, maxAdminLevel, countries, enqueueSnackbar],
  );

  const matrixState = useMemo<boolean[][]>(() => {
    return countries.map((_, countryIndex) => {
      const row = checkboxMatrix[countryIndex] ?? Array.from({ length: maxAdminLevel + 1 }, () => false);
      return Array.from({ length: maxAdminLevel + 1 }, (_, levelIndex) => Boolean(row[levelIndex]));
    });
  }, [checkboxMatrix, countries, maxAdminLevel]);

  const columns = useMemo<SelectionMatrixColumn[]>(() =>
    Array.from({ length: maxAdminLevel + 1 }, (_, levelIndex) => ({
      id: `level-${levelIndex}`,
      label: `Level ${levelIndex}`,
      description: `Admin level ${levelIndex}`,
    })),
  [maxAdminLevel]);

  const rows = useMemo<SelectionMatrixRow<CountryMetadata>[]>(() =>
    countries.map((country, countryIndex) => ({
      id: country.countryCode || `country-${countryIndex}`,
      label: country.countryCode ?? country.countryName ?? `#${countryIndex}`,
      subLabel: country.countryName,
      data: country,
      tooltip: country.countryName,
      disabled,
    })),
  [countries, disabled]);

  const isCellEnabled = useCallback(
    (row: SelectionMatrixRow<CountryMetadata>, _column: SelectionMatrixColumn, _rowIndex: number, colIndex: number) => {
      const available = row.data?.availableAdminLevels ?? [];
      return available.includes(colIndex);
    },
    [],
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
    [checkboxMatrix, maxAdminLevel, onUpdate],
  );

  /*
  const handleValidateSelection = useCallback(() => {
    enqueueSnackbar(
      `${stats.totalSelected} selections validated. Est. size: ${formatBytes(stats.estimatedSize)}, processing time: ${stats.estimatedTime}`,
      { variant: 'success' },
    );
  }, [stats, enqueueSnackbar]);
   */

  // Show loading state
  if (loading) {
    return (
      <Box sx={{ height: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading country metadata...</Typography>
      </Box>
    );
  }

  // Show error state
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
          Select countries and their administrative levels to download. Use the
          matrix to make precise selections.
        </Typography>

      <AlphabeticalIndex letters={alphaIndex} onSelect={scrollToLetter} />

      <SelectionMatrix
        rows={rows.map((row) => ({
          ...row,
          label: `${toFlagEmoji(row.data?.countryCode)} ${row.label}`,
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
