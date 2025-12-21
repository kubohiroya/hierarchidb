import type React from 'react';
import { Box, Typography } from '@mui/material';
import {
  DataSourceWithLicense,
  type DataSourceWithLicenseOption,
} from '@hierarchidb/ui-datasource';
import type {
  DataSourceConfig,
  DataSourceName,
} from '../../../common/types/index.js';
import { normalizeDataSourceName } from '../../../services/utils/utils.js';
import { DATA_SOURCE_CONFIGS } from '../../../common/mock/data.js';
import type { ShapeDialogStepProps } from './ShapeDialogStepProps.ts';
import { clearStagesIfPresent, FULL_INVALIDATION_STAGES, resolveShapeSessionId } from '../../utils/sessionInvalidation.js';


/**
 * Data Source Selection step for Shape plugin
 */
export const ShapeDataSourceStep: React.FC<ShapeDialogStepProps> = ({ data, onChange }) => {
  const draftData = data ?? {};
  const sources = Object.values(DATA_SOURCE_CONFIGS) as DataSourceConfig[];
  const options: DataSourceWithLicenseOption[] = sources.map((source) => ({
    id: source.name,
    name: source.displayName,
    description: source.description,
    icon: source.icon,
    licenseName: source.license,
    licenseUrl: source.licenseUrl,
    attribution: source.attribution,
  }));

  const normalizedValue = normalizeDataSourceName(draftData.dataSourceName);
  const defaultGeoBoundaries = options.find((option) => option.id === 'geoboundaries')?.id;
  const fallbackValue = (defaultGeoBoundaries ?? options[0]?.id) as DataSourceName | undefined;
  const dataSourceId = normalizedValue ?? fallbackValue ?? options[0]?.id ?? 'openstreetmap';

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Select Data Source
      </Typography>

      <Box sx={{ mt: 3 }}>
        <DataSourceWithLicense<string>
          options={options}
          state={{
            dataSourceId,
            licenseAgreement: Boolean(draftData.licenseAgreement),
            licenseAgreedAt: draftData.licenseAgreedAt,
          }}
          onChange={(next) => {
            const updates: Partial<typeof draftData> = {};
            if (typeof next.dataSourceId !== 'undefined') {
              const nextSource = (next.dataSourceId as DataSourceName | undefined) ?? fallbackValue;
              if (nextSource && nextSource !== draftData.dataSourceName) {
                const sessionId = resolveShapeSessionId(draftData);
                if (sessionId) {
                  void clearStagesIfPresent(sessionId, FULL_INVALIDATION_STAGES);
                }
              }
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
          }}
          licenseRequired={false}
          description={
            <Typography variant="body2" color="text.secondary" paragraph>
              Choose a geographic data provider. Each source has different coverage, accuracy, and
              licensing requirements.
            </Typography>
          }
          createAgreedAt={() => new Date().toISOString()}
        />
      </Box>
    </Box>
  );
};
