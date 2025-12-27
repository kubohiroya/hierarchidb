import { useCallback, useMemo } from 'react';
import type { DataSourceSelectionOption } from '@hierarchidb/ui-datasource';
import type { DataSourceConfig, DataSourceName, ShapeEntity } from '../../common/types/index.js';
import { normalizeDataSourceName } from '../../services/utils/utils.js';
import { DATA_SOURCE_CONFIGS } from '../../common/mock/data.js';
import { clearStagesIfPresent, FULL_INVALIDATION_STAGES, resolveShapeSessionId } from '../utils/sessionInvalidation.js';

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
      disabled: source.name !== 'geoboundaries',
    })),
    [sources],
  );

  const normalizedValue = normalizeDataSourceName(
    draftData.batchConfig?.dataSource ?? draftData.dataSourceName,
  );
  const defaultGeoBoundaries = options.find((option) => option.id === 'geoboundaries')?.id;
  const fallbackValue = (defaultGeoBoundaries ?? options[0]?.id) as DataSourceName | undefined;
  const dataSourceId = normalizedValue ?? fallbackValue ?? options[0]?.id ?? 'openstreetmap';

  const handleChange = useCallback((next: {
    dataSourceId?: string;
    licenseAgreement?: boolean;
    licenseAgreedAt?: string;
  }) => {
    const updates: Partial<typeof draftData> = {};
    if (typeof next.dataSourceId !== 'undefined') {
      const nextSource = (next.dataSourceId as DataSourceName | undefined) ?? fallbackValue;
      if (nextSource && nextSource !== draftData.batchConfig?.dataSource) {
        const sessionId = resolveShapeSessionId(draftData);
        if (sessionId) {
          void clearStagesIfPresent(sessionId, FULL_INVALIDATION_STAGES);
        }
      }
      updates.batchConfig = {
        ...(draftData.batchConfig ?? {}),
        dataSource: nextSource,
      };
      updates.dataSourceName = nextSource;
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
  }, [draftData, fallbackValue, onChange]);

  return {
    options,
    dataSourceId,
    handleChange,
  };
};
