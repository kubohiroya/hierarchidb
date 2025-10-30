import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FC, SyntheticEvent } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Divider,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  Button,
  Chip,
  CircularProgress,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ArticleIcon from '@mui/icons-material/Article';
import { useTranslation } from 'react-i18next';
import { DATA_SOURCE_TYPES, SUPPORTED_FILE_EXTENSIONS, FILE_SIZE_LIMITS, PLUGIN_METADATA, type DataSourceType } from '../../../common/extension/constants.js';
import { CSVUploadPanel, type CSVUploadResult } from './CSVUploadPanel.js';
import { createSpreadsheetCSVApi } from '../../../services/SpreadsheetCSVApiAdapter.js';
// import { DataSourceConfig } from '@hierarchidb/common-types';
import { DataSourceConfig, FileInfo } from '../../../common/extension/types.js';
import { CSVTableMetadata } from '@hierarchidb/tabular-store';
import { StepComponentProps } from '@hierarchidb/plugin-base';

const DATA_SOURCE_TAB_FILE = 'file';
const DATA_SOURCE_TAB_MANUAL = 'manual';

export interface SpreadsheetDialogData {
  spreadsheetMetadataId?: string;
  dataSource?: DataSourceConfig;
  file?: FileInfo;
  [key: string]: unknown;
}

type SpreadsheetStepData = SpreadsheetDialogData;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const toFileInfo = (file: File | FileInfo | undefined): FileInfo | undefined => {
  if (!file) return undefined;
  if (file instanceof File) {
    return {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
    };
  }
  return file;
};

const formatNumber = (value: number | undefined) => new Intl.NumberFormat('en-US').format(value ?? 0);

const buildDataSourceConfig = (
  type: DataSourceType,
  previous: DataSourceConfig | undefined,
  overrides: Partial<DataSourceConfig> = {},
): DataSourceConfig => ({
  type,
  delimiter: previous?.delimiter,
  hasHeader: previous?.hasHeader ?? true,
  ...overrides,
});

export const isDataSourceComplete = (data: Partial<SpreadsheetDialogData> | undefined): boolean => {
  const ds = data?.dataSource;
  if (!ds) return false;
  switch (ds.type) {
    case DATA_SOURCE_TYPES.FILE:
      return Boolean(data?.spreadsheetMetadataId);
    case DATA_SOURCE_TYPES.URL:
      return Boolean(ds.source && data?.spreadsheetMetadataId);
    case DATA_SOURCE_TYPES.MANUAL:
      return Boolean(ds.source && ds.source.trim().length > 0);
    default:
      return false;
  }
};

const defaultManualPlaceholder = `id,name,value\n1,Sample,123`;

