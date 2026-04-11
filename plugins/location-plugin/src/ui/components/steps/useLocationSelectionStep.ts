import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LocationEntity } from '~/common/types/index';
import { useTranslation } from '@hierarchidb/ui-i18n';
import { parseIdeGsmRecords } from '@hierarchidb/location-api';
import { notify } from '@hierarchidb/components';
import { buildAvailabilityMapFromIdeGsmPoints, buildSelectionMapFromAvailability } from '~/ui/utils/ideGsmSelectionUtils';
import type { LocationType } from '~/common/types/index';
import type { IdeGsmSourceEntry } from '@hierarchidb/location-api';
import {
  useIsoCountries,
  type Country,
  type MatrixConfig,
  type MatrixColumn,
  type MatrixSelection,
} from '@hierarchidb/ui-country-select';
import { BASE_LOCATION_TYPES, resolveTypesForSource } from './locationTypes.js';
import { createLocationTabularApi } from '~/common/tabular/createLocationTabularApi';

interface LocationSelectionStepProps {
  draft: Partial<LocationEntity>;
  onUpdate: (updates: Partial<LocationEntity>) => void;
  buildSelectionRecord: (
    countryCodes: string[],
    columns: Array<{ id: string }>,
    nextSelections: MatrixSelection[],
    allowedTypeSet: Set<LocationType>,
  ) => Record<string, boolean[]>;
}

