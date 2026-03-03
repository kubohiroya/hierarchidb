import { useEffect, useMemo } from 'react';
import { useDialogContext } from '@hierarchidb/ui-dialog';
import { getBuildWorkerBridge, type BuildWorkerBridge } from '@hierarchidb/ui-worker-client';
import {
  type DataSourceName,
  isDataSourceName,
  SHAPE_DATA_SOURCE_BY_NAME,
} from '~/common/types/index';
import type { MatrixConfig, MatrixSelection } from '@hierarchidb/ui-country-select';
import type { Country } from '@hierarchidb/ui-country-select';
import { invalidateBuildForSelectionChange } from './invalidateBuildForSelectionChange.js';
import { useShapeCountrySelectionStepDataLoader } from './useShapeCountrySelectionStepDataLoader.js';
import { useShapeCountrySelectionStepSelectionState } from './useShapeCountrySelectionStepSelectionState.js';
import type { NodeId } from '@hierarchidb/core-types';
import type { ShapeEntity } from '~/common/types/index';
import { type SerializedCountryAvailability } from '~/ui/workers/countryAvailability.types';
import type { CountrySelectionIsoState } from './useShapeCountrySelectionStepSelectionState.js';

type Args = {
  data: Partial<ShapeEntity>;
  onChange: (patch: Partial<ShapeEntity>) => void;
  nodeId: NodeId;
};

type CountrySelectionAvailabilityInfo = SerializedCountryAvailability | null;
type CountrySelectionState = {
  loading: boolean;
  error: Error | null;
  availabilityInfo: CountrySelectionAvailabilityInfo;
  matrixConfig: MatrixConfig;
  countries: Country[];
  selections: MatrixSelection[];
  applySelections: (nextSelections: MatrixSelection[]) => void;
  isCellEnabled: (countryCode: string, columnId: string) => boolean;
  reloadAll: () => Promise<void>;
};

const EMPTY_RESPONSE = {
  loading: false,
  error: null as Error | null,
  availabilityInfo: null as CountrySelectionAvailabilityInfo,
  matrixConfig: { columns: [], virtualization: { rowHeight: 40, overscan: 8 } },
  countries: [] as Country[],
  selections: [] as MatrixSelection[],
  applySelections: () => {},
  isCellEnabled: () => false,
  reloadAll: async () => {},
} satisfies CountrySelectionState;

const useDataSourceState = (data: Partial<ShapeEntity>) => {
  return useMemo(() => {
    const anyData = data as Record<string, unknown>;
    const hasData = Boolean(anyData && typeof anyData === 'object' && Object.keys(anyData).length > 0);
    const draftData = (anyData && typeof anyData === 'object' && 'draftData' in anyData)
      ? (anyData as { draftData?: unknown }).draftData as Record<string, unknown> | undefined
      : undefined;
    const buildConfig = (anyData && typeof anyData === 'object' && 'buildConfig' in anyData)
      ? (anyData as { buildConfig?: unknown }).buildConfig as Record<string, unknown> | undefined
      : undefined;
    const dsFromEntity = isDataSourceName(buildConfig?.dataSourceName) ? buildConfig.dataSourceName : undefined;
    const dsFromDraft = (() => {
      const bc = draftData?.buildConfig;
      if (!bc || typeof bc !== 'object') return undefined;
      const value = (bc as Record<string, unknown>).dataSourceName;
      return isDataSourceName(value) ? value : undefined;
    })();
    const candidate = dsFromDraft ?? dsFromEntity;
    const hasBatchConfig = Boolean(draftData?.buildConfig && typeof draftData.buildConfig === 'object');
    if (!candidate) {
      if (hasData && hasBatchConfig) {
        console.warn('[shape-plugin][country-selection] dataSource missing', {
          draftDataKeys: draftData ? Object.keys(draftData) : null,
        });
        return {
          dataSourceKey: undefined as undefined | DataSourceName,
          dataSourceError: new Error('Data source is not set. Please go back to Data Source selection.'),
        };
      }
      return { dataSourceKey: undefined as undefined | DataSourceName, dataSourceError: null as Error | null };
    }
    return { dataSourceKey: candidate as DataSourceName, dataSourceError: null as Error | null };
  }, [data]);
};

export const useShapeCountrySelectionStep = ({ data, onChange, nodeId }: Args): CountrySelectionState => {
  const { onStepNavigate } = useDialogContext<Partial<ShapeEntity>>();
  const bridgeRef = useMemo<BuildWorkerBridge>(() => getBuildWorkerBridge(), []);

  const { dataSourceKey, dataSourceError } = useDataSourceState(data);
  useEffect(() => {
    if (dataSourceError) {
      onStepNavigate({ type: 'direct', targetIndex: 1 });
    }
  }, [dataSourceError, onStepNavigate]);

  const resolvedMaxAdminLevel = useMemo(() => {
    if (!dataSourceKey) return 0;
    return SHAPE_DATA_SOURCE_BY_NAME[dataSourceKey]?.maxAdminLevel ?? 0;
  }, [dataSourceKey]);

  const loader = useShapeCountrySelectionStepDataLoader({
    dataSourceKey,
    nodeId,
  });
  const selection = useShapeCountrySelectionStepSelectionState({
    nodeId,
    countries: loader.countries,
    availability: loader.availability,
    selectedArrayByCountries: data.selectedArrayByCountries,
    resolvedMaxAdminLevel,
    iso: ((): CountrySelectionIsoState | undefined => {
      const source = loader.iso as {
        status?: string;
        countries?: Country[];
        message?: string;
      };
      if (!source || typeof source.status !== 'string') {
        return undefined;
      }
      if (source.status === 'ready') {
        return {
          status: 'ready',
          countries: Array.isArray(source.countries) ? source.countries : [],
        };
      }
      if (source.status === 'loading') {
        return {
          status: 'loading',
          countries: [],
        };
      }
      if (source.status === 'error') {
        return {
          status: 'error',
          countries: [],
          message: typeof source.message === 'string' ? source.message : undefined,
        };
      }
      return undefined;
    })(),
    onChange: onChange as (patch: Partial<Record<string, unknown>>) => void,
    onInvalidate: (prev, next) => invalidateBuildForSelectionChange({
      bridgeRef,
      nodeId,
      prev,
      nextSelection: next,
    }),
  });

  const error = dataSourceError ?? loader.availabilityError ?? loader.metadataError;
  const combinedLoading = loader.metadataLoading || (loader.availabilityLoading && !loader.availability);
  if (!dataSourceKey) {
    return EMPTY_RESPONSE;
  }

  return {
    loading: Boolean(dataSourceKey) && combinedLoading,
    error,
    availabilityInfo: loader.availability ?? null,
    matrixConfig: selection.matrixConfig,
    countries: selection.countries,
    selections: selection.selections,
    applySelections: selection.applySelections,
    isCellEnabled: selection.isCellEnabled,
    reloadAll: async () => {
      await loader.reloadAll();
      return;
    },
  };
};

export type { CountrySelectionState };