export const DataSourceStep: FC<StepComponentProps> = ({
  data,
  onChange,
  setValid,
  setError,
}) => {
  const { t } = useTranslation('spreadsheet-plugin');
  const pluginData = useMemo<SpreadsheetStepData>(() => (
    isRecord(data) ? { ...(data as SpreadsheetDialogData) } : {}
  ), [data]);

  const [activeTab, setActiveTab] = useState<string>(
    pluginData.dataSource?.type === DATA_SOURCE_TYPES.MANUAL ? DATA_SOURCE_TAB_MANUAL : DATA_SOURCE_TAB_FILE,
  );
  const [metadataPreview, setMetadataPreview] = useState<CSVTableMetadata | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [manualContent, setManualContent] = useState<string>(
    pluginData.dataSource?.type === DATA_SOURCE_TYPES.MANUAL ? (pluginData.dataSource?.source ?? '') : '',
  );
  const [metadataLoading, setMetadataLoading] = useState(false);

  const api = useMemo(() => createSpreadsheetCSVApi(PLUGIN_METADATA.NODE_TYPE), []);

  const applyDataSource = useCallback((config: DataSourceConfig, meta?: CSVTableMetadata, file?: FileInfo) => {
    const next: SpreadsheetStepData = {
      ...pluginData,
      dataSource: config,
      spreadsheetMetadataId: meta?.id ?? (config.type === DATA_SOURCE_TYPES.MANUAL ? undefined : pluginData.spreadsheetMetadataId),
      file,
    };
    onChange(next);
  }, [pluginData, onChange]);

  useEffect(() => {
    const valid = isDataSourceComplete(pluginData);
    setValid(valid);
    if (!valid) {
      setError(t('dataSource.validation.required', 'Select a data source.'));
    } else if (!uploadError) {
      setError(null);
    }
  }, [pluginData, setValid, setError, t, uploadError]);

  useEffect(() => {
    if (pluginData.dataSource?.type === DATA_SOURCE_TYPES.MANUAL) {
      setManualContent(pluginData.dataSource.source ?? '');
      setActiveTab(DATA_SOURCE_TAB_MANUAL);
    }
  }, [pluginData.dataSource]);

  useEffect(() => {
    let cancelled = false;

    async function loadMetadata() {
      const metadataId = pluginData.spreadsheetMetadataId;
      if (!metadataId) {
        setMetadataPreview(null);
        return;
      }
      setMetadataLoading(true);
      try {
        const meta = await api.getTableMetadata(metadataId);
        if (!cancelled) {
          setMetadataPreview(meta ?? null);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('[DataSourceStep] Failed to load metadata', err);
        }
      } finally {
        if (!cancelled) {
          setMetadataLoading(false);
        }
      }
    }

    loadMetadata();
    return () => {
      cancelled = true;
    };
  }, [api, pluginData.spreadsheetMetadataId]);

  const handleUploadSuccess = useCallback((result: CSVUploadResult) => {
    setUploadError(null);
    const { metadata, origin, file, source } = result;
    setMetadataPreview(metadata);
    const type: DataSourceType = origin === 'url' ? DATA_SOURCE_TYPES.URL : DATA_SOURCE_TYPES.FILE;
    const config = buildDataSourceConfig(type, pluginData.dataSource, {
      source: source ?? metadata.fileUrl ?? metadata.filename,
    });
    applyDataSource(config, metadata, toFileInfo(file) ?? pluginData.file);
    setActiveTab(DATA_SOURCE_TAB_FILE);
    setError(null);
  }, [applyDataSource, pluginData.dataSource, pluginData.file, setError]);

  const handleUploadError = useCallback((message: string) => {
    setUploadError(message);
    setError(message);
  }, [setError]);

  const handleManualChange = useCallback((event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = event.target.value;
    setManualContent(value);
    const config = buildDataSourceConfig(DATA_SOURCE_TYPES.MANUAL, pluginData.dataSource, { source: value });
    const next: SpreadsheetStepData = {
      ...pluginData,
      dataSource: config,
      spreadsheetMetadataId: undefined,
      file: undefined,
    };
    onChange(next);
    setMetadataPreview(null);
  }, [pluginData, onChange]);

  const handleClearSelection = useCallback(() => {
    setMetadataPreview(null);
    const next: SpreadsheetStepData = {
      ...pluginData,
      dataSource: undefined,
      spreadsheetMetadataId: undefined,
      file: undefined,
    };
    onChange(next);
    setActiveTab(DATA_SOURCE_TAB_FILE);
  }, [pluginData, onChange]);

  const rowsPreview = metadataPreview?.totalRows;
  const columnCount = metadataPreview?.columns?.length;

  return (
    <Stack spacing={3} sx={{ minHeight: '100%' }}>
      <Box>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CloudUploadIcon fontSize="small" />
          {t('dataSource.title', 'Select data source')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('dataSource.description', 'Upload a CSV file, download from an external URL, or enter data manually.')}
        </Typography>
      </Box>

      <Tabs
        value={activeTab}
        onChange={(_: SyntheticEvent, value: string) => setActiveTab(value)}
        aria-label="data source mode selector"
      >
        <Tab value={DATA_SOURCE_TAB_FILE} label={t('dataSource.mode.upload', 'File / URL')} />
        <Tab value={DATA_SOURCE_TAB_MANUAL} label={t('dataSource.mode.manual', 'Manual input')} icon={<ArticleIcon fontSize="small" />} iconPosition="start" />
      </Tabs>

      {activeTab === DATA_SOURCE_TAB_FILE && (
        <CSVUploadPanel
          onUploaded={handleUploadSuccess}
          onError={handleUploadError}
          disabled={false}
          acceptedFileTypes={SUPPORTED_FILE_EXTENSIONS}
          maxFileSize={FILE_SIZE_LIMITS.MAX_SIZE_BYTES}
        />
      )}

      {activeTab === DATA_SOURCE_TAB_MANUAL && (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="subtitle1">
                {t('dataSource.manual.heading', 'Paste data manually')}
              </Typography>
              <TextField
                value={manualContent}
                onChange={handleManualChange}
                placeholder={defaultManualPlaceholder}
                minRows={6}
                multiline
                fullWidth
              />
              <Typography variant="body2" color="text.secondary">
                {t('dataSource.manual.helper', 'Paste CSV formatted text so that it can be shaped in later steps.')}
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      )}

      {(metadataLoading || metadataPreview || pluginData.spreadsheetMetadataId) && (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1}>
              <Typography variant="subtitle1">{t('dataSource.summary.title', 'Selected data')}</Typography>
              {metadataLoading ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <CircularProgress size={16} />
                  <Typography variant="body2">{t('dataSource.summary.loading', 'Loading metadata...')}</Typography>
                </Stack>
              ) : (
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Chip label={t('dataSource.summary.type', 'Type') + ': ' + (pluginData.dataSource?.type ?? '—')} size="small" />
                  {pluginData.dataSource?.source && (
                    <Chip label={pluginData.dataSource.source} size="small" variant="outlined" />
                  )}
                  {rowsPreview !== undefined && (
                    <Chip label={`${t('dataSource.summary.rows', 'Rows')}: ${formatNumber(rowsPreview)}`} size="small" />
                  )}
                  {columnCount !== undefined && (
                    <Chip label={`${t('dataSource.summary.columns', 'Columns')}: ${formatNumber(columnCount)}`} size="small" />
                  )}
                </Stack>
              )}
              <Divider sx={{ my: 1 }} />
              <Stack direction="row" spacing={2}>
                <Button variant="outlined" onClick={handleClearSelection}>
                  {t('dataSource.actions.clear', 'Clear selection')}
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}

      {uploadError && (
        <Alert severity="error">{uploadError}</Alert>
      )}
    </Stack>
  );
};
