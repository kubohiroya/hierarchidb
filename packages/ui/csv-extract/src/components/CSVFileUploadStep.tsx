/**
 * @file CSVFileUploadStep.tsx
 * @description File upload/URL download interface for CSV processing
 */

import React, { useState, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  CloudUpload,
  Download,
  InsertDriveFile,
} from '@mui/icons-material';
import type { 
  CSVProcessingConfig, 
  CSVTableMetadata, 
  CSVDataResult 
} from '../types';
import { useCSVData } from '../hooks/useCSVData';

export interface CSVFileUploadStepProps {
  onFileUploaded: (metadata: CSVTableMetadata) => void;
  onError: (error: string) => void;
  disabled?: boolean;
  acceptedFileTypes?: string[];
  maxFileSize?: number; // in bytes
  pluginId: string;
}

export const CSVFileUploadStep: React.FC<CSVFileUploadStepProps> = ({
  onFileUploaded,
  onError,
  disabled = false,
  acceptedFileTypes = ['.csv', '.tsv', '.txt'],
  maxFileSize = 50 * 1024 * 1024, // 50MB default
  pluginId,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [urlInput, setUrlInput] = useState('');
  const [uploadMethod, setUploadMethod] = useState<'file' | 'url'>('file');
  const [processingConfig, setProcessingConfig] = useState<CSVProcessingConfig>({
    delimiter: ',',
    encoding: 'utf-8',
    hasHeader: true,
    quoteChar: '"',
    escapeChar: '\\',
    skipEmptyLines: true,
  });

  const {
    uploadCSVFile,
    downloadCSVFromUrl,
    isUploading,
    uploadError,
  } = useCSVData({ 
    pluginId,
    onUploadSuccess: onFileUploaded,
    onUploadError: onError,
  });

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

    uploadCSVFile(file, processingConfig);
  };

  const handleUrlDownload = () => {
    if (!urlInput.trim()) {
      onError('Please enter a valid URL');
      return;
    }

    try {
      new URL(urlInput); // Validate URL format
      downloadCSVFromUrl(urlInput, processingConfig);
    } catch {
      onError('Invalid URL format');
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Upload CSV Data
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Choose a CSV file to upload or provide a URL to download the data from.
      </Typography>

      {/* Upload Method Selection */}
      <FormControl sx={{ mb: 3, minWidth: 200 }}>
        <InputLabel>Upload Method</InputLabel>
        <Select
          value={uploadMethod}
          label="Upload Method"
          onChange={(e) => setUploadMethod(e.target.value as 'file' | 'url')}
          disabled={disabled || isUploading}
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
        </Select>
      </FormControl>

      {/* File Upload Section */}
      {uploadMethod === 'file' && (
        <Paper 
          variant="outlined" 
          sx={{ 
            p: 3, 
            mb: 3,
            border: '2px dashed',
            borderColor: 'divider',
            textAlign: 'center',
            cursor: disabled || isUploading ? 'not-allowed' : 'pointer',
            '&:hover': disabled || isUploading ? {} : {
              borderColor: 'primary.main',
              bgcolor: 'action.hover',
            },
          }}
          onClick={disabled || isUploading ? undefined : handleUploadClick}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedFileTypes.join(',')}
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            disabled={disabled || isUploading}
          />
          
          <CloudUpload sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          
          <Typography variant="h6" gutterBottom>
            {isUploading ? 'Processing...' : 'Click to select a file'}
          </Typography>
          
          <Typography variant="body2" color="text.secondary">
            Supported formats: {acceptedFileTypes.join(', ')}
            <br />
            Maximum size: {Math.round(maxFileSize / 1024 / 1024)}MB
          </Typography>

          {isUploading && (
            <Box sx={{ mt: 2 }}>
              <CircularProgress size={24} />
            </Box>
          )}
        </Paper>
      )}

      {/* URL Download Section */}
      {uploadMethod === 'url' && (
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            label="CSV File URL"
            placeholder="https://example.com/data.csv"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            disabled={disabled || isUploading}
            sx={{ mb: 2 }}
          />
          
          <Button
            variant="contained"
            startIcon={isUploading ? <CircularProgress size={16} /> : <Download />}
            onClick={handleUrlDownload}
            disabled={disabled || isUploading || !urlInput.trim()}
          >
            {isUploading ? 'Downloading...' : 'Download CSV'}
          </Button>
        </Box>
      )}

      <Divider sx={{ my: 3 }} />

      {/* Processing Configuration */}
      <Typography variant="subtitle1" gutterBottom>
        CSV Processing Options
      </Typography>
      
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mb: 3 }}>
        <FormControl>
          <InputLabel>Delimiter</InputLabel>
          <Select
            value={processingConfig.delimiter}
            label="Delimiter"
            onChange={(e) => setProcessingConfig(prev => ({ ...prev, delimiter: e.target.value }))}
            disabled={disabled || isUploading}
          >
            <MenuItem value=",">Comma (,)</MenuItem>
            <MenuItem value=";">Semicolon (;)</MenuItem>
            <MenuItem value="\t">Tab</MenuItem>
            <MenuItem value="|">Pipe (|)</MenuItem>
          </Select>
        </FormControl>

        <FormControl>
          <InputLabel>Encoding</InputLabel>
          <Select
            value={processingConfig.encoding}
            label="Encoding"
            onChange={(e) => setProcessingConfig(prev => ({ ...prev, encoding: e.target.value }))}
            disabled={disabled || isUploading}
          >
            <MenuItem value="utf-8">UTF-8</MenuItem>
            <MenuItem value="iso-8859-1">ISO-8859-1</MenuItem>
            <MenuItem value="windows-1252">Windows-1252</MenuItem>
          </Select>
        </FormControl>

        <FormControl>
          <InputLabel>Quote Character</InputLabel>
          <Select
            value={processingConfig.quoteChar}
            label="Quote Character"
            onChange={(e) => setProcessingConfig(prev => ({ ...prev, quoteChar: e.target.value }))}
            disabled={disabled || isUploading}
          >
            <MenuItem value='"'>Double Quote (")</MenuItem>
            <MenuItem value="'">Single Quote (')</MenuItem>
            <MenuItem value="">None</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <FormControl>
          <InputLabel>Has Header Row</InputLabel>
          <Select
            value={processingConfig.hasHeader ? 'yes' : 'no'}
            label="Has Header Row"
            onChange={(e) => setProcessingConfig(prev => ({ ...prev, hasHeader: e.target.value === 'yes' }))}
            disabled={disabled || isUploading}
          >
            <MenuItem value="yes">Yes</MenuItem>
            <MenuItem value="no">No</MenuItem>
          </Select>
        </FormControl>

        <FormControl>
          <InputLabel>Skip Empty Lines</InputLabel>
          <Select
            value={processingConfig.skipEmptyLines ? 'yes' : 'no'}
            label="Skip Empty Lines"
            onChange={(e) => setProcessingConfig(prev => ({ ...prev, skipEmptyLines: e.target.value === 'yes' }))}
            disabled={disabled || isUploading}
          >
            <MenuItem value="yes">Yes</MenuItem>
            <MenuItem value="no">No</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Error Display */}
      {uploadError && (
        <Alert severity="error" sx={{ mt: 3 }}>
          {uploadError}
        </Alert>
      )}
    </Box>
  );
};