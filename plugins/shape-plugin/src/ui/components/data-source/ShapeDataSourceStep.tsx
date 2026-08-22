import { DataSourceSelectionStep } from '@hierarchidb/ui-datasource';
import { useTranslation } from '@hierarchidb/ui-i18n';
import { Box, Button } from '@mui/material';
import type React from 'react';
import type { ShapeDialogStepProps } from '~/ui/components/ShapeDialogStepProps';
import { useShapeDataSourceStep } from './useShapeDataSourceStep.js';
import { useShapeDataSourceStepView } from './useShapeDataSourceStepView.js';

/**
 * Data Source Selection step for Shape plugin
 */
export const ShapeDataSourceStep: React.FC<ShapeDialogStepProps> = ({
  data,
  onChange,
  nodeId,
  disabled,
}) => {
  const draftData = data ?? {};
  const { options, dataSourceId, handleChange } = useShapeDataSourceStep({
    data: draftData,
    onChange,
  });
  const { t } = useTranslation('shape-plugin');
  const { isClearing, handleClearCache } = useShapeDataSourceStepView({ dataSourceId, nodeId, t });

  return (
    <Box sx={{ p: 3 }}>
      <DataSourceSelectionStep<string>
        title={String(t('dataSource.title', 'Data Source'))}
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
          'Choose a geographic data provider. Each source has different coverage, accuracy, and licensing requirements.'
        )}
        createAgreedAt={() => new Date().toISOString()}
        selectionTitle={String(t('dataSource.selectionTitle', 'Data Source'))}
        detailsTitle={String(t('dataSource.detailsTitle', 'Data Source Details'))}
      />
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
        <Button
          variant="outlined"
          onClick={handleClearCache}
          disabled={Boolean(disabled || !dataSourceId || isClearing)}
        >
          {t('dataSource.clearCache', 'Clear cache for selected data source')}
        </Button>
      </Box>
    </Box>
  );
};
