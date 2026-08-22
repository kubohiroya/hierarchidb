import type { NodeId } from '@hierarchidb/core-types';
import type { Country, MatrixConfig, MatrixSelection } from '@hierarchidb/ui-country-select';
import { useSnackbar } from 'notistack';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { CountryMetadata } from '~/common/types/index';
import {
  calculateEstimatedFeatures,
  calculateEstimatedSize,
  formatBytes,
  formatNumber,
} from '~/common/utils/estimateUtils';
import type { SerializedCountryAvailability } from '~/ui/workers/countryAvailabilityTypes';
import {
  isSelectionEqual,
  normalizeContinentCode,
  normalizeCountryCodeFromMetadata,
} from './selectionUtils.js';

export type CountrySelectionIsoState = {
  status: 'ready' | 'loading' | 'error';
  countries: Country[];
  message?: string;
};

type Args = {
  nodeId: NodeId;
  countries: CountryMetadata[];
  availability: SerializedCountryAvailability | null;
  selectedArrayByCountries?: Record<string, boolean[]> | null;
  resolvedMaxAdminLevel: number;
  iso: CountrySelectionIsoState | undefined;
  onChange: (patch: Partial<Record<string, unknown>>) => void;
  onInvalidate: (prev: Record<string, boolean[]>, next: Record<string, boolean[]>) => Promise<void>;
};

type State = {
  matrixConfig: MatrixConfig;
  countries: Country[];
  selections: MatrixSelection[];
  applySelections: (nextSelections: MatrixSelection[]) => void;
  isCellEnabled: (countryCode: string, columnId: string) => boolean;
};

const toIso2SelectionKey = (code: string, fallbackMap: Map<string, string>): string => {
  const normalized = code.trim().toUpperCase();
  if (normalized.length === 2) return normalized;
  return fallbackMap.get(normalized) ?? normalized;
};

const buildMatrixConfig = (resolvedMaxAdminLevel: number): MatrixConfig => ({
  columns: Array.from({ length: resolvedMaxAdminLevel + 1 }, (_, levelIndex) => ({
    id: `level-${levelIndex}`,
    label: `Level ${levelIndex}`,
    description: `Admin level ${levelIndex}`,
    type: 'custom',
  })),
  virtualization: { rowHeight: 40, overscan: 8 },
});

const buildAvailabilityByCode = (
  availability: SerializedCountryAvailability | null
): Map<string, number[]> | null => {
  if (!availability) return null;
  const map = new Map<string, number[]>();
  availability.entries.forEach((entry) => {
    const code = entry.countryCode?.trim().toUpperCase();
    if (!code) return;
    const levels = Array.from(
      new Set((entry.adminLevels ?? []).filter((level) => level >= 0))
    ).sort((a, b) => a - b);
    map.set(code, levels);
  });
  return map;
};

