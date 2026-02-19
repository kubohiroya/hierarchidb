import { useCallback, useEffect, useMemo } from 'react';
import type { DataSourceSelectionOption } from '@hierarchidb/ui-datasource';
import { useIsoCountries } from '@hierarchidb/ui-country-select';
import type { DataSourceConfig, DataSourceName, ShapeEntity } from '~/common/types/index';
import { mergeBuildConfig, mergeProcessingConfig } from '~/services/utils/utils';
import {
  DEFAULT_BUILD_CONFIG,
  DEFAULT_PROCESSING_CONFIG,
  SHAPE_DATA_SOURCE_BY_NAME,
  SHAPE_DATA_SOURCES,
} from '~/common/types/index';

type Args = {
  data: Partial<ShapeEntity>;
  onChange: (patch: Partial<ShapeEntity>) => void;
};

export const useShapeDataSourceStep = ({ data, onChange }: Args) => {
  const draftData = data ?? {};
  const sources = SHAPE_DATA_SOURCES as DataSourceConfig[];
  const options: DataSourceSelectionOption[] = useMemo(
    () => sources.map((source) => ({
      id: source.name,
      name: source.displayName,
      description: source.description,
      icon: source.icon,
      licenseName: source.license,
      licenseUrl: source.licenseUrl,
      attribution: source.attribution,
    })),
    [sources],
  );

  const dataSourceId = draftData.buildConfig?.dataSourceName;
  const iso = useIsoCountries();
  const maxAdminLevel = useMemo(() => {
    if (!dataSourceId) return 0;
    return SHAPE_DATA_SOURCE_BY_NAME[dataSourceId]?.maxAdminLevel ?? 0;
  }, [dataSourceId]);

  useEffect(() => {
    const hasBuildConfig = Boolean(draftData.buildConfig);
    const hasProcessingConfig = Boolean(draftData.processingConfig);
    if (dataSourceId && hasBuildConfig && hasProcessingConfig) return;

    const nextBuildConfig = draftData.buildConfig
      ? mergeBuildConfig(draftData.buildConfig, {
        dataSourceName: dataSourceId ?? DEFAULT_BUILD_CONFIG.dataSourceName,
      })
      : { ...DEFAULT_BUILD_CONFIG };
    const nextProcessingConfig = draftData.processingConfig
      ? mergeProcessingConfig(DEFAULT_PROCESSING_CONFIG, draftData.processingConfig)
      : { ...DEFAULT_PROCESSING_CONFIG };

    onChange({
      buildConfig: nextBuildConfig,
      processingConfig: nextProcessingConfig,
    });
  }, [dataSourceId, draftData.buildConfig, draftData.processingConfig, onChange]);

  useEffect(() => {
    const existingSelection = draftData.selectedArrayByCountries;
    if (!dataSourceId) return;
    if (existingSelection && !Array.isArray(existingSelection)) return;
    if (iso.status !== 'ready') return;
    if (iso.countries.length === 0) return;
    const nextSelection: Record<string, boolean[]> = {};
    iso.countries.forEach((country) => {
      nextSelection[country.code] = Array.from(
        { length: maxAdminLevel + 1 },
        (_, idx) => idx === 0,
      );
    });
    onChange({ selectedArrayByCountries: nextSelection });
  }, [dataSourceId, draftData.selectedArrayByCountries, iso, maxAdminLevel, onChange]);

  const handleChange = useCallback((next: {
    dataSourceId?: string;
    licenseAgreement?: boolean;
    licenseAgreedAt?: string;
  }) => {
    const updates: Partial<typeof draftData> = {};
    if (typeof next.dataSourceId !== 'undefined') {
      const nextSource = next.dataSourceId as DataSourceName;
      updates.buildConfig = draftData.buildConfig
        ? mergeBuildConfig(draftData.buildConfig, { dataSourceName: nextSource })
        : { ...DEFAULT_BUILD_CONFIG, dataSourceName: nextSource };
      updates.processingConfig = draftData.processingConfig
        ? mergeProcessingConfig(DEFAULT_PROCESSING_CONFIG, draftData.processingConfig)
        : { ...DEFAULT_PROCESSING_CONFIG };
    }
    if (typeof next.licenseAgreement !== 'undefined') {
      updates.licenseAgreement = next.licenseAgreement;
    }
    if (typeof next.licenseAgreedAt !== 'undefined') {
      updates.licenseAgreedAt = next.licenseAgreedAt;
    }
    if (Object.keys(updates).length) {
      onChange(updates);
    }
  }, [draftData, onChange]);

  return {
    options,
    dataSourceId,
    handleChange,
  };
};
