/**
 * RouteSelectionStep - Step 3 of route creation dialog.
 * Selects route modes per country, aligned with LocationSelectionStep UI.
 */

import type React from 'react';
import { Suspense, useCallback, useEffect, useMemo, useRef } from 'react';
import { Alert, Box, CircularProgress, Typography } from '@mui/material';
import type { SvgIconComponent } from '@mui/icons-material';
import { DirectionsBoat, DirectionsCar, Flight, Speed, Train } from '@mui/icons-material';
import type { RouteEntity, RouteUpdaterPayload } from '../../../common/entities/RouteEntity.js';
import { useTranslation } from '../../../common/i18n/index.js';
import { getRouteUpdaterPayload } from '../../../common/utils/draft.js';
import { CountryMatrixSelector, useIsoCountries, type MatrixConfig, type MatrixSelection } from '@hierarchidb/ui-country-select';
import { ROUTE_MODES, type RouteMode } from '@hierarchidb/route-store';
import { AuthReadyGate } from '@hierarchidb/ui-auth';

export interface RouteSelectionStepProps {
  draft: RouteUpdaterPayload;
  onUpdate: (updates: Partial<RouteEntity>) => void;
  onValidationChange: (isValid: boolean) => void;
  mode: 'create' | 'edit';
  nodeId?: string;
  parentId?: string;
}

type SelectionColumn = {
  id: RouteMode;
  labelKey: string;
  icon: SvgIconComponent;
};

const ROUTE_MODE_COLUMNS: SelectionColumn[] = [
  { id: ROUTE_MODES.AIRWAY, labelKey: 'transportModes.air', icon: Flight },
  { id: ROUTE_MODES.WATERWAY, labelKey: 'transportModes.sea', icon: DirectionsBoat },
  { id: ROUTE_MODES.H_RAILWAY, labelKey: 'transportModes.highSpeedRail', icon: Speed },
  { id: ROUTE_MODES.RAILWAY, labelKey: 'transportModes.rail', icon: Train },
  { id: ROUTE_MODES.ROAD, labelKey: 'transportModes.road', icon: DirectionsCar },
];

type ModePolicy = {
  allowedModes: RouteMode[];
  defaultChecked: Set<RouteMode> | null;
};

const resolveModePolicy = (source?: string | null): ModePolicy => {
  switch (source) {
    case 'openflights':
      return { allowedModes: [ROUTE_MODES.AIRWAY], defaultChecked: new Set([ROUTE_MODES.AIRWAY]) };
    case 'searoute':
    case 'searoute-js':
    case 'naturalearth-rivers':
      return { allowedModes: [ROUTE_MODES.WATERWAY], defaultChecked: new Set([ROUTE_MODES.WATERWAY]) };
    case 'openstreetmap':
      return { allowedModes: [ROUTE_MODES.ROAD], defaultChecked: new Set([ROUTE_MODES.ROAD]) };
    case 'transitland':
      return { allowedModes: [ROUTE_MODES.H_RAILWAY, ROUTE_MODES.RAILWAY], defaultChecked: new Set([ROUTE_MODES.H_RAILWAY, ROUTE_MODES.RAILWAY]) };
    case 'ide-gsm':
    case 'custom':
    default:
      return { allowedModes: ROUTE_MODE_COLUMNS.map((col) => col.id), defaultChecked: null };
  }
};

