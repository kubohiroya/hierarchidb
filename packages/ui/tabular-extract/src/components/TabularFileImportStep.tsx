/**
 * @file TabularFileImportStep.tsx
 * @description File import interface for Tabular processing
 */

import type React from 'react';
import { useRef, useState, useId } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { CheckCircle, CloudUpload, Download, InsertDriveFile } from '@mui/icons-material';
import type { TabularProcessingConfig } from '../types/index.js';
import { useTabularData } from '../hooks/useTabularData.js';
import { TabularTableMetadata } from '@hierarchidb/tabular-store';
import { ModalSelect } from './ModalSelect.js';

export interface TabularFileImportStepProps {
  onFileImported: (metadata: TabularTableMetadata) => void;
  onError: (error: string) => void;
  disabled?: boolean;
  acceptedFileTypes?: string[];
  maxFileSize?: number; // in bytes
  pluginId: string;
  menuContainer?: Element | null;
  initialImportMethod?: 'file' | 'url';
  initialUrl?: string;
  initialProcessingConfig?: TabularProcessingConfig;
  onProcessingConfigChange?: (config: TabularProcessingConfig) => void;
  onImportMethodChange?: (method: 'file' | 'url') => void;
  onUrlChange?: (url: string) => void;
  downloadSucceeded?: boolean;
}

