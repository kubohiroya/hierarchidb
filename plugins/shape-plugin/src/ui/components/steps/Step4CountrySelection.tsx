import type React from 'react';
import { useCallback, useMemo } from 'react';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
// import { Check as CheckIcon } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import type { CountryMetadata, StepProps } from '../../../common/shared/index.js';
import { normalizeDataSourceName } from '../../../common/shared/index.js';
import { useCountryMetadata } from '../../../common/hooks/useCountryMetadata.js';
import {
  calculateEstimatedFeatures,
  // calculateEstimatedProcessingTime,
  calculateEstimatedSize,
  DATA_SOURCE_CONFIGS,
  formatBytes,
  formatNumber,
} from '../../../common/mock/data.js';
import { useRef } from 'react';

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
      sx={{ mb: 1, overflowX: 'auto', justifyContent: 'center' }}
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
    countries.forEach((country) => {
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

  const levelHeaderState = useMemo(
    () =>
      Array.from({ length: maxAdminLevel + 1 }, (_, levelIndex) => {
        let availableCount = 0;
        let selectedCount = 0;

        countries.forEach((country, countryIndex) => {
          if (!country.availableAdminLevels.includes(levelIndex)) return;
          availableCount += 1;
          if (checkboxMatrix[countryIndex]?.[levelIndex]) selectedCount += 1;
        });

        return { availableCount, selectedCount };
      }),
    [checkboxMatrix, countries, maxAdminLevel],
  );

  const handleLevelToggle = useCallback(
    (levelIndex: number, checked: boolean) => {
      const clonedMatrix = checkboxMatrix.map((row) => [...row]);
      countries.forEach((country, countryIndex) => {
        if (!country.availableAdminLevels.includes(levelIndex)) return;
        const row = clonedMatrix[countryIndex] ?? Array.from({ length: maxAdminLevel + 1 }, () => false);
        const nextRow = [...row];
        nextRow[levelIndex] = checked;
        clonedMatrix[countryIndex] = nextRow;
      });
      onUpdate({ checkboxState: clonedMatrix });
    },
    [checkboxMatrix, countries, maxAdminLevel, onUpdate],
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

      {/* Simplified Matrix Table (without virtualization for now) */}
      <TableContainer component={Paper} sx={{ flex: 1, overflow: 'auto', maxHeight: '100%' }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell>Country</TableCell>
              {Array.from({ length: maxAdminLevel + 1 }, (_, i) => {
                const header = levelHeaderState[i];
                const available = header?.availableCount ? header.availableCount > 0 : false;
                const allSelected =
                  available && header ? header.selectedCount === header.availableCount : false;
                const partiallySelected =
                  available &&
                  header !== undefined &&
                  header.selectedCount > 0 &&
                  header.selectedCount < header.availableCount;
                return (
                  <TableCell key={i.toString()} align="center">
                    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
                      <Checkbox
                        size="small"
                        checked={allSelected}
                        indeterminate={partiallySelected}
                        disabled={!available || disabled}
                        onChange={(e) => handleLevelToggle(i, e.target.checked)}
                      />
                      <Typography variant="caption">Level {i}</Typography>
                    </Stack>
                  </TableCell>
                );
              })}
            </TableRow>
          </TableHead>
          <TableBody>
            {countries.map((country: CountryMetadata, countryIndex: number) => {
              const letter = country.countryName?.[0]?.toUpperCase() ?? '#';
              const rowKey = country.countryCode || `${letter}-${countryIndex}`;
              return (
                <TableRow
                  key={rowKey}
                  ref={(el) => {
                    if (!rowRefs.current[letter] && el) {
                      rowRefs.current[letter] = el;
                    }
                  }}
                >
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" component="span">
                        {toFlagEmoji(country.countryCode)}
                      </Typography>
                      <Typography variant="body2">
                        {country.countryCode}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {country.countryName}
                      </Typography>
                    </Stack>
                  </TableCell>
                  {Array.from({ length: maxAdminLevel + 1 }, (_, levelIndex) => (
                    <TableCell key={levelIndex.toString()} align="center">
                      {country.availableAdminLevels.includes(levelIndex) ? (
                        <Checkbox
                          checked={
                            checkboxMatrix[countryIndex]?.[levelIndex] || false
                          }
                          onChange={(e) =>
                            handleCellChange(
                              countryIndex,
                              levelIndex,
                              e.target.checked,
                            )
                          }
                          disabled={disabled}
                          size="small"
                        />
                      ) : (
                        <Typography variant="caption" color="text.disabled">
                          -
                        </Typography>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

    </Box>
  );
};
