/**
 * @file TabularDataImport.tsx
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
import type { SelectChangeEvent } from '@mui/material/Select';
import {
  CloudUpload,
  Download,
  DownloadDone,
  Downloading,
  InsertDriveFile,
} from '@mui/icons-material';
import type { TabularProcessingConfig } from '../types/index.js';
import { useTabularData } from '../hooks/useTabularData.js';
import type { TabularTableMetadata } from '@hierarchidb/tabular-store';
import { ModalSelect } from '@hierarchidb/ui-modal-select';

export interface TabularDataImportProps {
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

export const TabularDataImport: React.FC<TabularDataImportProps> = ({
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
  const hasHeaderSwitchId = `${idPrefix}-has-header`;
  const skipEmptyLinesSwitchId = `${idPrefix}-skip-empty-lines`;

  useEffect(() => {
    setImportMethod(initialImportMethod);
  }, [initialImportMethod]);

  useEffect(() => {
    setUrlInput(initialUrl);
  }, [initialUrl]);

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
          name="import-method"
          onChange={(e: SelectChangeEvent) => {
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
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1.25,
              textAlign: 'center',
            }}
          >
            <CloudUpload sx={{ fontSize: 32, color: 'text.secondary' }} />
            <Box sx={{ display: 'grid', gap: 0.3 }}>
              <Typography variant="subtitle1">
                {isImporting ? 'Processing...' : 'Drag & Drop or Click to select a file'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {acceptedFileTypes.join(', ')} · {Math.round(maxFileSize / 1024 / 1024)}MB max
              </Typography>
            </Box>
          </Box>
          {isImporting && (
            <Box sx={{ mt: 1, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress size={18} />
            </Box>
          )}
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
              color="secondary"
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

      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1.5,
          alignItems: 'center',
          mb: 2,
        }}
      >
        <FormControl size="small" sx={{ minWidth: 140 }}>
        <InputLabel id={delimiterLabelId} htmlFor={delimiterSelectId}>Delimiter</InputLabel>
          <ModalSelect
            id={delimiterSelectId}
            labelId={delimiterLabelId}
            name="delimiter"
            value={processingConfig.delimiter}
            label="Delimiter"
            onChange={(e: SelectChangeEvent<string>) => {
              setProcessingConfig(prev => {
                const next: TabularProcessingConfig = {
                  ...prev,
                  delimiter: e.target.value as TabularProcessingConfig['delimiter'],
                };
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

        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel id={encodingLabelId} htmlFor={encodingSelectId}>Encoding</InputLabel>
          <ModalSelect
            id={encodingSelectId}
            labelId={encodingLabelId}
            name="encoding"
            value={processingConfig.encoding}
            label="Encoding"
            onChange={(e: SelectChangeEvent<string>) => {
              setProcessingConfig(prev => {
                const next: TabularProcessingConfig = {
                  ...prev,
                  encoding: e.target.value as TabularProcessingConfig['encoding'],
                };
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

        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel id={quoteLabelId} htmlFor={quoteSelectId}>Quote Character</InputLabel>
          <ModalSelect
            id={quoteSelectId}
            labelId={quoteLabelId}
            name="quote-char"
            value={processingConfig.quoteChar}
            label="Quote Character"
            onChange={(e: SelectChangeEvent<string>) => {
              setProcessingConfig(prev => {
                const next: TabularProcessingConfig = {
                  ...prev,
                  quoteChar: e.target.value as TabularProcessingConfig['quoteChar'],
                };
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
              id={hasHeaderSwitchId}
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
              inputProps={{
                id: hasHeaderSwitchId,
                name: 'has-header',
              }}
            />
          )}
          label="Has Header Row"
        />

        <FormControlLabel
          control={(
            <Switch
              id={skipEmptyLinesSwitchId}
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
              inputProps={{
                id: skipEmptyLinesSwitchId,
                name: 'skip-empty-lines',
              }}
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
