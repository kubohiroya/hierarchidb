import type React from 'react';
import { useCallback, useMemo } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
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
import { Check as CheckIcon } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import type { CountryMetadata, StepProps } from '../../../common/shared/index.js';
import { normalizeDataSourceName } from '../../../common/shared/index.js';
import { useCountryMetadata } from '../../../common/hooks/useCountryMetadata.js';
import {
  calculateEstimatedFeatures,
  calculateEstimatedProcessingTime,
  calculateEstimatedSize,
  DATA_SOURCE_CONFIGS,
  formatBytes,
  formatNumber,
} from '../../../common/mock/data.js';

/**
 * Step 5: Country & Admin Level Selection
 * Uses real country metadata from @hierarchidb/fetch-save-metadata
 */
export const Step5CountrySelection: React.FC<StepProps> = ({ draft, onUpdate, disabled }) => {
  const draftData = draft ?? {};
  const { enqueueSnackbar } = useSnackbar();

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
    },
    [checkboxMatrix, onUpdate],
  );

  const handleValidateSelection = useCallback(() => {
    enqueueSnackbar(
      `${stats.totalSelected} selections validated. Est. size: ${formatBytes(stats.estimatedSize)}, processing time: ${stats.estimatedTime}`,
      { variant: 'success' },
    );
  }, [stats, enqueueSnackbar]);

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
      <Box sx={{ height: '70vh', display: 'flex', flexDirection: 'column' }}>
        <Alert severity="error">
          Failed to load country metadata: {error.message}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '70vh', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h6" gutterBottom>
        Select Countries & Administrative Levels
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Select countries and their administrative levels to download. Use the
        matrix to make precise selections.
      </Typography>

      {/* Statistics Panel */}
      <Paper sx={{ p: 2, mb: 2, backgroundColor: 'grey.50' }}>
        <Stack direction="row" spacing={4} alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              label={`${stats.countriesWithSelection} countries`}
              size="small"
              color="primary"
              variant="outlined"
            />
            <Chip
              label={`${stats.totalSelected} selections`}
              size="small"
              color="secondary"
              variant="outlined"
            />
          </Stack>

          <Stack direction="row" spacing={1}>
            {stats.levelCounts.map(
              (count, level) =>
                count > 0 && (
                  <Chip
                    key={level}
                    label={`L${level}: ${count}`}
                    size="small"
                    variant="outlined"
                  />
                ),
            )}
          </Stack>

          <Stack direction="row" spacing={2} sx={{ ml: 'auto' }}>
            <Typography variant="caption" color="text.secondary">
              Est. Size: {formatBytes(stats.estimatedSize)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Est. Features: {formatNumber(stats.estimatedFeatures)}
            </Typography>

            <Button
              variant="outlined"
              size="small"
              startIcon={<CheckIcon />}
              onClick={handleValidateSelection}
              disabled={stats.totalSelected === 0 || disabled}
            >
              Validate
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Simplified Matrix Table (without virtualization for now) */}
      <TableContainer component={Paper} sx={{ flex: 1, overflow: 'auto' }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell>Country</TableCell>
              {Array.from({ length: maxAdminLevel + 1 }, (_, i) => (
                <TableCell key={i} align="center">
                  Level {i}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {countries.map((country: CountryMetadata, countryIndex: number) => (
              <TableRow key={country.countryCode}>
                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2">
                      {country.countryCode}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {country.countryName}
                    </Typography>
                  </Stack>
                </TableCell>
                {Array.from({ length: maxAdminLevel + 1 }, (_, levelIndex) => (
                  <TableCell key={levelIndex} align="center">
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
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {stats.totalSelected === 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Please select at least one country and administrative level to
          proceed.
        </Alert>
      )}
    </Box>
  );
};