export const useLocationSelectionStep = ({ draft, onUpdate, buildSelectionRecord }: LocationSelectionStepProps) => {
  const { t } = useTranslation('location-plugin');
  const iso = useIsoCountries();
  const tabularApi = useMemo(() => createLocationTabularApi(), []);
  const allowedTypes = resolveTypesForSource(draft.dataSource ?? '');
  const allowedTypeSet = useMemo(() => new Set(allowedTypes), [allowedTypes]);

  const matrixConfig: MatrixConfig = {
    columns: BASE_LOCATION_TYPES.map((type) => {
      const name = t(`locationTypes.${type.id}`, type.id);
      const description = t(`selection.typeDescriptions.${type.id}`, name);
      return {
        id: type.id,
        label: name,
        description,
        type: 'custom',
        width: 140,
        icon: type.icon as MatrixColumn['icon'],
      };
    }),
    virtualization: {
      rowHeight: 40,
      overscan: 8,
    },
  };

  const deepEqualSelectionRecord = useCallback((
    current: Record<string, boolean[]>,
    next: Record<string, boolean[]>,
  ): boolean => {
    if (iso.status !== 'ready') return true;
    for (const country of iso.countries) {
      const rowA = current[country.code] ?? [];
      const rowB = next[country.code] ?? [];
      if (rowA.length !== rowB.length) return false;
      for (let j = 0; j < rowA.length; j += 1) {
        if (rowA[j] !== rowB[j]) return false;
      }
    }
    return true;
  }, [iso.countries, iso.status]);

  type CountryMatrixSelection = MatrixSelection;

  const selectionByCountries = useMemo(() => draft.selectedArrayByCountries ?? {}, [draft.selectedArrayByCountries]);
  const ideGsmSources = useMemo<IdeGsmSourceEntry[]>(() => {
    if (draft.ideGsmSources && draft.ideGsmSources.length > 0) {
      return draft.ideGsmSources;
    }
    if (draft.tabularSourceId) {
      return [{
        fileName: draft.ideGsmFileName ?? '',
        tabularSourceId: draft.tabularSourceId,
      }];
    }
    return [];
  }, [draft.ideGsmFileName, draft.ideGsmSources, draft.tabularSourceId]);
  const [availabilityByCountry, setAvailabilityByCountry] = useState<Record<string, boolean[]>>({});
  const parseInFlightRef = useRef(false);
  // Tracks whether the initial auto-selection from availability has already been applied.
  // Once set, user interactions (including deselect-all) must not be overwritten by re-parsing.
  const initializedRef = useRef(false);
  const typeIndex = useMemo(
    () => new Map(BASE_LOCATION_TYPES.map((type, index) => [type.id, index])),
    [],
  );

  const hasAvailability = useMemo(
    () => Object.keys(availabilityByCountry).length > 0,
    [availabilityByCountry],
  );

  useEffect(() => {
    if (draft.dataSource !== 'ide-gsm') return;
    const sources = ideGsmSources.filter((source) => source.tabularSourceId);
    if (sources.length === 0) return;
    if (parseInFlightRef.current) return;
    // Skip if availability is already parsed; re-parsing must not overwrite user interactions.
    if (hasAvailability) return;
    parseInFlightRef.current = true;
    const run = async () => {
      try {
        const parsedList = await Promise.all(
          sources.map(async (source) => {
            const tableId = source.tabularSourceId;
            const result = await tabularApi.getFilteredData(tableId, { valueColumns: [], filterRules: [] });
            const headers = result.columns.map((column) => column.name);
            return parseIdeGsmRecords(headers, result.rows);
          }),
        );
        const points = parsedList.flatMap((parsed) => parsed.points);
        const availabilityMap = buildAvailabilityMapFromIdeGsmPoints(points, BASE_LOCATION_TYPES);
        setAvailabilityByCountry(availabilityMap);
        // Apply initial auto-selection only once; subsequent user changes must not be overwritten.
        if (!initializedRef.current) {
          initializedRef.current = true;
          const selectionMap = buildSelectionMapFromAvailability(availabilityMap);
          onUpdate({ selectedArrayByCountries: selectionMap });
        }
        if (!points.length) {
          notify.warning(t('dataSource.ideGsm.empty', 'No valid IDE-GSM rows found.'));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        notify.error(`${t('dataSource.ideGsm.parseError', 'Failed to parse IDE-GSM CSV.')} ${message}`);
      } finally {
        parseInFlightRef.current = false;
      }
    };

    void run();
  }, [
    draft.dataSource,
    hasAvailability,
    ideGsmSources,
    onUpdate,
    t,
    tabularApi,
  ]);

  const selectionMatrixSource = useMemo(() => {
    if (iso.status !== 'ready') return [];
    return iso.countries.map((country) => selectionByCountries[country.code] ?? []);
  }, [iso, selectionByCountries]);

  const selectionRecordSource = useMemo(() => {
    if (iso.status !== 'ready') return {};
    return selectionByCountries;
  }, [iso, selectionByCountries]);

  const currentSelections: CountryMatrixSelection[] = useMemo(() => {
    if (iso.status !== 'ready') return [];
    return iso.countries.map((country, index) => {
      const row = selectionMatrixSource[index] ?? [];
      const selections: Record<string, boolean> = {};
      matrixConfig.columns.forEach((col, colIdx) => {
        selections[col.id] = Boolean(row[colIdx]);
      });
      return { countryCode: country.code, selections };
    });
  }, [iso, selectionMatrixSource, matrixConfig.columns]);

  const applySelections = useCallback(
    (nextSelections: CountryMatrixSelection[]) => {
      if (iso.status !== 'ready') return;
      const normalized = buildSelectionRecord(
        iso.countries.map((c) => c.code),
        matrixConfig.columns,
        nextSelections,
        allowedTypeSet,
      );
      if (!deepEqualSelectionRecord(selectionRecordSource, normalized)) {
        onUpdate({ selectedArrayByCountries: normalized });
      }
    },
    [allowedTypeSet, deepEqualSelectionRecord, iso.countries, iso.status, matrixConfig.columns, onUpdate, selectionRecordSource],
  );

  const isCellEnabled = useCallback(
    (country: Country, columnId: string) => {
      if (!allowedTypeSet.has(columnId as LocationType)) return false;
      if (draft.dataSource !== 'ide-gsm') return true;
      const row = availabilityByCountry[country.code];
      if (!row) return false;
      const idx = typeIndex.get(columnId as LocationType);
      if (idx == null) return false;
      return Boolean(row[idx]);
    },
    [allowedTypeSet, availabilityByCountry, draft.dataSource, typeIndex],
  );

  return {
    t,
    iso,
    matrixConfig,
    currentSelections,
    applySelections,
    isCellEnabled,
  };
};
