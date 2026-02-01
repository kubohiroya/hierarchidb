/**
 * Location Selection Step
 */

import type React from 'react';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, CircularProgress, Typography } from '@mui/material';
import type { LocationEntity } from '../../../common/types/index.js';
import { useTranslation } from '../../../common/i18n/index.js';
import { parseIdeGsmRecords } from '@hierarchidb/location-api';
import { notify } from '@hierarchidb/components';
import { buildAvailabilityMapFromIdeGsmPoints, buildSelectionMapFromAvailability } from '../../utils/ideGsmSelection.js';
import type { LocationType } from '../../../common/types/index.js';
import type { IdeGsmSourceEntry } from '@hierarchidb/location-api';
import { CountryMatrixSelector, useIsoCountries, type Country, type MatrixConfig, type MatrixSelection } from '@hierarchidb/ui-country-select';
import { BASE_LOCATION_TYPES, resolveTypesForSource } from './locationTypes.js';
import { AuthReadyGate } from '@hierarchidb/ui-auth';
import { createLocationTabularApi } from '../../../common/tabular/createLocationTabularApi.js';

interface LocationSelectionStepProps {
  draft: Partial<LocationEntity>;
  onUpdate: (updates: Partial<LocationEntity>) => void;
}

type SelectionColumn = {
  id: string;
};

export const buildSelectionRecord = (
  countryCodes: string[],
  columns: SelectionColumn[],
  nextSelections: MatrixSelection[],
  allowedTypeSet: Set<LocationType>,
): Record<string, boolean[]> => {
  const normalized: Record<string, boolean[]> = {};
  countryCodes.forEach((countryCode) => {
    const entry = nextSelections.find((sel) => sel.countryCode === countryCode);
    const selections = entry?.selections ?? {};
    normalized[countryCode] = columns.map((col) => {
      const allowed = allowedTypeSet.has(col.id as LocationType);
      return allowed ? Boolean(selections[col.id]) : false;
    });
  });

  return normalized;
};

const LocationSelectionContent: React.FC<LocationSelectionStepProps> = ({ draft, onUpdate }) => {
  const { translations, t } = useTranslation();
  const iso = useIsoCountries();
  const tabularApi = useMemo(() => createLocationTabularApi(), []);
  const allowedTypes = resolveTypesForSource(draft.dataSource ?? '');
  const allowedTypeSet = useMemo(()=>new Set(allowedTypes), [allowedTypes]);
  const typeDescriptions = translations.selection?.typeDescriptions ?? {};

  const matrixConfig: MatrixConfig = {
    columns: BASE_LOCATION_TYPES.map((type) => {
      const name = translations.locationTypes?.[type.id] ?? type.id;
      const description = typeDescriptions[type.id as keyof typeof typeDescriptions] ?? name;
      return {
        id: type.id,
        label: name,
        description,
        type: 'custom',
        width: 140,
        icon: type.icon,
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
  const typeIndex = useMemo(
    () => new Map(BASE_LOCATION_TYPES.map((type, index) => [type.id, index])),
    [],
  );

  const hasSelection = useMemo(() => (
    Object.values(selectionByCountries).some((row) => Array.isArray(row) && row.some(Boolean))
  ), [selectionByCountries]);

  const hasAvailability = useMemo(
    () => Object.keys(availabilityByCountry).length > 0,
    [availabilityByCountry],
  );

  useEffect(() => {
    if (draft.dataSource !== 'ide-gsm') return;
    const sources = ideGsmSources.filter((source) => source.tabularSourceId);
    if (sources.length === 0) return;
    if (parseInFlightRef.current) return;
    if (hasSelection && hasAvailability) return;
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
        if (!hasSelection) {
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
    hasSelection,
    ideGsmSources,
    onUpdate,
    selectionByCountries,
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
        iso.countries.map(c=>c.code),
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

  if (iso.status === 'loading') {
    return (
      <Box>
        <Alert severity="info">{t('selection.loadingCountries', 'Loading countries...')}</Alert>
      </Box>
    );
  }

  if (iso.status === 'error') {
    const message = 'message' in iso ? iso.message : '';
    return (
      <Box>
        <Alert severity="error">
          {t('selection.loadError', 'Failed to load country list')}: {message}
        </Alert>
      </Box>
    );
  }

  if (iso.status !== 'ready' || iso.countries.length === 0) {
    return (
      <Box>
        <Alert severity="warning">
          {t('selection.emptyCountries', 'No countries available. Please try again later.')}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <CountryMatrixSelector
        countries={iso.countries}
        matrixConfig={matrixConfig}
        selections={currentSelections}
        onSelectionsChange={applySelections}
        showRowSelection
        showAlphabetIndex
        showRegionIndex
        rowHeight={40}
        isCellEnabled={isCellEnabled}
        height="100%"
        maxHeight={undefined}
      />
    </Box>
  );
};

export const LocationSelectionStep: React.FC<LocationSelectionStepProps> = (props) => {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={
        <Box sx={{ height: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>
            {t('auth.loading', 'Checking authentication...')}
          </Typography>
        </Box>
      }
    >
      <AuthReadyGate>
        <LocationSelectionContent {...props} />
      </AuthReadyGate>
    </Suspense>
  );
};
