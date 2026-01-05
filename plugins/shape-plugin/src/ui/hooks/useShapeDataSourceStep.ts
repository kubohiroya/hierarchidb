import { useCallback, useMemo } from 'react';
import type { DataSourceSelectionOption } from '@hierarchidb/ui-datasource';
import type { DataSourceConfig, DataSourceName, ShapeEntity } from '../../common/types/index.js';
import { DEFAULT_PROCESSING_CONFIG } from '../../common/types/index.js';
import { normalizeDataSourceName } from '../../services/utils/utils.js';
import { DATA_SOURCE_CONFIGS } from '../../common/mock/data.js';
import { clearStagesIfPresent, FULL_INVALIDATION_STAGES, resolveShapeNodeId } from '../utils/sessionInvalidation.js';

type Args = {
  data: Partial<ShapeEntity>;
  onChange: (patch: Partial<ShapeEntity>) => void;
};

export const useShapeDataSourceStep = ({ data, onChange }: Args) => {
  const draftData = data ?? {};
  const sources = Object.values(DATA_SOURCE_CONFIGS) as DataSourceConfig[];
  const options: DataSourceSelectionOption[] = useMemo(
    () => sources.map((source) => ({
      id: source.name,
      name: source.displayName,
      description: source.description,
      icon: source.icon,
      licenseName: source.license,
      licenseUrl: source.licenseUrl,
      attribution: source.attribution,
      disabled: source.name === 'openstreetmap',
    })),
    [sources],
  );

  const normalizedValue = normalizeDataSourceName(draftData.batchConfig?.dataSource);
  const dataSourceId = normalizedValue;

  const handleChange = useCallback((next: {
    dataSourceId?: string;
    licenseAgreement?: boolean;
    licenseAgreedAt?: string;
  }) => {
    const updates: Partial<typeof draftData> = {};
    if (typeof next.dataSourceId !== 'undefined') {
      const nextSource = next.dataSourceId as DataSourceName | undefined;
      if (nextSource && nextSource !== draftData.batchConfig?.dataSource) {
        const nodeId = resolveShapeNodeId(draftData);
        if (nodeId) {
          void clearStagesIfPresent(nodeId, FULL_INVALIDATION_STAGES);
        }
      }
      updates.batchConfig = {
        ...(draftData.batchConfig ?? {}),
        dataSource: nextSource,
        cleanupConfig: {
          ...(DEFAULT_PROCESSING_CONFIG.cleanupConfig ?? {}),
          ...(draftData.batchConfig?.cleanupConfig ?? {}),
        },
      };
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
