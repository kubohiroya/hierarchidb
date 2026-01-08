import type React from 'react';
import { useCallback, useState } from 'react';
import { Box, Button } from '@mui/material';
import { notify } from '@hierarchidb/components';
import { DataSourceSelectionStep } from '@hierarchidb/ui-datasource';
import type { ShapeDialogStepProps } from './ShapeDialogStepProps.ts';
import { useShapeDataSourceStep } from '../../hooks/useShapeDataSourceStep.js';
import { useTranslation } from '../../i18n.js';
import { clearShapeDataSourceCache } from '../../utils/clearDataSourceCache.js';
import { toNodeId } from '@hierarchidb/common-types';


/**
 * Data Source Selection step for Shape plugin
 */
export const ShapeDataSourceStep: React.FC<ShapeDialogStepProps> = ({ data, onChange, nodeId, disabled }) => {
  const draftData = data ?? {};
  const { options, dataSourceId, handleChange } = useShapeDataSourceStep({ data: draftData, onChange });
  const { t } = useTranslation();
  const [isClearing, setIsClearing] = useState(false);
  const resolvedNodeId = nodeId ? toNodeId(String(nodeId)) : undefined;

  const handleClearCache = useCallback(async () => {
    if (!resolvedNodeId) {
      notify.warning(t('dataSource.cacheMissingNode', 'NodeId is missing.'));
      return;
    }
    if (!dataSourceId) {
      notify.warning(t('dataSource.cacheMissing', 'Select a data source first.'));
      return;
    }
    try {
      setIsClearing(true);
      await clearShapeDataSourceCache(resolvedNodeId, dataSourceId);
      notify.success(t('dataSource.cacheCleared', 'Cleared cache for selected data source.'));
    } catch (error) {
      console.error('[shape] failed to clear data source cache', error);
      notify.error(t('dataSource.cacheClearFailed', 'Failed to clear data source cache.'));
    } finally {
      setIsClearing(false);
    }
  }, [dataSourceId, nodeId, t]);

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
