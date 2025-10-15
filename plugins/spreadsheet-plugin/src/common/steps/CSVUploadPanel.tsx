import { useCallback, useMemo, useState } from 'react';
import type { FC } from 'react';
import { Alert, Box, Typography } from '@mui/material';
import type { CSVProcessingConfig, CSVTableMetadata } from '@hierarchidb/ui-csv-extract';
import { FileInputWithUrl } from '@hierarchidb/ui-file';
import { createSpreadsheetCSVApi } from '../ui/facade/index.js';
import { PLUGIN_METADATA } from '../extension/constants.js';

export interface CSVUploadResult {
  metadata: CSVTableMetadata;
  origin: 'file' | 'url';
  file?: File;
  source?: string;
}

export interface CSVUploadPanelProps {
  pluginId?: string;
  acceptedFileTypes?: readonly string[];
  maxFileSize?: number;
  disabled?: boolean;
  onUploaded: (result: CSVUploadResult) => void;
  onError: (msg: string) => void;
}

export const CSVUploadPanel: FC<CSVUploadPanelProps> = ({
  pluginId = PLUGIN_METADATA.NODE_TYPE,
  acceptedFileTypes,
  maxFileSize,
  disabled,
  onUploaded,
  onError,
}) => {
  const api = useMemo(() => createSpreadsheetCSVApi(pluginId), [pluginId]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastDownloadUrl, setLastDownloadUrl] = useState<string | undefined>();

  const accept = useMemo(() => (
    acceptedFileTypes && acceptedFileTypes.length > 0
      ? acceptedFileTypes.join(',')
      : '.csv,.tsv,.xlsx,.xls'
  ), [acceptedFileTypes]);

  const handleUploadSuccess = useCallback((meta: CSVTableMetadata, origin: 'file' | 'url', file?: File, source?: string) => {
    setError(null);
    onUploaded({ metadata: meta, origin, file, source });
  }, [onUploaded]);

  const handleFailure = useCallback((reason: unknown) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    setError(message);
    onError(message);
  }, [onError]);

  const guardFileSize = useCallback((file: File) => {
    if (typeof maxFileSize === 'number' && maxFileSize > 0 && file.size > maxFileSize) {
      throw new Error(`File size exceeds the limit (${Math.round(maxFileSize / (1024 * 1024))}MB)`);
    }
  }, [maxFileSize]);

  const handleFileSelect = useCallback(async (file: File, downloadUrl?: string) => {
    try {
      guardFileSize(file);
      setLoading(true);
      setLastDownloadUrl(downloadUrl);
      const metadata = await api.uploadCSVFile(file, {} as CSVProcessingConfig);
      handleUploadSuccess(metadata, downloadUrl ? 'url' : 'file', file, downloadUrl ?? metadata.fileUrl ?? metadata.filename);
    } catch (err) {
      handleFailure(err);
    } finally {
      setLoading(false);
    }
  }, [api, guardFileSize, handleFailure, handleUploadSuccess]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <FileInputWithUrl
        onFileSelect={handleFileSelect}
        accept={accept}
        loading={loading}
        error={error ?? undefined}
        disabled={disabled}
        showUrlDownload
        buttonLabel="Select file"
        layout="horizontal"
      />
      {lastDownloadUrl && (
        <Typography variant="caption" color="text.secondary">
          Source: {lastDownloadUrl}
        </Typography>
      )}
      {error && (
        <Alert severity="error" data-testid="csv-upload-error">
          {error}
        </Alert>
      )}
    </Box>
  );
};
