/**
 * RouteProcessingStep - Step 3 of route creation base-dialog
 * Shows processing configuration and batch processing options
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  TextField,
  Slider,
  Button,
  LinearProgress,
  Alert,
  Stack,
  Card,
  CardContent,
  Chip,
} from '@mui/material';
import { PlayArrow, Stop, Settings } from '@mui/icons-material';
import type { RouteWorkingCopy, RouteCategory } from '../types';
import { useTranslation } from '../i18n';

export interface RouteProcessingStepProps {
  workingCopy: RouteWorkingCopy;
  onUpdate: (updates: Partial<RouteWorkingCopy>) => void;
  onValidationChange: (isValid: boolean) => void;
}

interface ProcessingStatus {
  isProcessing: boolean;
  progress: number;
  stage: string;
  message: string;
}

export const RouteProcessingStep: React.FC<RouteProcessingStepProps> = ({
  workingCopy,
  onUpdate,
  onValidationChange,
}) => {
  const { t } = useTranslation();
  const [category, setCategory] = useState<RouteCategory>(
    (workingCopy.category as RouteCategory) || 'urban'
  );
  const [simplificationLevel, setSimplificationLevel] = useState(3);
  const [generateElevation, setGenerateElevation] = useState(true);
  const [generateTurns, setGenerateturns] = useState(true);
  const [maxFileSize, setMaxFileSize] = useState(50);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    isProcessing: false,
    progress: 0,
    stage: '',
    message: '',
  });

  const handleCategoryChange = (newCategory: RouteCategory) => {
    setCategory(newCategory);
    onUpdate({
      category: newCategory,
      updatedAt: Date.now(),
      version: workingCopy.version + 1,
    });
  };

  const handleSimplificationChange = (_event: Event, newValue: number | number[]) => {
    const value = Array.isArray(newValue) ? newValue[0] : newValue;
    if (typeof value === 'number') {
      setSimplificationLevel(value);
    }
    onUpdate({
      updatedAt: Date.now(),
      version: workingCopy.version + 1,
    });
  };

  const handleProcessingOptionChange = (option: string, value: boolean | number) => {
    const updates: Partial<RouteWorkingCopy> = {
      [option]: value,
      updatedAt: Date.now(),
      version: workingCopy.version + 1,
    };

    onUpdate(updates);

    if (option === 'generateElevation') setGenerateElevation(value as boolean);
    if (option === 'generateTurns') setGenerateturns(value as boolean);
    if (option === 'maxFileSize') setMaxFileSize(value as number);
  };

  const startProcessing = async () => {
    setProcessingStatus({
      isProcessing: true,
      progress: 0,
      stage: 'initializing',
      message: t('base-dialog.processing.initializing', 'Initializing route processing...'),
    });

    const stages = [
      {
        key: 'fetching',
        message: t('base-dialog.processing.fetchingData', 'Fetching route data...'),
      },
      {
        key: 'calculating',
        message: t('base-dialog.processing.calculating', 'Calculating route segments...'),
      },
      {
        key: 'elevation',
        message: t('base-dialog.processing.elevation', 'Processing elevation data...'),
      },
      {
        key: 'simplifying',
        message: t('base-dialog.processing.simplifying', 'Simplifying route geometry...'),
      },
      {
        key: 'optimizing',
        message: t('base-dialog.processing.optimizing', 'Optimizing route data...'),
      },
      { key: 'finalizing', message: t('base-dialog.processing.finalizing', 'Finalizing route...') },
    ];

    try {
      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i];
        if (stage) {
          setProcessingStatus((prev) => ({
            ...prev,
            progress: (i / stages.length) * 100,
            stage: stage.key,
            message: stage.message,
          }));
        }

        // Simulate processing time
        await new Promise((resolve) => setTimeout(resolve, 1500 + Math.random() * 1000));
      }

      setProcessingStatus({
        isProcessing: false,
        progress: 100,
        stage: 'completed',
        message: t('base-dialog.processing.completed', 'Route processing completed!'),
      });

      // Update working copy with processing results
      onUpdate({
        updatedAt: Date.now(),
        version: workingCopy.version + 1,
      });

      onValidationChange(true);
    } catch (error) {
      setProcessingStatus({
        isProcessing: false,
        progress: 0,
        stage: 'error',
        message: t('base-dialog.processing.error', 'Processing failed. Please try again.'),
      });
      console.error('Route processing error:', error);
    }
  };

  const stopProcessing = () => {
    setProcessingStatus({
      isProcessing: false,
      progress: 0,
      stage: 'stopped',
      message: t('base-dialog.processing.stopped', 'Processing stopped by user.'),
    });
  };

  const getSimplificationLabel = (value: number) => {
    const labels = [
      t('base-dialog.processing.minimal', 'Minimal'),
      t('base-dialog.processing.low', 'Low'),
      t('base-dialog.processing.medium', 'Medium'),
      t('base-dialog.processing.high', 'High'),
      t('base-dialog.processing.maximum', 'Maximum'),
    ];
    return labels[Math.min(value - 1, labels.length - 1)] || labels[2];
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h6" gutterBottom>
        {t('base-dialog.processing.title', 'Route Processing')}
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t(
          'base-dialog.processing.description',
          'Configure processing options for route generation'
        )}
      </Typography>

      {/* Route Category */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          {t('base-dialog.processing.routeCategory', 'Route Category')}
        </Typography>
        <FormControl fullWidth size="small">
          <InputLabel>{t('base-dialog.processing.category', 'Category')}</InputLabel>
          <Select
            value={category}
            label={t('base-dialog.processing.category', 'Category')}
            onChange={(e) => handleCategoryChange(e.target.value as RouteCategory)}
          >
            <MenuItem value="urban">{t('categories.urban', 'Urban')}</MenuItem>
            <MenuItem value="highway">{t('categories.highway', 'Highway')}</MenuItem>
            <MenuItem value="rural">{t('categories.rural', 'Rural')}</MenuItem>
            <MenuItem value="mountain">{t('categories.mountain', 'Mountain')}</MenuItem>
            <MenuItem value="coastal">{t('categories.coastal', 'Coastal')}</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Processing Options */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          {t('base-dialog.processing.options', 'Processing Options')}
        </Typography>

        <Stack spacing={3}>
          {/* Simplification Level */}
          <Box>
            <Typography variant="body2" gutterBottom>
              {t('base-dialog.processing.simplificationLevel', 'Simplification Level')}:{' '}
              {getSimplificationLabel(simplificationLevel)}
            </Typography>
            <Slider
              value={simplificationLevel}
              onChange={handleSimplificationChange}
              min={1}
              max={5}
              step={1}
              marks={[
                { value: 1, label: t('base-dialog.processing.min', 'Min') },
                { value: 3, label: t('base-dialog.processing.med', 'Med') },
                { value: 5, label: t('base-dialog.processing.max', 'Max') },
              ]}
            />
          </Box>

          {/* Generation Options */}
          <FormControlLabel
            control={
              <Switch
                checked={generateElevation}
                onChange={(e) =>
                  handleProcessingOptionChange('generateElevation', e.target.checked)
                }
              />
            }
            label={t('base-dialog.processing.generateElevation', 'Generate Elevation Profile')}
          />

          <FormControlLabel
            control={
              <Switch
                checked={generateTurns}
                onChange={(e) => handleProcessingOptionChange('generateTurns', e.target.checked)}
              />
            }
            label={t('base-dialog.processing.generateTurns', 'Generate Turn Instructions')}
          />

          {/* File Size Limit */}
          <TextField
            label={t('base-dialog.processing.maxFileSize', 'Max File Size (MB)')}
            type="number"
            value={maxFileSize}
            onChange={(e) => handleProcessingOptionChange('maxFileSize', Number(e.target.value))}
            size="small"
            inputProps={{ min: 1, max: 500 }}
          />
        </Stack>
      </Box>

      {/* Processing Status */}
      {(processingStatus.isProcessing || processingStatus.progress > 0) && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle2" gutterBottom>
              {t('base-dialog.processing.status', 'Processing Status')}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Chip
                label={processingStatus.stage}
                color={
                  processingStatus.isProcessing
                    ? 'primary'
                    : processingStatus.progress === 100
                      ? 'success'
                      : 'default'
                }
                size="small"
              />
              <Typography variant="body2" sx={{ flex: 1 }}>
                {processingStatus.message}
              </Typography>
            </Box>

            <LinearProgress
              variant="determinate"
              value={processingStatus.progress}
              sx={{ mb: 1 }}
            />
            <Typography variant="caption" color="text.secondary">
              {Math.round(processingStatus.progress)}%{' '}
              {t('base-dialog.processing.complete', 'complete')}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Processing Controls */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
        {!processingStatus.isProcessing && processingStatus.progress < 100 && (
          <Button
            variant="contained"
            startIcon={<PlayArrow />}
            onClick={startProcessing}
            disabled={!workingCopy.waypoints || workingCopy.waypoints.length < 2}
          >
            {t('base-dialog.processing.startProcessing', 'Start Processing')}
          </Button>
        )}

        {processingStatus.isProcessing && (
          <Button variant="outlined" color="error" startIcon={<Stop />} onClick={stopProcessing}>
            {t('base-dialog.processing.stopProcessing', 'Stop Processing')}
          </Button>
        )}

        <Button
          variant="outlined"
          startIcon={<Settings />}
          disabled={processingStatus.isProcessing}
        >
          {t('base-dialog.processing.advancedSettings', 'Advanced Settings')}
        </Button>
      </Box>

      {/* Success Message */}
      {processingStatus.progress === 100 && !processingStatus.isProcessing && (
        <Alert severity="success" sx={{ mt: 2 }}>
          <Typography variant="body2">
            {t(
              'base-dialog.processing.successMessage',
              'Route has been processed successfully and is ready to use!'
            )}
          </Typography>
        </Alert>
      )}
    </Box>
  );
};
