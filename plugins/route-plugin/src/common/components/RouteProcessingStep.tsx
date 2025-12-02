/**
 * RouteProcessingStep - Step 3 of route creation base-dialog
 * Shows processing configuration and batch processing options
 */

import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  FormControlLabel,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Slider,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { PlayArrow, Settings, Stop } from '@mui/icons-material';
import type { RouteEntity, RouteDraft } from '../entities/RouteEntity.js';
import { useTranslation } from '../i18n/index.js';
import { getRouteDraft } from '../utils/draft.js';

export interface RouteProcessingStepProps {
  draft: RouteDraft;
  onUpdate: (updates: Partial<RouteEntity>) => void;
  onValidationChange: (isValid: boolean) => void;
}

interface ProcessingStatus {
  isProcessing: boolean;
  progress: number;
  stage: string;
  message: string;
}

export const RouteProcessingStep: React.FC<RouteProcessingStepProps> = ({
  draft: draftProp,
  onUpdate,
  onValidationChange,
}) => {
  const { t } = useTranslation();
  const draft = useMemo(() => getRouteDraft(draftProp), [draftProp]);
  const resolvedCategory = (draft.category as string | undefined) ?? 'transportation';

  const [category, setCategory] = useState<string>(resolvedCategory);
  useEffect(() => {
    setCategory(resolvedCategory);
  }, [resolvedCategory]);

  const emitUpdate = useCallback((updates: Partial<RouteEntity>) => {
    onUpdate({
      ...updates,
    });
  }, [onUpdate]);
  const [simplificationLevel, setSimplificationLevel] = useState<number>(3);
  const [generateElevation, setGenerateElevation] = useState<boolean>(true);
  const [generateTurns, setGenerateturns] = useState<boolean>(true);
  const [maxFileSize, setMaxFileSize] = useState<number>(50);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    isProcessing: false,
    progress: 0,
    stage: '',
    message: '',
  });
  const handleCategoryChange = (newCategory: string) => {
    setCategory(newCategory);
    emitUpdate({ category: newCategory as unknown as RouteEntity['category'] });
  };

  const handleSimplificationChange = (_event: unknown, newValue: number | number[]) => {
    const value = Array.isArray(newValue) ? newValue[0] : newValue;
    if (typeof value === 'number') {
      setSimplificationLevel(value);
    }
    emitUpdate({});
  };

  const handleProcessingOptionChange = (
    option: 'generateElevation' | 'generateTurns' | 'maxFileSize',
    value: boolean | number
  ) => {
    emitUpdate({ metadata: { ...(draft.metadata ?? {}), [option]: value } as RouteEntity['metadata'] });

    if (option === 'generateElevation') setGenerateElevation(Boolean(value));
    if (option === 'generateTurns') setGenerateturns(Boolean(value));
    if (option === 'maxFileSize') setMaxFileSize(Number(value));
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

      emitUpdate({});
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
          'Configure processing options for route generation',
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
            onChange={(e) => handleCategoryChange(String(e.target.value))}
          >
            <MenuItem value="transportation">{t('categories.transportation', 'Transportation')}</MenuItem>
            <MenuItem value="recreation">{t('categories.recreation', 'Recreation')}</MenuItem>
            <MenuItem value="logistics">{t('categories.logistics', 'Logistics')}</MenuItem>
            <MenuItem value="emergency">{t('categories.emergency', 'Emergency')}</MenuItem>
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
            disabled={!Array.isArray(draft.waypoints) || draft.waypoints.length < 2}
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
              'Route has been processed successfully and is ready to use!',
            )}
          </Typography>
        </Alert>
      )}
    </Box>
  );
};
