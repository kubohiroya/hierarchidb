import type React from 'react';
import { useCallback, useMemo } from 'react';
import { useSnackbar } from 'notistack';
import { Alert, Box, CircularProgress, Typography } from '@mui/material';
import type { CountryMetadata } from '../../../common/types/index.js';
import { useCountryMetadata } from '../../hooks/useCountryMetadata.js';
import { calculateEstimatedFeatures, calculateEstimatedSize, DATA_SOURCE_CONFIGS, formatBytes, formatNumber } from '../../../common/mock/data.js';
import { normalizeDataSourceName } from '../../../services/utils/utils.js';
import { CountryMatrixSelector, useIsoCountries, type MatrixConfig, type MatrixSelection, type ContinentCode } from '@hierarchidb/ui-country-select';
import { ShapeDialogStepProps } from './ShapeDialogStepProps.ts';

//type ShapeDialogStepProps = StepProps;

const CONTINENT_CODES: ContinentCode[] = ['AF', 'AS', 'EU', 'NA', 'SA', 'OC', 'AN'];

const CONTINENT_ALIASES: Record<string, ContinentCode> = {
  'africa': 'AF',
  'af': 'AF',
  'asia': 'AS',
  'as': 'AS',
  'europe': 'EU',
  'eu': 'EU',
  'north america': 'NA',
  'na': 'NA',
  'south america': 'SA',
  'sa': 'SA',
  'central america': 'NA',
  'oceania': 'OC',
  'australia': 'OC',
  'oc': 'OC',
  'antarctica': 'AN',
  'an': 'AN',
};

const isContinentCode = (value: string): value is ContinentCode => CONTINENT_CODES.includes(value as ContinentCode);

const normalizeContinentCode = (continent?: string): ContinentCode | undefined => {
  if (!continent) return undefined;
  const trimmed = continent.trim();
  if (!trimmed) return undefined;
  const alias = CONTINENT_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;
  const upper = trimmed.toUpperCase();
  if (isContinentCode(upper)) return upper;
  return undefined;
};

const normalizeCountryCodeFromMetadata = (country: Partial<CountryMetadata>, index: number): string => {
  const candidates = [country.countryCode, country.iso2, country.iso3].filter(
    (value): value is string => Boolean(value && value.trim()),
  );
  const primary = (candidates[0] ?? `country-${index}`).trim().toUpperCase();
  if (primary.length === 2) return primary;
  if (primary.length === 3 && country.iso2) return country.iso2.trim().toUpperCase();
  if (primary.length === 3) return primary.slice(0, 2);
  return primary.slice(0, 2) || `COUNTRY-${index}`;
};