const RouteSelectionContent: React.FC<RouteSelectionStepProps> = ({
  draft: draftProp,
  onUpdate,
  onValidationChange,
  mode: _mode,
  nodeId: _nodeId,
  parentId: _parentId,
}) => {
  const { t, translations } = useTranslation();
  const iso = useIsoCountries();
  const draft = useMemo(() => getRouteUpdaterPayload(draftProp), [draftProp]);
  const dataSourceName = draft.dataSourceName ?? null;
  const policy = useMemo(() => resolveModePolicy(dataSourceName), [dataSourceName]);
  const allowedModeSet = useMemo(() => new Set(policy.allowedModes), [policy.allowedModes]);
  const lastDataSourceRef = useRef<string | null>(dataSourceName);

  const emitUpdate = useCallback(
    (updates: Partial<RouteEntity>) => {
      onUpdate({
        ...updates,
      });
    },
    [onUpdate],
  );

  const selectionByCountries = useMemo(() => draft.selectedArrayByCountries ?? {}, [draft.selectedArrayByCountries]);

  const matrixConfig: MatrixConfig = useMemo(() => ({
    columns: ROUTE_MODE_COLUMNS.map((mode) => ({
      id: mode.id,
      label: t(mode.labelKey, mode.id),
      description: t(mode.labelKey, mode.id),
      type: 'custom',
      width: 150,
      icon: mode.icon,
    })),
    virtualization: {
      rowHeight: 40,
      overscan: 8,
    },
  }), [t]);

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

  const selectionMatrixSource = useMemo(() => {
    if (iso.status !== 'ready') return [];
    return iso.countries.map((country) => selectionByCountries[country.code] ?? []);
  }, [iso, selectionByCountries]);

  const selectionRecordSource = useMemo(() => {
    if (iso.status !== 'ready') return {};
    return selectionByCountries;
  }, [iso, selectionByCountries]);

  const currentSelections: MatrixSelection[] = useMemo(() => {
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

  const normalizeSelectionRecord = useCallback((applyDefaults: boolean) => {
    if (iso.status !== 'ready') return {};
    const normalized: Record<string, boolean[]> = {};
    const defaultChecked = applyDefaults ? policy.defaultChecked : null;
    iso.countries.forEach((country) => {
      const row = selectionByCountries[country.code] ?? [];
      normalized[country.code] = matrixConfig.columns.map((col, colIdx) => {
        if (!allowedModeSet.has(col.id as RouteMode)) return false;
        if (defaultChecked) return defaultChecked.has(col.id as RouteMode);
        return Boolean(row[colIdx]);
      });
    });
    return normalized;
  }, [allowedModeSet, iso.countries, iso.status, matrixConfig.columns, policy.defaultChecked, selectionByCountries]);

  const hasAnySelection = useMemo(() => {
    if (iso.status !== 'ready') return false;
    return iso.countries.some((country) => {
      const row = selectionByCountries[country.code] ?? [];
      return row.some(Boolean);
    });
  }, [iso.countries, iso.status, selectionByCountries]);

  useEffect(() => {
    if (iso.status !== 'ready') return;
    const dataSourceChanged = lastDataSourceRef.current !== dataSourceName;
    if (dataSourceChanged) {
      lastDataSourceRef.current = dataSourceName;
    }
    const shouldApplyDefaults = Boolean(policy.defaultChecked && (dataSourceChanged || !hasAnySelection));
    const normalized = normalizeSelectionRecord(shouldApplyDefaults);
    if (!deepEqualSelectionRecord(selectionRecordSource, normalized)) {
      emitUpdate({ selectedArrayByCountries: normalized });
    }
  }, [
    dataSourceName,
    deepEqualSelectionRecord,
    emitUpdate,
    hasAnySelection,
    iso.status,
    normalizeSelectionRecord,
    policy.defaultChecked,
    selectionRecordSource,
  ]);

  const applySelections = useCallback(
    (nextSelections: MatrixSelection[]) => {
      if (iso.status !== 'ready') return;
      const normalized: Record<string, boolean[]> = {};
      iso.countries.forEach((country) => {
        const entry = nextSelections.find((sel) => sel.countryCode === country.code);
        const selections = entry?.selections ?? {};
        normalized[country.code] = matrixConfig.columns.map((col) => {
          const allowed = allowedModeSet.has(col.id as RouteMode);
          return allowed ? Boolean(selections[col.id]) : false;
        });
      });
      if (!deepEqualSelectionRecord(selectionRecordSource, normalized)) {
        emitUpdate({ selectedArrayByCountries: normalized });
      }
    },
    [allowedModeSet, deepEqualSelectionRecord, emitUpdate, iso.countries, iso.status, matrixConfig.columns, selectionRecordSource],
  );

  useEffect(() => {
    const isValid = hasAnySelection;
    onValidationChange(isValid);
  }, [hasAnySelection, onValidationChange]);

  if (iso.status === 'loading') {
    return (
      <Box>
        <Alert severity="info">{t('routeConfig.loadingCountries', 'Loading countries...')}</Alert>
      </Box>
    );
  }

  if (iso.status === 'error') {
    const message = 'message' in iso ? iso.message : '';
    return (
      <Box>
        <Alert severity="error">
          {t('routeConfig.loadError', 'Failed to load country list')}: {message}
        </Alert>
      </Box>
    );
  }

  if (iso.status !== 'ready' || iso.countries.length === 0) {
    return (
      <Box>
        <Alert severity="warning">
          {t('routeConfig.emptyCountries', 'No countries available. Please try again later.')}
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
        showAlphabetIndex
        showRegionIndex
        rowHeight={40}
        isCellEnabled={(_, columnId) => allowedModeSet.has(columnId as RouteMode)}
        height="100%"
        maxHeight={undefined}
      />
      {policy.defaultChecked && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
          {t('routeConfig.defaultSelectionNote', 'Default selections are applied based on the data source.')}
        </Typography>
      )}
      {translations && dataSourceName && !policy.defaultChecked && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
          {t('routeConfig.customSelectionNote', 'Choose the route modes to fetch for each country.')}
        </Typography>
      )}
    </Box>
  );
};

export const RouteSelectionStep: React.FC<RouteSelectionStepProps> = (props) => {
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
        <RouteSelectionContent {...props} />
      </AuthReadyGate>
    </Suspense>
  );
};
