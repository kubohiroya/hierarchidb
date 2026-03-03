/**
 * @file TabularDataImport.tsx
 * @description File import interface for Tabular processing
 */

import type React from 'react';
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
import type { TabularProcessingConfig } from '../types/index';
import type { TabularTableMetadata } from '@hierarchidb/tabular-store';
import { ModalSelect } from '@hierarchidb/ui-modal-select';
import { useTabularDataImport } from './useTabularDataImport.js';

export interface TabularDataImportProps {
  onFileImported: (metadata: TabularTableMetadata) => void;
  onError: (error: string) => void;
  disabled?: boolean;
  acceptedFileTypes?: string[];
  maxFileSize?: number; // in bytes
  pluginId: string;
  nodeId?: string;
  menuContainer?: Element | null;
  initialImportMethod?: 'file' | 'url';
  initialUrl?: string;
  initialProcessingConfig?: TabularProcessingConfig;
  onProcessingConfigChange?: (config: TabularProcessingConfig) => void;
  onImportMethodChange?: (method: 'file' | 'url') => void;
  onUrlChange?: (url: string) => void;
  importSucceeded?: boolean;
  autoStartDownload?: boolean;
}

export const TabularDataImport: React.FC<TabularDataImportProps> = ({
                                                                      onFileImported,
                                                                      onError,
                                                                      disabled = false,
                                                                      acceptedFileTypes = ['.csv', '.tsv', '.txt'],
                                                                      maxFileSize = 50 * 1024 * 1024, // 50MB default
                                                                      pluginId,
                                                                      nodeId,
                                                                      menuContainer,
                                                                      initialImportMethod = 'file',
                                                                      initialUrl = '',
                                                                      initialProcessingConfig,
                                                                      onProcessingConfigChange,
                                                                      onImportMethodChange,
                                                                      onUrlChange,
                                                                      importSucceeded = false,
                                                                      autoStartDownload = false,
                                                                    }) => {
  const view = useTabularDataImport({
    onFileImported,
    onError,
    disabled,
    acceptedFileTypes,
    maxFileSize,
    pluginId,
    nodeId,
    menuContainer,
    initialImportMethod,
    initialUrl,
    initialProcessingConfig,
    onProcessingConfigChange,
    onImportMethodChange,
    onUrlChange,
    importSucceeded,
    autoStartDownload,
  });

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
      Choose a file or provide a URL to import tabular data.
      </Typography>

      {/* Import Method Selection */}
      <FormControl sx={{ mb: 3, minWidth: 200 }}>
        <InputLabel id={view.importMethodLabelId} htmlFor={view.importMethodSelectId}>Import Method</InputLabel>
        <ModalSelect
          id={view.importMethodSelectId}
          labelId={view.importMethodLabelId}
          value={view.importMethod}
          label="Import Method"
          name="import-method"
          onChange={view.handleImportMethodChange}
          disabled={disabled || view.isImporting}
          menuContainer={view.modalRoot}
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
      {view.importMethod === 'file' && (
        <Paper
          variant="outlined"
          sx={{
            p: 1.25,
            mb: 2,
            border: '2px dashed',
            borderColor: view.dragError ? 'error.main' : view.dragActive ? 'success.main' : 'divider',
            cursor: disabled || view.isImporting ? 'not-allowed' : 'pointer',
            '&:hover': disabled || view.isImporting ? {} : {
              borderColor: 'primary.main',
              bgcolor: 'action.hover',
            },
          }}
          onClick={disabled || view.isImporting ? undefined : view.handleImportClick}
          onDragOver={view.handleDragOver}
          onDragEnter={view.handleDragEnter}
          onDragLeave={view.handleDragLeave}
          onDrop={view.handleDrop}
        >
          <input
            ref={view.fileInputRef}
            type="file"
            accept={acceptedFileTypes.join(',')}
            onChange={view.handleFileSelect}
            style={{ display: 'none' }}
            disabled={disabled || view.isImporting}
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
                {view.isImporting ? 'Processing...' : 'Drag & Drop or Click to select a file'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {acceptedFileTypes.join(', ')} · {Math.round(maxFileSize / 1024 / 1024)}MB max
              </Typography>
            </Box>
          </Box>
          {view.isImporting && (
            <Box sx={{ mt: 1, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress size={18} />
            </Box>
          )}
        </Paper>
      )}

      {/* URL Download Section */}
      {view.importMethod === 'url' && (
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
              id={view.urlFieldId}
              name="tabular-file-url"
              placeholder="https://example.com/data.csv"
              value={view.urlInput}
              onChange={view.handleUrlInputChange}
              disabled={disabled || view.isImporting}
            />

            <Button
              color="secondary"
              variant="contained"
              endIcon={view.isImporting ? <Downloading /> : view.showDownloadSuccess ? <DownloadDone /> : <Download />}
              onClick={view.handleUrlDownload}
              disabled={disabled || view.isImporting || !view.urlInput.trim()}
            >
              {view.isImporting ? 'Downloading...' : 'Download'}
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
        <InputLabel id={view.delimiterLabelId} htmlFor={view.delimiterSelectId}>Delimiter</InputLabel>
          <ModalSelect
            id={view.delimiterSelectId}
            labelId={view.delimiterLabelId}
            name="delimiter"
            value={view.processingConfig.delimiter}
            label="Delimiter"
            onChange={view.handleDelimiterChange}
            disabled={disabled || view.isImporting}
            menuContainer={view.modalRoot}
          >
            <MenuItem value=",">Comma (,)</MenuItem>
            <MenuItem value=";">Semicolon (;)</MenuItem>
            <MenuItem value="\t">Tab</MenuItem>
            <MenuItem value="|">Pipe (|)</MenuItem>
          </ModalSelect>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel id={view.encodingLabelId} htmlFor={view.encodingSelectId}>Encoding</InputLabel>
          <ModalSelect
            id={view.encodingSelectId}
            labelId={view.encodingLabelId}
            name="encoding"
            value={view.processingConfig.encoding}
            label="Encoding"
            onChange={view.handleEncodingChange}
            disabled={disabled || view.isImporting}
            menuContainer={view.modalRoot}
          >
            <MenuItem value="utf-8">UTF-8</MenuItem>
            <MenuItem value="iso-8859-1">ISO-8859-1</MenuItem>
            <MenuItem value="windows-1252">Windows-1252</MenuItem>
          </ModalSelect>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel id={view.quoteLabelId} htmlFor={view.quoteSelectId}>Quote Character</InputLabel>
          <ModalSelect
            id={view.quoteSelectId}
            labelId={view.quoteLabelId}
            name="quote-char"
            value={view.processingConfig.quoteChar}
            label="Quote Character"
            onChange={view.handleQuoteCharChange}
            disabled={disabled || view.isImporting}
            menuContainer={view.modalRoot}
          >
            <MenuItem value='"'>Double Quote (")</MenuItem>
            <MenuItem value="'">Single Quote (')</MenuItem>
            <MenuItem value="">None</MenuItem>
          </ModalSelect>
        </FormControl>
        <FormControlLabel
          control={(
            <Switch
              id={view.hasHeaderSwitchId}
              checked={view.processingConfig.hasHeader}
              onChange={view.handleHasHeaderChange}
              disabled={disabled || view.isImporting}
              inputProps={{
                id: view.hasHeaderSwitchId,
                name: 'has-header',
              }}
            />
          )}
          label="Has Header Row"
        />

        <FormControlLabel
          control={(
            <Switch
              id={view.skipEmptyLinesSwitchId}
              checked={view.processingConfig.skipEmptyLines}
              onChange={view.handleSkipEmptyLinesChange}
              disabled={disabled || view.isImporting}
              inputProps={{
                id: view.skipEmptyLinesSwitchId,
                name: 'skip-empty-lines',
              }}
            />
          )}
          label="Skip Empty Lines"
        />
      </Box>

      {/* Error Display */}
      {view.imortError && (
        <Alert severity="error" sx={{ mt: 3 }}>
          {view.imortError}
        </Alert>
      )}
    </Box>
  );
};