export const TabularFileImportStep: React.FC<TabularFileImportStepProps> = ({
                                                                      onFileImported,
                                                                      onError,
                                                                      disabled = false,
                                                                      acceptedFileTypes = ['.csv', '.tsv', '.txt'],
                                                                      maxFileSize = 50 * 1024 * 1024, // 50MB default
                                                                      pluginId,
                                                                      menuContainer,
                                                                      initialImportMethod = 'file',
                                                                      initialUrl = '',
                                                                      initialProcessingConfig,
                                                                      onProcessingConfigChange,
                                                                      onImportMethodChange,
                                                                      onUrlChange,
                                                                      downloadSucceeded = false,
                                                                    }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [urlInput, setUrlInput] = useState(initialUrl);
  const [importMethod, setImportMethod] = useState<'file' | 'url'>(initialImportMethod);
  const [processingConfig, setProcessingConfig] = useState<TabularProcessingConfig>(
    initialProcessingConfig ?? {
      delimiter: ',',
      encoding: 'utf-8',
      hasHeader: true,
      quoteChar: '"',
      escapeChar: '\\',
      skipEmptyLines: true,
    }
  );

  const {
    importTabularFile,
    downloadTabularFromUrl,
    isImporting,
    imortError,
  } = useTabularData({
    pluginId,
    onImportSuccess: onFileImported,
    onImportError: onError,
  });
  const idPrefix = useId();
  const importMethodLabelId = `${idPrefix}-import-method`;
  const delimiterLabelId = `${idPrefix}-delimiter`;
  const encodingLabelId = `${idPrefix}-encoding`;
  const quoteLabelId = `${idPrefix}-quote-char`;
  const headerLabelId = `${idPrefix}-has-header`;
  const skipEmptyLabelId = `${idPrefix}-skip-empty-lines`;
  const modalRoot = menuContainer ?? null;
  const showDownloadSuccess = importMethod === 'url' && downloadSucceeded;

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!acceptedFileTypes.includes(fileExtension)) {
      onError(`Unsupported file type: ${fileExtension}. Accepted types: ${acceptedFileTypes.join(', ')}`);
      return;
    }

    // Validate file size
    if (file.size > maxFileSize) {
      onError(`File size (${Math.round(file.size / 1024 / 1024)}MB) exceeds maximum allowed size (${Math.round(maxFileSize / 1024 / 1024)}MB)`);
      return;
    }

    importTabularFile(file, processingConfig);
  };

  const handleUrlDownload = () => {
    if (!urlInput.trim()) {
      onError('Please enter a valid URL');
      return;
    }

    try {
      new URL(urlInput); // Validate URL format
      downloadTabularFromUrl(urlInput, processingConfig);
    } catch {
      onError('Invalid URL format');
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Import Tabular Data
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
      Choose a file or provide a URL to import tabular data.
    </Typography>

    {/* Import Method Selection */}
  <FormControl sx={{ mb: 3, minWidth: 200 }}>
    <InputLabel id={importMethodLabelId}>Import Method</InputLabel>
    <ModalSelect
      id={`${importMethodLabelId}-select`}
      labelId={importMethodLabelId}
      value={importMethod}
      label="Import Method"
      onChange={(e) => {
        const method = e.target.value as 'file' | 'url';
        setImportMethod(method);
        onImportMethodChange?.(method);
      }}
      disabled={disabled || isImporting}
      menuContainer={modalRoot}
    >
        <MenuItem value="file">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <InsertDriveFile fontSize="small" />
            Local File
          </Box>
        </MenuItem>
        <MenuItem value="url">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Download fontSize="small" />
            URL Download
          </Box>
        </MenuItem>
      </ModalSelect>
      </FormControl>

      {/* File Import Section */}
      {importMethod === 'file' && (
        <Paper
          variant="outlined"
          sx={{
            p: 3,
            mb: 3,
            border: '2px dashed',
            borderColor: 'divider',
            textAlign: 'center',
            cursor: disabled || isImporting ? 'not-allowed' : 'pointer',
            '&:hover': disabled || isImporting ? {} : {
              borderColor: 'primary.main',
              bgcolor: 'action.hover',
            },
          }}
            onClick={disabled || isImporting ? undefined : handleImportClick}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedFileTypes.join(',')}
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            disabled={disabled || isImporting}
          />

          <CloudUpload sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />

          <Typography variant="h6" gutterBottom>
            {isImporting ? 'Processing...' : 'Click to select a file'}
          </Typography>

          <Typography variant="body2" color="text.secondary">
            Supported formats: {acceptedFileTypes.join(', ')}
            <br />
            Maximum size: {Math.round(maxFileSize / 1024 / 1024)}MB
          </Typography>

          {isImporting && (
            <Box sx={{ mt: 2 }}>
              <CircularProgress size={24} />
            </Box>
          )}
        </Paper>
      )}

      {/* URL Download Section */}
      {importMethod === 'url' && (
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            label="Tabular File URL"
            placeholder="https://example.com/data.csv"
          value={urlInput}
          onChange={(e) => {
            setUrlInput(e.target.value);
            onUrlChange?.(e.target.value);
          }}
          disabled={disabled || isImporting}
          sx={{ mb: 2 }}
        />

          <Button
            variant="contained"
            startIcon={isImporting ? <CircularProgress size={16} /> : <Download />}
            endIcon={showDownloadSuccess ? <CheckCircle color="success" /> : undefined}
            onClick={handleUrlDownload}
            disabled={disabled || isImporting || !urlInput.trim()}
          >
            {isImporting ? 'Downloading...' : 'Download Tabular'}
          </Button>
        </Box>
      )}

      <Divider sx={{ my: 3 }} />

      {/* Processing Configuration */}
      <Typography variant="subtitle1" gutterBottom>
        Tabular Processing Options
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mb: 3 }}>
        <FormControl>
          <InputLabel id={delimiterLabelId}>Delimiter</InputLabel>
          <ModalSelect
            id={`${delimiterLabelId}-select`}
            labelId={delimiterLabelId}
            value={processingConfig.delimiter}
            label="Delimiter"
            onChange={(e) => {
              setProcessingConfig(prev => {
                const next = { ...prev, delimiter: e.target.value };
                onProcessingConfigChange?.(next);
                return next;
              });
            }}
            disabled={disabled || isImporting}
            menuContainer={modalRoot}
          >
            <MenuItem value=",">Comma (,)</MenuItem>
            <MenuItem value=";">Semicolon (;)</MenuItem>
            <MenuItem value="\t">Tab</MenuItem>
            <MenuItem value="|">Pipe (|)</MenuItem>
          </ModalSelect>
        </FormControl>

        <FormControl>
          <InputLabel id={encodingLabelId}>Encoding</InputLabel>
          <ModalSelect
            id={`${encodingLabelId}-select`}
            labelId={encodingLabelId}
            value={processingConfig.encoding}
            label="Encoding"
            onChange={(e) => {
              setProcessingConfig(prev => {
                const next = { ...prev, encoding: e.target.value };
                onProcessingConfigChange?.(next);
                return next;
              });
            }}
            disabled={disabled || isImporting}
            menuContainer={modalRoot}
          >
            <MenuItem value="utf-8">UTF-8</MenuItem>
            <MenuItem value="iso-8859-1">ISO-8859-1</MenuItem>
            <MenuItem value="windows-1252">Windows-1252</MenuItem>
          </ModalSelect>
        </FormControl>

        <FormControl>
          <InputLabel id={quoteLabelId}>Quote Character</InputLabel>
          <ModalSelect
            id={`${quoteLabelId}-select`}
            labelId={quoteLabelId}
            value={processingConfig.quoteChar}
            label="Quote Character"
            onChange={(e) => {
              setProcessingConfig(prev => {
                const next = { ...prev, quoteChar: e.target.value };
                onProcessingConfigChange?.(next);
                return next;
              });
            }}
            disabled={disabled || isImporting}
            menuContainer={modalRoot}
          >
            <MenuItem value='"'>Double Quote (")</MenuItem>
            <MenuItem value="'">Single Quote (')</MenuItem>
            <MenuItem value="">None</MenuItem>
          </ModalSelect>
        </FormControl>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <FormControl>
          <InputLabel id={headerLabelId}>Has Header Row</InputLabel>
          <ModalSelect
            id={`${headerLabelId}-select`}
            labelId={headerLabelId}
            value={processingConfig.hasHeader ? 'yes' : 'no'}
            label="Has Header Row"
            onChange={(e) => {
              setProcessingConfig(prev => {
                const next = { ...prev, hasHeader: e.target.value === 'yes' };
                onProcessingConfigChange?.(next);
                return next;
              });
            }}
            disabled={disabled || isImporting}
            menuContainer={modalRoot}
          >
            <MenuItem value="yes">Yes</MenuItem>
            <MenuItem value="no">No</MenuItem>
          </ModalSelect>
        </FormControl>

        <FormControl>
          <InputLabel id={skipEmptyLabelId}>Skip Empty Lines</InputLabel>
          <ModalSelect
            id={`${skipEmptyLabelId}-select`}
            labelId={skipEmptyLabelId}
            value={processingConfig.skipEmptyLines ? 'yes' : 'no'}
            label="Skip Empty Lines"
            onChange={(e) => {
              setProcessingConfig(prev => {
                const next = { ...prev, skipEmptyLines: e.target.value === 'yes' };
                onProcessingConfigChange?.(next);
                return next;
              });
            }}
            disabled={disabled || isImporting}
            menuContainer={modalRoot}
          >
            <MenuItem value="yes">Yes</MenuItem>
            <MenuItem value="no">No</MenuItem>
          </ModalSelect>
        </FormControl>
      </Box>

      {/* Error Display */}
      {imortError && (
        <Alert severity="error" sx={{ mt: 3 }}>
          {imortError}
        </Alert>
      )}
    </Box>
  );
};
