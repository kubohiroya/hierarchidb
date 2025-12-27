import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSnackbar } from 'notistack';
import { useIsoCountries, type MatrixConfig, type MatrixSelection, type ContinentCode } from '@hierarchidb/ui-country-select';
import { getWorkerClientHook, type WorkerClientRef } from '@hierarchidb/ui-worker-provider';
import type { CountryMetadata, ShapeEntity } from '../../common/types/index.js';
import { useCountryMetadata } from './useCountryMetadata.js';
import {
  calculateEstimatedFeatures,
  calculateEstimatedSize,
  DATA_SOURCE_CONFIGS,
  formatBytes,
  formatNumber,
} from '../../common/mock/data.js';
import { normalizeDataSourceName } from '../../services/utils/utils.js';
import { clearStagesIfPresent, FULL_INVALIDATION_STAGES, resolveShapeSessionId } from '../utils/sessionInvalidation.js';
import { fetchGeoBoundariesAvailability } from '../../services/utils/geoBoundariesAvailability.js';

const CONTINENT_CODES: ContinentCode[] = ['AF', 'AS', 'EU', 'NA', 'SA', 'OC', 'AN'];

const CONTINENT_ALIASES: Record<string, ContinentCode> = {
  africa: 'AF',
  af: 'AF',
  asia: 'AS',
  as: 'AS',
  europe: 'EU',
  eu: 'EU',
  'north america': 'NA',
  na: 'NA',
  'south america': 'SA',
  sa: 'SA',
  'central america': 'NA',
  oceania: 'OC',
  australia: 'OC',
  oc: 'OC',
  antarctica: 'AN',
  an: 'AN',
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
    (value): value is string => Boolean(value?.trim()),
  );
  const primary = (candidates[0] ?? `country-${index}`).trim().toUpperCase();
  if (primary.length === 2) return primary;
  if (primary.length === 3 && country.iso2) return country.iso2.trim().toUpperCase();
  if (primary.length === 3) return primary.slice(0, 2);
  return primary.slice(0, 2) || `COUNTRY-${index}`;
};

const isMatrixEqual = (left?: boolean[][], right?: boolean[][]): boolean => {
  if (!left || !right) return false;
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
};

type Args = {
  data: Partial<ShapeEntity>;
  onChange: (patch: Partial<ShapeEntity>) => void;
};

