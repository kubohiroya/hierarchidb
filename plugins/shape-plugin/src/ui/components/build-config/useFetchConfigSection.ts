import { useCallback, useMemo } from 'react';
import { useId } from 'react';
import type { ShapeEntity } from '../../../common/types/index.js';
import { DEFAULT_BUILD_CONFIG, mergeBuildConfig } from '../../../common/types/index.js';
import type { NodeId } from '@hierarchidb/core-types';
import type { ShapeBuildConfig } from '../../../common/types/index.js';
import { useTranslation } from '../../i18n.js';
import { useShapeBuildCacheActions } from './useShapeBuildCacheActions.ts';

type Args = {
  config: ShapeBuildConfig;
  nodeId: NodeId;
  draft: Partial<ShapeEntity>;
  disabled?: boolean;
  onChange: (next: ShapeBuildConfig) => void;
  onResetSession?: () => void;
};

export const useFetchConfigSection = ({ config, nodeId, draft, disabled, onChange, onResetSession }: Args) => {
  const { t } = useTranslation();
  const switchId = useId();
  const baseFetchConfig = config.fetchConfig;

  const {
    counts,
    resultCounts,
    countsLoading,
    deleteLoading,
    canDeleteFetchApiCache,
    canDeleteFetchFilteredCache,
    canDeleteTransformCache,
    canDeleteVTCache,
    canDeleteMetadata,
    handleDeleteFetchApiCache,
    handleDeleteFetchFilteredCache,
    handleDeleteTransformCache,
    handleDeleteVTCache,
    handleDeleteMetadata,
  } = useShapeBuildCacheActions({ nodeId, draft, disabled, onResetSession });

  const countUnit = t('processing.download.countUnit', '');
  const formatDeleteLabel = useCallback((label: string, count: number, unit = '') => (
    count > 0 ? `${label} (${count}${unit})` : label
  ), []);
  const formatDeleteLabelI18n = useCallback((key: string, fallback: string, count: number) => (
    count > 0
      ? t(key, '{{label}} ({{count}}{{unit}})', {
        label: fallback,
        count,
        unit: countUnit,
      })
      : fallback
  ), [countUnit, t]);
  const fetchApiDeleteCount = counts.fetchApi;
  const fetchFilteredDeleteCount = counts.fetchFiltered;
  const transformDeleteCount = counts.transform;
  const vtDeleteCount = counts.vt;
  const metadataDeleteCount = resultCounts.featureMetadata;
  const deleteFetchApiLabel = useMemo(() => (
    formatDeleteLabelI18n(
      'processing.download.deleteApiCacheWithCount',
      t('processing.download.deleteApiCache', 'Delete API cache'),
      fetchApiDeleteCount,
    )
  ), [fetchApiDeleteCount, formatDeleteLabelI18n, t]);
  const deleteFetchFilteredLabel = useMemo(() => (
    formatDeleteLabelI18n(
      'processing.download.deleteFilteredCacheWithCount',
      t('processing.download.deleteFilteredCache', 'Delete filtered cache'),
      fetchFilteredDeleteCount,
    )
  ), [fetchFilteredDeleteCount, formatDeleteLabelI18n, t]);
  const deleteTransformLabel = useMemo(() => (
    formatDeleteLabelI18n(
      'processing.download.deleteStage1CacheWithCount',
      t('processing.download.deleteStage1Cache', 'Delete simplified cache'),
      transformDeleteCount,
    )
  ), [formatDeleteLabelI18n, t, transformDeleteCount]);
  const deleteVTLabel = useMemo(() => (
    formatDeleteLabel(
      t('processing.download.deleteTiles', 'Delete tile data'),
      vtDeleteCount,
    )
  ), [formatDeleteLabel, t, vtDeleteCount]);
  const deleteMetadataLabel = useMemo(() => (
    formatDeleteLabel(t('processing.download.deleteMetadata', 'Delete feature metadata'), metadataDeleteCount)
  ), [formatDeleteLabel, metadataDeleteCount, t]);

  const update = useCallback((partial: Partial<ShapeBuildConfig>) => {
    onChange(mergeBuildConfig(config, partial));
  }, [config, onChange]);

  const handleResetDefaults = useCallback(() => {
    onChange({
      ...DEFAULT_BUILD_CONFIG,
      dataSourceName: config.dataSourceName,
    });
  }, [config.dataSourceName, onChange]);

  return {
    t,
    switchId,
    baseFetchConfig: baseFetchConfig,
    deleteFetchApiLabel,
    deleteFetchFilteredLabel,
    deleteTransformFilterLabel: deleteTransformLabel,
    deleteVTLabel,
    deleteMetadataLabel,
    countsLoading,
    deleteFetchApiLoading: deleteLoading.fetchApi,
    deleteFetchFilteredLoading: deleteLoading.fetchFiltered,
    deleteTransformLoading: deleteLoading.transform,
    deleteVTLoading: deleteLoading.vt,
    deleteMetadataLoading: deleteLoading.metadata,
    canDeleteFetchApiCache,
    canDeleteFetchFilteredCache,
    canDeleteTransformCache,
    canDeleteVTCache,
    canDeleteMetadata,
    handleDeleteFetchApiCache,
    handleDeleteFetchFilteredCache,
    handleDeleteTransformCache,
    handleDeleteVTCache,
    handleDeleteMetadata,
    handleResetDefaults,
    update,
  };
};

export type FetchConfigSectionState = ReturnType<typeof useFetchConfigSection>;
