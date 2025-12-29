import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSnackbar } from 'notistack';
import { useIsoCountries, type MatrixConfig, type MatrixSelection, type ContinentCode } from '@hierarchidb/ui-country-select';
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
import { clearStagesIfPresent, FULL_INVALIDATION_STAGES, resolveShapeNodeId } from '../utils/sessionInvalidation.js';
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
  const iso2 = country.iso2?.trim();
  if (iso2) return iso2.toUpperCase();
  const countryCode = country.countryCode?.trim();
  if (countryCode) return countryCode.toUpperCase();
  return `COUNTRY-${index}`;
};

const isSelectionEqual = (
  left?: Record<string, boolean[]>,
  right?: Record<string, boolean[]>,
): boolean => {
  if (!left || !right) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length) return false;
  for (let i = 0; i < leftKeys.length; i += 1) {
    if (leftKeys[i] !== rightKeys[i]) return false;
  }
  return leftKeys.every((key) => {
    const leftRow = left[key] ?? [];
    const rightRow = right[key] ?? [];
    if (leftRow.length !== rightRow.length) return false;
    for (let colIndex = 0; colIndex < leftRow.length; colIndex += 1) {
      if (Boolean(leftRow[colIndex]) !== Boolean(rightRow[colIndex])) return false;
    }
    return true;
  });
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
  const dataSourceConfig = DATA_SOURCE_CONFIGS[dataSourceKey];
  const maxAdminLevel = dataSourceConfig?.maxAdminLevel ?? 0;

  const isoContinentByCode = useMemo(() => {
    if (iso.status !== 'ready') return new Map<string, ContinentCode>();
    return new Map(iso.countries.map((country) => [country.code, country.continent]));
  }, [iso]);
  const iso3ToIso2 = useMemo(() => {
    return new Map(
      countries
        .map((country, index) => {
          const iso3 = country.iso3?.trim().toUpperCase();
          const iso2 = normalizeCountryCodeFromMetadata(country, index).trim().toUpperCase();
          if (!iso3 || !iso2 || iso2.length !== 2) return null;
          return [iso3, iso2] as const;
        })
        .filter((entry): entry is [string, string] => Boolean(entry)),
    );
  }, [countries]);

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

  const normalizedSelection = useMemo<Record<string, boolean[]>>(() => {
    if (!selectedArrayByCountries) return {};
    if (Array.isArray(selectedArrayByCountries)) {
      const legacy = selectedArrayByCountries as boolean[][];
      const mapped: Record<string, boolean[]> = {};
      baseCountries.forEach((entry, rowIndex) => {
        const row = legacy[rowIndex] ?? [];
        mapped[entry.country.code] = Array.from({ length: maxAdminLevel + 1 }, (_, idx) => Boolean(row[idx]));
      });
      return mapped;
    }
    const resolveSelectionKey = (code: string) => {
      const normalized = code.trim().toUpperCase();
      if (normalized.length === 2) return normalized;
      return iso3ToIso2.get(normalized) ?? normalized;
    };
    return Object.fromEntries(
      Object.entries(selectedArrayByCountries).map(([code, row]) => [
        resolveSelectionKey(code),
        Array.isArray(row)
          ? Array.from({ length: maxAdminLevel + 1 }, (_, idx) => Boolean(row[idx]))
          : Array.from({ length: maxAdminLevel + 1 }, () => false),
      ]),
    );
  }, [baseCountries, iso3ToIso2, maxAdminLevel, selectedArrayByCountries]);

  const checkboxMatrix = useMemo<boolean[][]>(() => {
    return baseCountries.map((entry) => {
      const row = normalizedSelection[entry.country.code] ?? [];
      return Array.from({ length: maxAdminLevel + 1 }, (_, idx) => Boolean(row[idx]));
    });
  }, [baseCountries, maxAdminLevel, normalizedSelection]);

  useEffect(() => {
    if (!Array.isArray(selectedArrayByCountries)) return;
    if (Object.keys(normalizedSelection).length === 0) return;
    onChange({ selectedArrayByCountries: normalizedSelection });
  }, [normalizedSelection, onChange, selectedArrayByCountries]);

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
    if (dataSourceKey !== 'geoboundaries' || !availableAdminLevels) return;
    const nextSelection: Record<string, boolean[]> = {};
    baseCountries.forEach((entry) => {
      const row = normalizedSelection[entry.country.code] ?? [];
      nextSelection[entry.country.code] = Array.from({ length: maxAdminLevel + 1 }, (_, colIndex) => (
        entry.availableAdminLevels.includes(colIndex) ? Boolean(row[colIndex]) : false
      ));
    });
    if (!isSelectionEqual(normalizedSelection, nextSelection)) {
      onChange({ selectedArrayByCountries: nextSelection });
    }
  }, [
    availableAdminLevels,
    baseCountries,
    dataSourceKey,
    maxAdminLevel,
    normalizedSelection,
    onChange,
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

  const disabledColumnIds = useMemo(
    () => columns.filter((_, levelIndex) => levelIndex >= 2).map((column) => column.id),
    [columns],
  );

  const matrixConfig: MatrixConfig = useMemo(() => ({
    columns,
    disabledColumnIds,
    virtualization: { rowHeight: 40, overscan: 8 },
  }), [columns, disabledColumnIds]);

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
      const nextSelection = baseCountries.reduce<Record<string, boolean[]>>((acc, entry) => {
        const found = nextSelections.find((sel) => sel.countryCode === entry.country.code);
        const row = columns.map((col, idx) => {
          const enabled = entry.availableAdminLevels.includes(idx);
          return enabled ? Boolean(found?.selections?.[col.id]) : false;
        });
        acc[entry.country.code] = row;
        return acc;
      }, {});
      if (!isSelectionEqual(normalizedSelection, nextSelection)) {
        const nodeId = resolveShapeNodeId(data);
        if (nodeId) {
          void clearStagesIfPresent(nodeId, FULL_INVALIDATION_STAGES);
        }
      }
      onChange({ selectedArrayByCountries: nextSelection });

      const rows = Object.values(nextSelection);
      const totalSelected = rows.flat().filter(Boolean).length;
      const countriesWithSelection = rows.filter((row) => row.some(Boolean)).length;
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
      normalizedSelection,
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