export const useShapeCountrySelectionStep = ({ data, onChange }: Args) => {
  const { enqueueSnackbar } = useSnackbar();
  const dataSourceKey = normalizeDataSourceName(
    data.batchConfig?.dataSource ?? data.dataSourceName,
  ) ?? 'gadm';
  const iso = useIsoCountries();
  const { metadata: countries, loading, error } = useCountryMetadata({ dataSource: dataSourceKey });
  const [availableAdminLevels, setAvailableAdminLevels] = useState<Map<string, number[]> | null>(null);
  const selectedArrayByCountries = data.selectedArrayByCountries;
  const workerClientHook = useMemo(() => {
    try {
      return getWorkerClientHook<WorkerClientRef | null>();
    } catch {
      return null;
    }
  }, []);
  const workerClient = workerClientHook ? workerClientHook() : null;
  const urlMetadataRequestRef = useRef(0);
  const warnedMissingWorkerRef = useRef(false);

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
      const geoAdminLevels = dataSourceKey === 'geoboundaries' && availableAdminLevels
        ? availableAdminLevels.get((country.iso3 ?? normalizedCode).toUpperCase()) ?? []
        : null;
      const filteredLevels = geoAdminLevels
        ? (country.availableAdminLevels ?? []).filter((level) => geoAdminLevels.includes(level))
        : (country.availableAdminLevels ?? []);
      return {
        country: {
          code: normalizedCode,
          name: country.countryName || normalizedCode || `#${countryIndex}`,
          nativeName: country.countryName,
          continent: normalizedContinent,
        },
        availableAdminLevels: geoAdminLevels ? filteredLevels : (country.availableAdminLevels ?? []),
      };
    });
  }, [availableAdminLevels, countries, dataSourceKey, isoContinentByCode]);

  const checkboxMatrix = useMemo<boolean[][]>(() => {
    if (Array.isArray(selectedArrayByCountries)) {
      return (selectedArrayByCountries as unknown[]).map((row: unknown): boolean[] => {
        if (!Array.isArray(row)) {
          return Array.from({ length: maxAdminLevel + 1 }, () => false);
        }
        return Array.from({ length: maxAdminLevel + 1 }, (_, idx) => Boolean((row as unknown[])[idx]));
      });
    }
    return baseCountries.map(() => Array.from({ length: maxAdminLevel + 1 }, () => false));
  }, [baseCountries, maxAdminLevel, selectedArrayByCountries]);

  const requestUrlMetadata = useCallback(async (matrix: boolean[][]) => {
    if (!workerClient) {
      if (!warnedMissingWorkerRef.current) {
        warnedMissingWorkerRef.current = true;
        enqueueSnackbar(
          'Worker client is unavailable. URL metadata will be generated when starting the build.',
          { variant: 'warning' },
        );
      }
      return null;
    }
    const requestId = urlMetadataRequestRef.current + 1;
    urlMetadataRequestRef.current = requestId;
    try {
      const api = workerClient.getAPI();
      const metadata = await api.generateShapeUrlMetadataFromSelection(dataSourceKey, matrix);
      if (urlMetadataRequestRef.current !== requestId) return null;
      return metadata;
    } catch (fetchError) {
      console.warn('[ShapeCountrySelectionStep] failed to generate urlMetadata', fetchError);
      enqueueSnackbar('Failed to generate URL metadata.', { variant: 'warning' });
      return null;
    }
  }, [dataSourceKey, enqueueSnackbar, workerClient]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (dataSourceKey !== 'geoboundaries') {
        setAvailableAdminLevels(null);
        return;
      }
      try {
        const { entries, totalItems } = await fetchGeoBoundariesAvailability(
          'https://www.geoboundaries.org/api/current/gbOpen/ALL/ALL/',
        );
        console.debug('[ShapeCountrySelectionStep] GeoBoundaries availability fetched', {
          totalItems,
          countries: entries.size,
          sample: Array.from(entries.entries()).slice(0, 3),
        });
        if (!cancelled && entries.size > 0) {
          setAvailableAdminLevels(entries);
        } else if (!cancelled) {
          setAvailableAdminLevels(null);
          console.debug('[ShapeCountrySelectionStep] GeoBoundaries availability empty', {
            totalItems,
          });
          enqueueSnackbar(
            'GeoBoundaries availability is empty. Showing full selection.',
            { variant: 'warning' },
          );
        }
      } catch (fetchError) {
        console.warn('[ShapeCountrySelectionStep] failed to load GeoBoundaries availability', fetchError);
        if (!cancelled) {
          setAvailableAdminLevels(null);
          enqueueSnackbar(
            'GeoBoundaries availability lookup failed. Showing full selection.',
            { variant: 'warning' },
          );
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [dataSourceKey, enqueueSnackbar]);

  useEffect(() => {
    if (!Array.isArray(selectedArrayByCountries)) return;
    if (dataSourceKey !== 'geoboundaries' || !availableAdminLevels) return;
    const nextMatrix = baseCountries.map((entry, rowIndex) => {
      const row = checkboxMatrix[rowIndex] ?? [];
      return Array.from({ length: maxAdminLevel + 1 }, (_, colIndex) => (
        entry.availableAdminLevels.includes(colIndex) ? Boolean(row[colIndex]) : false
      ));
    });
    const previousMatrix = selectedArrayByCountries as boolean[][];
    if (!isMatrixEqual(previousMatrix, nextMatrix)) {
      onChange({ selectedArrayByCountries: nextMatrix });
      void (async () => {
        const selectedMetadata = await requestUrlMetadata(nextMatrix);
        if (selectedMetadata) {
          onChange({ urlMetadata: selectedMetadata });
        }
      })();
    }
  }, [
    availableAdminLevels,
    baseCountries,
    checkboxMatrix,
    dataSourceKey,
    maxAdminLevel,
    onChange,
    selectedArrayByCountries,
    requestUrlMetadata,
  ]);

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

  const matrixConfig: MatrixConfig = useMemo(() => ({
    columns,
    virtualization: { rowHeight: 40, overscan: 8 },
  }), [columns]);

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
      const previousMatrix = Array.isArray(selectedArrayByCountries)
        ? (selectedArrayByCountries as boolean[][])
        : undefined;
      if (!isMatrixEqual(previousMatrix, nextMatrix)) {
        const sessionId = resolveShapeSessionId(data);
        if (sessionId) {
          void clearStagesIfPresent(sessionId, FULL_INVALIDATION_STAGES);
        }
      }
      onChange({ selectedArrayByCountries: nextMatrix });
      void (async () => {
        const selectedMetadata = await requestUrlMetadata(nextMatrix);
        if (selectedMetadata) {
          onChange({ urlMetadata: selectedMetadata });
        }
      })();

      const totalSelected = nextMatrix.flat().filter(Boolean).length;
      const countriesWithSelection = nextMatrix.filter((row) => row.some(Boolean)).length;
      enqueueSnackbar(
        `${countriesWithSelection} countries / ${totalSelected} selections — Est. Size: ${formatBytes(
          calculateEstimatedSize(totalSelected),
        )}, Est. Features: ${formatNumber(calculateEstimatedFeatures(totalSelected, countries))}`,
        { variant: 'info' },
      );
    },
    [
      baseCountries,
      columns,
      countries,
      data,
      dataSourceKey,
      enqueueSnackbar,
      onChange,
      requestUrlMetadata,
      selectedArrayByCountries,
    ],
  );

  const isCellEnabled = useCallback(
    (countryCode: string, columnId: string) => {
      const entry = baseCountries.find((country) => country.country.code === countryCode);
      if (!entry) return false;
      const colIndex = columns.findIndex((col) => col.id === columnId);
      if (colIndex < 0) return false;
      return entry.availableAdminLevels.includes(colIndex);
    },
    [baseCountries, columns],
  );

  return {
    loading,
    error,
    matrixConfig,
    countries: baseCountries.map((entry) => entry.country),
    selections: currentSelections,
    applySelections,
    isCellEnabled,
  };
};
