import React, { useMemo, useCallback } from "react";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Chip,
  Stack,
  Button,
  Alert,
  CircularProgress,
} from "@mui/material";
import { Check as CheckIcon } from "@mui/icons-material";
import { useSnackbar } from "notistack";
import type { StepProps } from "~/types";
import { useCountryMetadata } from "~/hooks/useCountryMetadata";
import {
  DATA_SOURCE_CONFIGS,
  formatBytes,
  formatNumber,
  calculateEstimatedSize,
  calculateEstimatedFeatures,
  calculateEstimatedProcessingTime,
} from "~/mock/data";

/**
 * Step 5: Country & Admin Level Selection
 * Uses real country metadata from @hierarchidb/02-fetch-metadata
 */
export const Step5CountrySelection: React.FC<StepProps> = ({
  workingCopy,
  onUpdate,
  disabled,
}) => {
  const { enqueueSnackbar } = useSnackbar();
  
  // Load country metadata from 02-fetch-metadata
  const { 
    metadata: countries, 
    loading, 
    error,
    getCountryName,
    getCountryByCode 
  } = useCountryMetadata({
    dataSource: workingCopy.dataSourceName || 'GADM',
  });

  const dataSourceConfig = DATA_SOURCE_CONFIGS[workingCopy.dataSourceName];
  const maxAdminLevel = dataSourceConfig?.maxAdminLevel || 0;

  // Initialize checkbox matrix
  const checkboxMatrix = useMemo(() => {
    if (Array.isArray(workingCopy.checkboxState)) {
      return workingCopy.checkboxState;
    }
    // Initialize empty matrix based on loaded countries
    return countries.map(() => Array(maxAdminLevel + 1).fill(false));
  }, [workingCopy.checkboxState, countries, maxAdminLevel]);

  // Calculate statistics
  const stats = useMemo(() => {
    let totalSelected = 0;
    let countriesWithSelection = 0;
    const levelCounts = Array(maxAdminLevel + 1).fill(0);

    checkboxMatrix.forEach((row) => {
      let hasAnySelection = false;
      row.forEach((selected, levelIndex) => {
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
  }, [checkboxMatrix, maxAdminLevel]);

  const handleCellChange = useCallback(
    (countryIndex: number, levelIndex: number, checked: boolean) => {
      const newMatrix = [...checkboxMatrix];
      newMatrix[countryIndex] = [...newMatrix[countryIndex]];
      newMatrix[countryIndex][levelIndex] = checked;

      onUpdate({
        checkboxState: newMatrix,
        selectedCountries: getSelectedCountries(newMatrix),
        adminLevels: getSelectedLevels(newMatrix),
      });
    },
    [checkboxMatrix, onUpdate],
  );

  const handleValidateSelection = useCallback(() => {
    enqueueSnackbar(
      `${stats.totalSelected} selections validated. Est. size: ${formatBytes(stats.estimatedSize)}, processing time: ${stats.estimatedTime}`,
      { variant: "success" },
    );
  }, [stats, enqueueSnackbar]);

  const getSelectedCountries = (matrix: boolean[][]) => {
    const selectedCountries: string[] = [];
    matrix.forEach((row, index) => {
      if (row.some((selected) => selected) && countries[index]) {
        selectedCountries.push(countries[index].countryCode);
      }
    });
    return selectedCountries;
  };

  const getSelectedLevels = (matrix: boolean[][]) => {
    const levels = new Set<number>();
    matrix.forEach((row) => {
      row.forEach((selected, levelIndex) => {
        if (selected) levels.add(levelIndex);
      });
    });
    return Array.from(levels);
  };

  // Show loading state
  if (loading) {
    return (
      <Box sx={{ height: "70vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading country metadata...</Typography>
      </Box>
    );
  }

  // Show error state
  if (error) {
    return (
      <Box sx={{ height: "70vh", display: "flex", flexDirection: "column" }}>
        <Alert severity="error">
          Failed to load country metadata: {error.message}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ height: "70vh", display: "flex", flexDirection: "column" }}>
      <Typography variant="h6" gutterBottom>
        Select Countries & Administrative Levels
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Select countries and their administrative levels to download. Use the
        matrix to make precise selections.
      </Typography>

      {/* Statistics Panel */}
      <Paper sx={{ p: 2, mb: 2, backgroundColor: "grey.50" }}>
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

          <Stack direction="row" spacing={2} sx={{ ml: "auto" }}>
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
      <TableContainer component={Paper} sx={{ flex: 1, overflow: "auto" }}>
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
            {countries.map((country, countryIndex) => (
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
