import { useCallback, useMemo } from 'react';
import { useId } from 'react';
import { DEFAULT_BUILD_CONFIG, applyBuildConfigPatch } from '~/common/types/index';
import type { NodeId } from '@hierarchidb/core-types';
import type { ShapeBuildConfig, ShapeBuildConfigPatch } from '~/common/types/index';
import { useTranslation } from '~/ui/i18n';
import { useShapeBuildCacheActions } from './useShapeBuildCacheActions.ts';

type Args = {
  config: ShapeBuildConfig;
  nodeId: NodeId;
  disabled?: boolean;
  onChange: (next: ShapeBuildConfig | ((prev: ShapeBuildConfig) => ShapeBuildConfig)) => void;
  onResetSession?: () => void;
};

export const useSourceConfigSection = ({ config, nodeId, disabled, onChange, onResetSession }: Args) => {
  const { t } = useTranslation();
  const switchId = useId();
  const baseSourceConfig = config.sourceConfig;

  const {
    counts,
    resultCounts,
    countsLoading,
    deleteLoading,
    canDeleteSourceApiCache,
    canDeleteSourceFilteredCache,
    canDeleteGeometryCache,
    canDeleteTileEmitCache,
    canDeleteMetadata,
    handleDeleteSourceApiCache,
    handleDeleteSourceFilteredCache,
    handleDeleteGeometryCache,
    handleDeleteTileEmitCache,
    handleDeleteMetadata,
  } = useShapeBuildCacheActions({ nodeId, disabled, onResetSession });

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
  const sourceApiDeleteCount = counts.sourceApi;
  const sourceFilteredDeleteCount = counts.sourceFiltered;
  const geometryDeleteCount = counts.geometry;
  const tileEmitDeleteCount = counts.tileEmit;
  const metadataDeleteCount = resultCounts.featureMetadata;
  const deleteSourceApiLabel = useMemo(() => (
    formatDeleteLabelI18n(
      'processing.download.deleteApiCacheWithCount',
      t('processing.download.deleteApiCache', 'Delete API cache'),
      sourceApiDeleteCount,
    )
  ), [sourceApiDeleteCount, formatDeleteLabelI18n, t]);
  const deleteSourceFilteredLabel = useMemo(() => (
    formatDeleteLabelI18n(
      'processing.download.deleteFilteredCacheWithCount',
      t('processing.download.deleteFilteredCache', 'Delete filtered cache'),
      sourceFilteredDeleteCount,
    )
  ), [sourceFilteredDeleteCount, formatDeleteLabelI18n, t]);
  const deleteGeometryLabel = useMemo(() => (
    formatDeleteLabelI18n(
      'processing.download.deleteStage1CacheWithCount',
      t('processing.download.deleteStage1Cache', 'Delete simplified cache'),
      geometryDeleteCount,
    )
  ), [formatDeleteLabelI18n, t, geometryDeleteCount]);
  const deleteTileEmitLabel = useMemo(() => (
    formatDeleteLabel(
      t('processing.download.deleteTiles', 'Delete tile data'),
      tileEmitDeleteCount,
    )
  ), [formatDeleteLabel, t, tileEmitDeleteCount]);
  const deleteMetadataLabel = useMemo(() => (
    formatDeleteLabel(t('processing.download.deleteMetadata', 'Delete feature metadata'), metadataDeleteCount)
  ), [formatDeleteLabel, metadataDeleteCount, t]);

  const update = useCallback((partial: ShapeBuildConfigPatch) => {
    onChange((prevConfig) => applyBuildConfigPatch(prevConfig, partial));
  }, [onChange]);

  const handleResetDefaults = useCallback(() => {
    onChange((prevConfig) => ({
      ...DEFAULT_BUILD_CONFIG,
      dataSourceName: prevConfig.dataSourceName,
    }));
  }, [onChange]);

  return {
    t,
    switchId,
    baseSourceConfig,
    deleteSourceApiLabel,
    deleteSourceFilteredLabel,
    deleteGeometryCacheLabel: deleteGeometryLabel,
    deleteTileEmitLabel,
    deleteMetadataLabel,
    countsLoading,
    deleteSourceApiLoading: deleteLoading.sourceApi,
    deleteSourceFilteredLoading: deleteLoading.sourceFiltered,
    deleteGeometryLoading: deleteLoading.geometry,
    deleteTileEmitLoading: deleteLoading.tileEmit,
    deleteMetadataLoading: deleteLoading.metadata,
    canDeleteSourceApiCache,
    canDeleteSourceFilteredCache,
    canDeleteGeometryCache,
    canDeleteTileEmitCache,
    canDeleteMetadata,
    handleDeleteSourceApiCache,
    handleDeleteSourceFilteredCache,
    handleDeleteGeometryCache,
    handleDeleteTileEmitCache,
    handleDeleteMetadata,
    handleResetDefaults,
    update,
  };
};

export type SourceConfigSectionState = ReturnType<typeof useSourceConfigSection>;