export const useShapeCountrySelectionStepSelectionState = ({
  nodeId,
  countries,
  availability,
  selectedArrayByCountries,
  resolvedMaxAdminLevel,
  iso,
  onChange,
  onInvalidate,
}: Args): State => {
  const { enqueueSnackbar } = useSnackbar();
  const prevSelectionRef = useRef<Record<string, boolean[]> | null>(null);

  const isoContinentByCode = useMemo(() => {
    if (!iso || iso.status !== 'ready') return new Map<string, Country['continent']>();
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
        .filter((entry): entry is [string, string] => Boolean(entry))
    );
  }, [countries]);

  const availabilityByCountryCode = useMemo(
    () => buildAvailabilityByCode(availability),
    [availability]
  );

  const normalizedAvailabilityByCountry = useMemo(() => {
    if (!availabilityByCountryCode) return null;
    const map = new Map<string, number[]>();
    availabilityByCountryCode.forEach((levels, code) => {
      const normalized = code.trim().toUpperCase();
      const iso2 =
        normalized.length === 2 ? normalized : (iso3ToIso2.get(normalized) ?? normalized);
      map.set(iso2, levels);
    });
    return map;
  }, [availabilityByCountryCode, iso3ToIso2]);

  const baseCountries = useMemo(
    () =>
      countries.map((country, countryIndex) => {
        const normalizedCode = normalizeCountryCodeFromMetadata(country, countryIndex);
        const isoContinent = isoContinentByCode.get(normalizedCode);
        const normalizedContinent =
          normalizeContinentCode(country.continent) ?? isoContinent ?? 'XX';
        const resolvedLevels =
          normalizedAvailabilityByCountry?.get(normalizedCode) ??
          country.availableAdminLevels ??
          [];
        const normalizedLevels = Array.from(
          new Set(
            resolvedLevels.filter(
              (level) => Number.isFinite(level) && level >= 0 && level <= resolvedMaxAdminLevel
            )
          )
        ).sort((a, b) => a - b);
        return {
          country: {
            code: normalizedCode,
            name: country.countryName || normalizedCode || `#${countryIndex}`,
            nativeName: country.countryName,
            continent: normalizedContinent,
          },
          availableAdminLevels: normalizedLevels,
        };
      }),
    [countries, isoContinentByCode, normalizedAvailabilityByCountry, resolvedMaxAdminLevel]
  );

  const normalizedSelection = useMemo<Record<string, boolean[]>>(() => {
    if (!selectedArrayByCountries || Array.isArray(selectedArrayByCountries)) return {};
    return Object.entries(selectedArrayByCountries).reduce<Record<string, boolean[]>>(
      (acc, [code, row]) => {
        const selectionKey = toIso2SelectionKey(code, iso3ToIso2);
        if (!selectionKey) return acc;
        acc[selectionKey] = Array.from({ length: resolvedMaxAdminLevel + 1 }, (_, idx) =>
          Boolean(row?.[idx])
        );
        return acc;
      },
      {}
    );
  }, [iso3ToIso2, resolvedMaxAdminLevel, selectedArrayByCountries]);

  const checkboxMatrix = useMemo<boolean[][]>(() => {
    return baseCountries.map((entry) => {
      const row = normalizedSelection[entry.country.code] ?? [];
      return Array.from({ length: resolvedMaxAdminLevel + 1 }, (_, idx) => Boolean(row[idx]));
    });
  }, [baseCountries, normalizedSelection, resolvedMaxAdminLevel]);

  const columns: MatrixConfig['columns'] = useMemo(
    () =>
      Array.from({ length: resolvedMaxAdminLevel + 1 }, (_, levelIndex) => ({
        id: `level-${levelIndex}`,
        label: `Level ${levelIndex}`,
        description: `Admin level ${levelIndex}`,
        type: 'custom',
      })),
    [resolvedMaxAdminLevel]
  );

  const currentSelections: MatrixSelection[] = useMemo(() => {
    return baseCountries.map((entry, countryIndex) => {
      const row = checkboxMatrix[countryIndex] ?? [];
      const selections: Record<string, boolean> = {};
      columns.forEach((col, levelIndex) => {
        selections[col.id] = Boolean(row[levelIndex]);
      });
      return { countryCode: entry.country.code, selections };
    });
  }, [baseCountries, checkboxMatrix, columns]);

  const countryList = useMemo<Country[]>(
    () => baseCountries.map((entry) => entry.country),
    [baseCountries]
  );

  const matrixConfig = useMemo(
    () => buildMatrixConfig(resolvedMaxAdminLevel),
    [resolvedMaxAdminLevel]
  );

  useEffect(() => {
    if (!Array.isArray(selectedArrayByCountries)) return;
    if (Object.keys(normalizedSelection).length === 0) return;
    onChange({ selectedArrayByCountries: normalizedSelection });
  }, [normalizedSelection, onChange, selectedArrayByCountries]);

  useEffect(() => {
    if (baseCountries.length === 0) return;
    const nextSelection: Record<string, boolean[]> = {};
    baseCountries.forEach((entry) => {
      const row = normalizedSelection[entry.country.code] ?? [];
      nextSelection[entry.country.code] = Array.from(
        { length: resolvedMaxAdminLevel + 1 },
        (_, colIndex) =>
          entry.availableAdminLevels.includes(colIndex) ? Boolean(row[colIndex]) : false
      );
    });
    if (!isSelectionEqual(normalizedSelection, nextSelection)) {
      onChange({ selectedArrayByCountries: nextSelection });
    }
  }, [baseCountries, onChange, resolvedMaxAdminLevel, normalizedSelection]);

  useEffect(() => {
    if (!nodeId || baseCountries.length === 0) return;
    if (Object.keys(normalizedSelection).length === 0) return;
    const prev = prevSelectionRef.current;
    if (!prev) {
      prevSelectionRef.current = normalizedSelection;
      return;
    }
    if (isSelectionEqual(prev, normalizedSelection)) return;
    let ownsSelectionBaseline = true;
    void onInvalidate(prev, normalizedSelection)
      .then(() => {
        if (ownsSelectionBaseline) {
          prevSelectionRef.current = normalizedSelection;
        }
      })
      .catch((error: unknown) =>
        console.warn(
          '[ShapeCountrySelectionStep] failed to invalidate build after selection change',
          error
        )
      );
    return () => {
      ownsSelectionBaseline = false;
    };
  }, [baseCountries.length, nodeId, normalizedSelection, onInvalidate]);

  const applySelections = useCallback(
    (nextSelections: MatrixSelection[]) => {
      const nextSelection = baseCountries.reduce<Record<string, boolean[]>>((acc, entry) => {
        const found = nextSelections.find((sel) => sel.countryCode === entry.country.code);
        const row = columns.map((col) => {
          const index = Number.parseInt(col.id.slice('level-'.length), 10);
          const isEnabled = entry.availableAdminLevels.includes(index);
          return isEnabled ? Boolean(found?.selections?.[col.id]) : false;
        });
        acc[entry.country.code] = row;
        return acc;
      }, {});
      onChange({ selectedArrayByCountries: nextSelection });
      const rows = Object.values(nextSelection);
      const totalSelected = rows.flat().filter(Boolean).length;
      const countriesWithSelection = rows.filter((row) => row.some(Boolean)).length;
      enqueueSnackbar(
        `${countriesWithSelection} countries / ${totalSelected} selections — Est. Size: ${formatBytes(
          calculateEstimatedSize(totalSelected)
        )}, Est. Features: ${formatNumber(calculateEstimatedFeatures(totalSelected, countries))}`,
        { variant: 'info' }
      );
    },
    [baseCountries, columns, countries, enqueueSnackbar, onChange]
  );

  const isCellEnabled = useCallback(
    (countryCode: string, columnId: string) => {
      const entry = baseCountries.find((country) => country.country.code === countryCode);
      if (!entry) return false;
      const colIndex = columns.findIndex((col) => col.id === columnId);
      if (colIndex < 0) return false;
      return entry.availableAdminLevels.includes(colIndex);
    },
    [baseCountries, columns]
  );

  const state: State = useMemo(
    () => ({
      matrixConfig,
      countries: countryList,
      selections: currentSelections,
      applySelections,
      isCellEnabled,
    }),
    [matrixConfig, countryList, currentSelections, applySelections, isCellEnabled]
  );

  return state;
};
