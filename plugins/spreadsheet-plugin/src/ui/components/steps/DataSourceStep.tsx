import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FC } from 'react';
import { StepComponentProps } from '@hierarchidb/plugin-base';
import { TabularProvider, TabularFileImportStep, type TabularProcessingConfig, type TabularFileImportStepProps } from '@hierarchidb/ui-tabular-extract';
import type { TabularTableMetadata } from '@hierarchidb/tabular-store';
import { createSpreadsheetTabularApi } from '../../../services/spreadsheetTabularApiFactory.js';
import { SPREADSHEET_NODE_TYPE } from '../../../common/constants.js';
import type { SpreadSheetDataSourceConfig, SpreadsheetEntity } from '../../../common/types/SpreadsheetEntity.js';
import { Accordion, AccordionDetails, AccordionSummary, Box, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import { useTranslation } from '@hierarchidb/ui-i18n';

const coerceDialogData = (value: unknown): SpreadsheetEntity =>
  (typeof value === 'object' && value !== null ? (value as SpreadsheetEntity) : {});

const formatBytes = (value?: number | null): string => {
  const bytes = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
};

type ExtendedImportProps = TabularFileImportStepProps & {
  initialProcessingConfig?: TabularProcessingConfig;
  onProcessingConfigChange?: (config: TabularProcessingConfig) => void;
};

const ImportStep = TabularFileImportStep as unknown as React.FC<ExtendedImportProps>;

export const DataSourceStep: FC<StepComponentProps<SpreadsheetEntity>> = ({
  data,
  onChange,
  setValid,
  setError,
  dialogRef,
}) => {
  const { t } = useTranslation('spreadsheet-plugin');
  const dialogData = useMemo<SpreadsheetEntity>(() => coerceDialogData(data), [data]);
  const [localError, setLocalError] = useState<string | null>(null);
  const tabularApi = useMemo(() => createSpreadsheetTabularApi(SPREADSHEET_NODE_TYPE), []);
  const derivedImportMethod: 'file' | 'url' =
    dialogData.dataSource?.type === 'url' || dialogData.dataSource?.source?.startsWith('http') ? 'url' : 'file';
  const derivedUrl = dialogData.dataSource?.source ?? '';
  const derivedProcessing = dialogData.tabularProcessingConfig;

  const [importMethod, setImportMethod] = useState<'file' | 'url'>(derivedImportMethod);
  const [downloadUrl, setDownloadUrl] = useState(derivedUrl);
  const [lastSuccessfulUrl, setLastSuccessfulUrl] = useState<string | null>(() => {
    const source = dialogData.dataSource?.source ?? null;
    const hasMetadata = Boolean(dialogData.spreadsheetMetadataId && source);
    const sourceLooksLikeUrl = source?.startsWith('http');
    const persistedAsUrl = dialogData.dataSource?.type === 'url' || derivedImportMethod === 'url';
    return hasMetadata && (persistedAsUrl || sourceLooksLikeUrl) ? source : null;
  });
  const [processingConfig, setProcessingConfig] = useState<TabularProcessingConfig | undefined>(derivedProcessing);
  const importSucceeded = Boolean(lastSuccessfulUrl && lastSuccessfulUrl === downloadUrl);
  const hasMetadata = Boolean(dialogData.spreadsheetMetadataId);
  const [importExpanded, setImportExpanded] = useState<boolean>(() => !hasMetadata);
  const [detailsExpanded, setDetailsExpanded] = useState<boolean>(() => hasMetadata);

  const applyMetadata = useCallback(
    (tabularTableMetadata: TabularTableMetadata) => {
      const nextDataSource: SpreadSheetDataSourceConfig = {
        type: importMethod,
        source: importMethod === 'url' ? downloadUrl : (tabularTableMetadata.fileUrl ?? tabularTableMetadata.filename),
        filename: tabularTableMetadata.filename,
        sizeBytes: tabularTableMetadata.fileSizeBytes ?? 0,
        contentHash: tabularTableMetadata.contentHash,
      };
      onChange({
        ...dialogData,
        spreadsheetMetadataId: tabularTableMetadata.id,
        dataSource: nextDataSource,
        tabularTableMetadata: tabularTableMetadata,
        file: {
          name: tabularTableMetadata.filename,
          sizeBytes: tabularTableMetadata.fileSizeBytes ?? 0,
          lastModifiedAt: Date.now(),
        },
        tabularProcessingConfig: processingConfig,
      });
      if (importMethod === 'url') {
        setLastSuccessfulUrl(downloadUrl);
      }
      setImportExpanded(false);
      setDetailsExpanded(true);
      setLocalError(null);
      setValid(true);
      setError(null);
    },
    [dialogData, onChange, setError, setValid, importMethod, downloadUrl, processingConfig],
  );

  const handleUploadError = useCallback(
    (message: string) => {
      setLocalError(message);
      setValid(false);
      setError(message);
    },
    [setError, setValid],
  );

  useEffect(() => {
    setValid(hasMetadata);
    if (!hasMetadata && !localError) {
      setError(t('dataSource.errors.missingDataset', 'Upload or select a dataset before continuing.'));
    } else if (hasMetadata) {
      setError(null);
    }
    setImportExpanded(!hasMetadata);
    setDetailsExpanded(hasMetadata);
  }, [dialogData.spreadsheetMetadataId, hasMetadata, localError, setError, setValid, t]);

  const menuContainer =
    dialogRef?.current instanceof HTMLElement
      ? dialogRef.current.closest('.MuiModal-root') ?? dialogRef.current
      : null;

  // backfill initial defaults into entity if missing
  useEffect(() => {
    const needsBackfill = dialogData.tabularProcessingConfig === undefined;
    if (!needsBackfill) return;
    onChange({
      ...dialogData,
      tabularProcessingConfig: processingConfig ?? {
        delimiter: ',',
        encoding: 'utf-8',
        hasHeader: true,
        quoteChar: '"',
        escapeChar: '\\',
        skipEmptyLines: true,
      },
    });
  }, [dialogData, onChange, processingConfig]);

  return (
    <TabularProvider tabularApi={tabularApi}>
      <Accordion expanded={importExpanded} onChange={(_, expanded) => setImportExpanded(expanded)}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <InsertDriveFileIcon fontSize="small" color="action" />
            <Typography variant="subtitle1">
              {t('dataSource.import.title', 'Import Tabular Data')}
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <ImportStep
            pluginId={SPREADSHEET_NODE_TYPE}
            onFileImported={applyMetadata}
            onError={handleUploadError}
            menuContainer={menuContainer}
            initialImportMethod={derivedImportMethod}
            initialUrl={downloadUrl}
            initialProcessingConfig={processingConfig}
            onImportMethodChange={(method: 'file' | 'url') => {
              setImportMethod(method);
              onChange({
                ...dialogData,
                dataSource: {
                  ...(dialogData.dataSource ?? { type: method }),
                  type: method,
                },
              });
            }}
            onUrlChange={(url: string) => {
              setDownloadUrl(url);
              if (lastSuccessfulUrl && url !== lastSuccessfulUrl) {
                setLastSuccessfulUrl(null);
              }
              onChange({
                ...dialogData,
                dataSource: {
                  ...(dialogData.dataSource ?? { type: 'url' }),
                  type: 'url',
                  source: url,
                },
              });
            }}
            onProcessingConfigChange={(cfg: TabularProcessingConfig) => {
              setProcessingConfig(cfg);
              onChange({ ...dialogData, tabularProcessingConfig: cfg });
            }}
            importSucceeded={importSucceeded}
          />
        </AccordionDetails>
      </Accordion>

      <Accordion expanded={detailsExpanded} onChange={(_, expanded) => setDetailsExpanded(expanded)} sx={{ mt: 1 }}>
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
                  value: dialogData.dataSource.filename ?? dialogData.tabularTableMetadata?.filename ?? '—',
                })}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('dataSource.details.size', 'size: {{value}}', {
                  value: formatBytes(
                    dialogData.dataSource.sizeBytes ?? dialogData.tabularTableMetadata?.fileSizeBytes
                  ),
                })}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('dataSource.details.lastModified', 'lastModified: {{value}}', {
                  value: dialogData.tabularTableMetadata?.createdAt
                    ? new Date(dialogData.tabularTableMetadata.createdAt).toLocaleString()
                    : '—',
                })}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                {t('dataSource.details.contentHash', 'contentHash: {{value}}', {
                  value: dialogData.dataSource.contentHash ?? dialogData.tabularTableMetadata?.contentHash ?? '—',
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