export const ShapeCountrySelectionStep: React.FC<ShapeDialogStepProps> = ({ data, onChange, }) => {
  const { enqueueSnackbar } = useSnackbar();
  const draftData = data ?? {};
  const dataSourceKey = normalizeDataSourceName(draftData.dataSourceName) ?? 'gadm';
  const iso = useIsoCountries();

  const {
    metadata: countries,
    loading,
    error,
  } = useCountryMetadata({
    dataSource: dataSourceKey,
  });

  const dataSourceConfig = DATA_SOURCE_CONFIGS[dataSourceKey];
  const maxAdminLevel = dataSourceConfig?.maxAdminLevel ?? 0;

  const isoContinentByCode = useMemo(() => {
    if (iso.status !== 'ready') return new Map<string, ContinentCode>();
    return new Map(iso.countries.map((country) => [country.code, country.continent]));
  }, [iso]);

  const baseCountries = useMemo(() => {
    return countries.map((country, countryIndex) => {
      const normalizedCode = normalizeCountryCodeFromMetadata(country, countryIndex);
      const isoContinent = isoContinentByCode.get(normalizedCode);
      const normalizedContinent = normalizeContinentCode(country.continent) ?? isoContinent ?? 'NA';
      return {
        country: {
          code: normalizedCode,
          name: country.countryName || normalizedCode || `#${countryIndex}`,
          nativeName: country.countryName,
          continent: normalizedContinent,
        },
        availableAdminLevels: country.availableAdminLevels ?? [],
      };
    });
  }, [countries, isoContinentByCode]);

  const checkboxMatrix = useMemo<boolean[][]>(() => {
    if (Array.isArray(draftData.checkboxState)) {
      return (draftData.checkboxState as unknown[]).map((row: unknown): boolean[] => {
        if (!Array.isArray(row)) {
          return Array.from({ length: maxAdminLevel + 1 }, () => false);
        }
        return Array.from({ length: maxAdminLevel + 1 }, (_, idx) => Boolean((row as unknown[])[idx]));
      });
    }
    return baseCountries.map(() => Array.from({ length: maxAdminLevel + 1 }, () => false));
  }, [draftData.checkboxState, baseCountries, maxAdminLevel]);

  const columns: MatrixConfig['columns'] = useMemo(
    () =>
      Array.from({ length: maxAdminLevel + 1 }, (_, levelIndex) => ({
        id: `level-${levelIndex}`,
        label: `Level ${levelIndex}`,
        description: `Admin level ${levelIndex}`,
        type: 'custom',
      })),
    [maxAdminLevel],
  );

  const currentSelections: MatrixSelection[] = useMemo(() => {
    return baseCountries.map((entry, countryIndex) => {
      const row = checkboxMatrix[countryIndex] ?? [];
      const selections: Record<string, boolean> = {};
      columns.forEach((col, levelIndex) => {
        selections[col.id] = Boolean(row[levelIndex]);
      });
      return {
        countryCode: entry.country.code,
        selections,
      };
    });
  }, [baseCountries, checkboxMatrix, columns]);

  const applySelections = useCallback(
    (nextSelections: MatrixSelection[]) => {
      const nextMatrix = baseCountries.map((entry) => {
        const found = nextSelections.find((sel) => sel.countryCode === entry.country.code);
        const row = columns.map((col, idx) => {
          const enabled = entry.availableAdminLevels.includes(idx);
          return enabled ? Boolean(found?.selections?.[col.id]) : false;
        });
        return row;
      });
      onChange({ checkboxState: nextMatrix });

      const totalSelected = nextMatrix.flat().filter(Boolean).length;
      const countriesWithSelection = nextMatrix.filter((row) => row.some(Boolean)).length;
      enqueueSnackbar(
        `${countriesWithSelection} countries / ${totalSelected} selections — Est. Size: ${formatBytes(
          calculateEstimatedSize(totalSelected),
        )}, Est. Features: ${formatNumber(calculateEstimatedFeatures(totalSelected, countries))}`,
        { variant: 'info' },
      );
    },
    [baseCountries, columns, countries, enqueueSnackbar, onChange],
  );

  const isCellEnabled = useCallback(
    (countryCode: string, columnId: string) => {
      const entry = baseCountries.find((c) => c.country.code === countryCode);
      if (!entry) return false;
      const colIndex = columns.findIndex((col) => col.id === columnId);
      if (colIndex < 0) return false;
      return entry.availableAdminLevels.includes(colIndex);
    },
    [baseCountries, columns],
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
      <Alert severity="error">Failed to load country metadata: {error.message}</Alert>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1, minHeight: 0 }}>
      <Typography variant="h6" gutterBottom>
        Select Countries & Administrative Levels
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Select countries and their administrative levels to download. Use the matrix to make precise selections.
      </Typography>

      <Box sx={{ flex: 1, minHeight: 0 }}>
        <CountryMatrixSelector
          countries={baseCountries.map((c) => c.country)}
          matrixConfig={{ columns, virtualization: { rowHeight: 40, overscan: 8 } }}
          selections={currentSelections}
          onSelectionsChange={applySelections}
          isCellEnabled={(country, columnId) => isCellEnabled(country.code, columnId)}
          rowHeight={40}
          height="100%"
          maxHeight={undefined}
          showRegionIndex
          showAlphabetIndex
          loading={loading}
          errorMessage={null}
        />
      </Box>
    </Box>
  );
};
