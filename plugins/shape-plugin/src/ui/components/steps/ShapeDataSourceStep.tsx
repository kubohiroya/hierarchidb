import type React from 'react';
import { Box } from '@mui/material';
import { DataSourceSelectionStep } from '@hierarchidb/ui-datasource';
import type { ShapeDialogStepProps } from './ShapeDialogStepProps.ts';
import { useShapeDataSourceStep } from '../../hooks/useShapeDataSourceStep.js';
import { useTranslation } from '../../i18n.js';


/**
 * Data Source Selection step for Shape plugin
 */
export const ShapeDataSourceStep: React.FC<ShapeDialogStepProps> = ({ data, onChange }) => {
  const draftData = data ?? {};
  const { options, dataSourceId, handleChange } = useShapeDataSourceStep({ data: draftData, onChange });
  const { t } = useTranslation();

  return (
    <Box sx={{ p: 3 }}>
      <DataSourceSelectionStep<string>
        title={t('dataSource.title', 'Data Source')}
        options={options}
        state={{
          dataSourceId,
          licenseAgreement: Boolean(draftData.licenseAgreement),
          licenseAgreedAt: draftData.licenseAgreedAt,
        }}
        onChange={handleChange}
        licenseRequired={false}
        description={t(
          'dataSource.description',
          'Choose a geographic data provider. Each source has different coverage, accuracy, and licensing requirements.',
        )}
        createAgreedAt={() => new Date().toISOString()}
        selectionTitle={t('dataSource.selectionTitle', 'Data Source')}
        detailsTitle={t('dataSource.detailsTitle', 'Data Source Details')}
      />
    </Box>
  );
};
