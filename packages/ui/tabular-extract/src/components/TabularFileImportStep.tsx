/**
 * @file TabularFileImportStep.tsx
 * @description File import interface for Tabular processing
 */

import type React from 'react';
import { useEffect, useRef, useState, useId } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  CloudUpload,
  Download,
  DownloadDone,
  Downloading,
  InsertDriveFile,
} from '@mui/icons-material';
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
  importSucceeded?: boolean;
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
                                                                      importSucceeded = false,
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
  const modalRoot = menuContainer ?? null;
  const showDownloadSuccess = importMethod === 'url' && importSucceeded;
  const urlFieldId = `${idPrefix}-tabular-url`;
  const importMethodSelectId = `${importMethodLabelId}-select`;
  const delimiterSelectId = `${delimiterLabelId}-select`;
  const encodingSelectId = `${encodingLabelId}-select`;
  const quoteSelectId = `${quoteLabelId}-select`;

  useEffect(() => {
    setImportMethod(initialImportMethod);
  }, [initialImportMethod]);

  const processFile = (file: File) => {
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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    processFile(file);
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

  const [dragActive, setDragActive] = useState(false);
  const [dragError, setDragError] = useState(false);
  const dragDepthRef = useRef(0);

  const hasFileItems = (dt: DataTransfer | null): boolean => {
    if (!dt) return false;
    if (dt.items && dt.items.length) {
      return Array.from(dt.items).some((item) => item.kind === 'file');
    }
    if (dt.types?.includes?.('Files')) return true;
    if (dt.files && dt.files.length > 0) return true;
    return false;
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    setDragError(false);
    dragDepthRef.current = 0;
    if (disabled || isImporting) return;
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!hasFileItems(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    if (disabled || isImporting) return;
    setDragActive(true);
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    if (!hasFileItems(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    if (disabled || isImporting) return;
    dragDepthRef.current += 1;
    const item = event.dataTransfer?.items?.[0];
    const file = item?.kind === 'file' ? item.getAsFile() : null;
    const name = file?.name || item?.type || '';
    const ext = name.includes('.') ? `.${name.split('.').pop()?.toLowerCase()}` : '';
    const matches = ext !== '' && acceptedFileTypes.includes(ext);
    setDragActive(matches);
    setDragError(!matches);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (!hasFileItems(event.dataTransfer)) {
      setDragActive(false);
      setDragError(false);
      dragDepthRef.current = 0;
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setDragActive(false);
      setDragError(false);
    }
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
        <InputLabel id={importMethodLabelId} htmlFor={importMethodSelectId}>Import Method</InputLabel>
        <ModalSelect
          id={importMethodSelectId}
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
            Local File Import
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
            p: 1.25,
            mb: 2,
            border: '2px dashed',
            borderColor: dragError ? 'error.main' : dragActive ? 'success.main' : 'divider',
            cursor: disabled || isImporting ? 'not-allowed' : 'pointer',
            '&:hover': disabled || isImporting ? {} : {
              borderColor: 'primary.main',
              bgcolor: 'action.hover',
            },
          }}
          onClick={disabled || isImporting ? undefined : handleImportClick}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedFileTypes.join(',')}
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            disabled={disabled || isImporting}
          />

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '48px 1fr',
              gap: 1,
              alignItems: 'center',
            }}
          >
            <CloudUpload sx={{ fontSize: 32, color: 'text.secondary', justifySelf: 'center' }} />
            <Box sx={{ display: 'grid', gap: 0.3, textAlign: 'left' }}>
              <Typography variant="subtitle1">
                {isImporting ? 'Processing...' : 'Click to select a file'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {acceptedFileTypes.join(', ')} · {Math.round(maxFileSize / 1024 / 1024)}MB max
              </Typography>
            </Box>
            {isImporting && (
              <Box sx={{ gridColumn: '1 / span 2', justifySelf: 'start', pl: 0.5 }}>
                <CircularProgress size={18} />
              </Box>
            )}
          </Box>
        </Paper>
      )}

      {/* URL Download Section */}
      {importMethod === 'url' && (
        <Box sx={{ mb: 3 }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <TextField
              fullWidth
              label="Tabular File URL"
              id={urlFieldId}
              name="tabular-file-url"
              placeholder="https://example.com/data.csv"
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value);
                onUrlChange?.(e.target.value);
              }}
              disabled={disabled || isImporting}
            />

            <Button
              variant="contained"
              endIcon={isImporting ? <Downloading /> : showDownloadSuccess ? <DownloadDone /> : <Download />}
              onClick={handleUrlDownload}
              disabled={disabled || isImporting || !urlInput.trim()}
            >
              {isImporting ? 'Downloading...' : 'Download'}
            </Button>
          </Box>
        </Box>
      )}

      <Divider sx={{ my: 3 }} />

      {/* Processing Configuration */}
      <Typography variant="subtitle1" gutterBottom>
        Tabular Processing Options
      </Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 3 }}>
        <FormControl sx={{ minWidth: 180 }}>
          <InputLabel id={delimiterLabelId} htmlFor={delimiterSelectId}>Delimiter</InputLabel>
          <ModalSelect
            id={delimiterSelectId}
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

        <FormControl sx={{ minWidth: 180 }}>
          <InputLabel id={encodingLabelId} htmlFor={encodingSelectId}>Encoding</InputLabel>
          <ModalSelect
            id={encodingSelectId}
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

        <FormControl sx={{ minWidth: 180 }}>
          <InputLabel id={quoteLabelId} htmlFor={quoteSelectId}>Quote Character</InputLabel>
          <ModalSelect
            id={quoteSelectId}
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
        <FormControlLabel
          control={(
            <Switch
              checked={processingConfig.hasHeader}
              onChange={(e) => {
                const checked = e.target.checked;
                setProcessingConfig(prev => {
                  const next = { ...prev, hasHeader: checked };
                  onProcessingConfigChange?.(next);
                  return next;
                });
              }}
              disabled={disabled || isImporting}
            />
          )}
          label="Has Header Row"
        />

        <FormControlLabel
          control={(
            <Switch
              checked={processingConfig.skipEmptyLines}
              onChange={(e) => {
                const checked = e.target.checked;
                setProcessingConfig(prev => {
                  const next = { ...prev, skipEmptyLines: checked };
                  onProcessingConfigChange?.(next);
                  return next;
                });
              }}
              disabled={disabled || isImporting}
            />
          )}
          label="Skip Empty Lines"
        />
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
