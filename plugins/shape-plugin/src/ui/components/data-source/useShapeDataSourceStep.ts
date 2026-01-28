import { useCallback, useMemo } from 'react';
import type { DataSourceSelectionOption } from '@hierarchidb/ui-datasource';
import type { DataSourceConfig, DataSourceName, ShapeEntity } from '../../../common/types/index.js';
import { mergeBuildConfig } from '../../../services/utils/utils.js';
import { DEFAULT_BUILD_CONFIG, SHAPE_DATA_SOURCES } from '../../../common/types/index.js';

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
