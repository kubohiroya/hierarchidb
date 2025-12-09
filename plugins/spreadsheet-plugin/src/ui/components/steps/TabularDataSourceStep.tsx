import type { FC } from 'react';
import { StepComponentProps } from '@hierarchidb/plugin-base';
import { TabularProvider, TabularDataImport } from '@hierarchidb/ui-tabular-extract';
import type { SpreadsheetEntity } from '../../../common/types/SpreadsheetEntity.js';
import { Accordion, AccordionDetails, AccordionSummary, Box, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import { useTranslation } from '@hierarchidb/ui-i18n';
import { type UseTabularDataSourceResult, useTabularDataSource } from '../../hooks/useTabularDataSource.js';

const ImportStep = TabularDataImport as unknown as React.FC<UseTabularDataSourceResult['importStepProps']>;

export const TabularDataSourceStep: FC<StepComponentProps<SpreadsheetEntity>> = ({
  data,
  onChange,
  setValid,
  setError,
  dialogRef,
}) => {
  const { t } = useTranslation('spreadsheet-plugin');
  const { dialogData, tabularApi, importAccordion, detailsAccordion, hasMetadata, importStepProps, formatBytes, details } =
    useTabularDataSource({
      data,
      onChange,
      setValid,
      setError,
      dialogRef,
      missingDatasetMessage: t(
        'dataSource.errors.missingDataset',
        'select or download a data file before continuing.',
      ) as string,
    });

  return (
    <TabularProvider tabularApi={tabularApi}>
      <Accordion expanded={importAccordion.expanded} onChange={importAccordion.onChange}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <InsertDriveFileIcon fontSize="small" color="action" />
            <Typography variant="subtitle1">
              {t('dataSource.import.title', 'Import Tabular Data')}
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <ImportStep {...importStepProps} />
        </AccordionDetails>
      </Accordion>

      <Accordion expanded={detailsAccordion.expanded} onChange={detailsAccordion.onChange} sx={{ mt: 1 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TaskAltIcon fontSize="small" color={hasMetadata ? 'success' : 'disabled'} />
            <Typography variant="subtitle1">
              {t('dataSource.details.title', 'Imported File Details')}
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          {dialogData.spreadsheetMetadataId && dialogData.dataSource ? (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 1.5,
                alignItems: 'center',
              }}
            >
              <Typography variant="body2" color="text.secondary">
                {t('dataSource.details.filename', 'filename: {{value}}', {
                  value: details.filename,
                })}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('dataSource.details.size', 'size: {{value}}', {
                  value: formatBytes(details.sizeBytes ?? null),
                })}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('dataSource.details.lastModified', 'lastModified: {{value}}', {
                  value: details.createdAt ? new Date(details.createdAt).toLocaleString() : '—',
                })}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                {t('dataSource.details.contentHash', 'contentHash: {{value}}', {
                  value: details.contentHash ?? '—',
                })}
              </Typography>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {t('dataSource.details.empty', 'No tabular data')}
            </Typography>
          )}
        </AccordionDetails>
      </Accordion>
    </TabularProvider>
  );
};
