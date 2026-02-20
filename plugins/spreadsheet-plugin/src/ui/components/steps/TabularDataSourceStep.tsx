import type { FC } from 'react';
import type { PluginStepProps } from '@hierarchidb/plugin-base';
import { TabularProvider, TabularDataImport } from '@hierarchidb/ui-tabular';
import type { TabularDataResult } from '@hierarchidb/ui-tabular';
import type { TabularTableMetadata } from '@hierarchidb/tabular-store';
import type { SpreadsheetDraft } from '~/common/types/SpreadsheetEntity';
import { Accordion, AccordionDetails, AccordionSummary, Box, Paper, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import TableChartIcon from '@mui/icons-material/TableChart';
import { useTranslation } from '@hierarchidb/ui-i18n';
import { type UseTabularDataSourceResult, useTabularDataSource } from '~/ui/hooks/useTabularDataSource';
import { TabularPreviewGrid } from '@hierarchidb/ui-tabular';
import { useAtomValue } from 'jotai';
import { tabularRowsAtom } from '~/ui/state/tabularKeyValueAtoms';

const TabularDataImportStep = TabularDataImport as unknown as React.FC<UseTabularDataSourceResult['importStepProps']>;

export const TabularDataSourceStep: FC<PluginStepProps<SpreadsheetDraft> & { showPreview?: boolean }> = ({
  data,
  onChange,
  setValid,
  setError,
  dialogRef,
  nodeId,
  showPreview = true,
}) => {
  const { t } = useTranslation('spreadsheet-plugin');
  const previewRows = useAtomValue(tabularRowsAtom);
  const { dialogData, tabularApi, importAccordion, detailsAccordion, hasMetadata, importStepProps, formatBytes, details } =
    useTabularDataSource({
      data,
      onChange,
      setValid,
      setError,
      nodeId,
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
          <TabularDataImportStep {...importStepProps} />
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

      {showPreview && previewRows.length ? (
        <Accordion defaultExpanded sx={{ mt: 1 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TableChartIcon fontSize="small" color="action" />
              <Typography variant="subtitle1">
                {t('dataSource.preview.title', 'Preview')}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Paper variant="outlined" sx={{ height: 320 }}>
              <TabularPreviewGrid
                rows={previewRows}
                columns={extractColumnNames(dialogData.lastPreview, dialogData.tabularTableMetadata)}
                height={320}
              />
            </Paper>
          </AccordionDetails>
        </Accordion>
      ) : null}
    </TabularProvider>
  );
};

const isNamedColumn = (value: unknown): value is { name: string } =>
  typeof value === 'object' && value !== null && 'name' in value && typeof (value as { name: unknown }).name === 'string';

const extractColumnNames = (
  lastPreview?: TabularDataResult,
  metadata?: TabularTableMetadata,
): string[] => {
  const names: string[] = [];
  const previewColumns = lastPreview?.columns;
  if (Array.isArray(previewColumns)) {
    for (const col of previewColumns) {
      if (typeof col === 'string') {
        names.push(col);
      } else if (isNamedColumn(col)) {
        names.push(col.name);
      }
    }
  }

  if (!names.length && Array.isArray(metadata?.columns)) {
    for (const col of metadata!.columns) {
      if (typeof col === 'string') {
        names.push(col);
      } else if (isNamedColumn(col)) {
        names.push(col.name);
      }
    }
  }

  return names.filter((name) => name.length > 0);
};
