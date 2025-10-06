/**
 * Location Dialog Component composed with the headless multi-step dialog shell.
 */

import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Grid, Typography } from '@mui/material';
import { LocationOn } from '@mui/icons-material';
import { notify, useWorkingCopy } from '@hierarchidb/ui-core';
import type {
  LocationDialogProps,
  LocationWorkingCopy,
  LocationDataSource,
} from '../types/index.js';
import { useTranslation } from '../i18n/index.js';
import {
  HeadlessMultiStepDialog,
  FRAME_CONSTANTS,
  getViewportSize,
  getPresetSize,
  normalizeDialogState,
  initialPosition,
  sizesEqual,
  positionsEqual,
  type HeadlessContentRenderProps,
  type HeadlessFooterRenderProps,
  type HeadlessHeaderRenderProps,
  type HeadlessMultiStepDialogProps,
  type DialogDisplayMode,
  type MultiDialogPosition,
  type MultiDialogSize,
  type StepNavigationEvent,
  type StepComponentDescriptor,
} from '@hierarchidb/ui-dialog';
import { LocationBasicInfoStep } from './steps/LocationBasicInfoStep.js';
import { LocationDataSourceStep } from './steps/LocationDataSourceStep.js';
import { LocationLicenseStep } from './steps/LocationLicenseStep.js';
import { LocationSelectionStep } from './steps/LocationSelectionStep.js';
import { LocationBatchParametersStep } from './steps/LocationBatchParametersStep.js';
import { LocationMapPreviewStep } from './steps/LocationMapPreviewStep.js';

const toIdString = (value?: LocationDialogProps['nodeId']): string | undefined =>
  value ? `${value}` : undefined;

const buildDefaultFrame = (): { size: MultiDialogSize; position: MultiDialogPosition } => {
  const viewport = getViewportSize();
  const size = getPresetSize('normal', viewport);
  const position = initialPosition(size, viewport);
  return { size, position };
};

export const LocationDialog: React.FC<LocationDialogProps> = ({
  mode,
  nodeId,
  parentId,
  open,
  onClose,
  onSuccess,
  onError,
}) => {
  const { translations } = useTranslation();
  const { size: initialSize, position: initialPositionValue } = useMemo(buildDefaultFrame, []);

  const {
    workingCopy,
    setWorkingCopy,
    init,
    commit,
    discard,
  } = useWorkingCopy<LocationWorkingCopy>({
    nodeType: 'location',
    mode,
    nodeId: toIdString(nodeId),
    parentId: toIdString(parentId),
  });

  useEffect(() => { if (open) void init(); }, [open, init]);
  useEffect(() => () => { void discard().catch(() => {}); }, [discard]);

  const dialogSizeRef = useRef<MultiDialogSize>(initialSize);
  const dialogPositionRef = useRef<MultiDialogPosition>(initialPositionValue);
  const [dialogSize, setDialogSize] = useState<MultiDialogSize>(initialSize);
  const [dialogPosition, setDialogPosition] = useState<MultiDialogPosition>(initialPositionValue);
  const [displayMode, setDisplayMode] = useState<DialogDisplayMode>('normal');
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  const dialogData = useMemo<LocationWorkingCopy>(() => workingCopy ?? ({} as LocationWorkingCopy), [workingCopy]);

  const applyNormalizedState = useCallback((size: MultiDialogSize, position: MultiDialogPosition) => {
    dialogSizeRef.current = size;
    dialogPositionRef.current = position;
    setDialogSize(size);
    setDialogPosition(position);
  }, []);

  const handleWorkingCopyPatch = useCallback((patch: Partial<LocationWorkingCopy>) => {
    setWorkingCopy((prev) => ({ ...prev, ...patch }));
  }, [setWorkingCopy]);

  const stepComponents = useMemo<ReadonlyArray<StepComponentDescriptor<LocationWorkingCopy>>>(() => ([
    {
      id: 'basic-info',
      label: translations.basicInfo.title,
      component: ({ data, onChange }) => (
        <LocationBasicInfoStep workingCopy={data} onUpdate={onChange} />
      ),
    },
    {
      id: 'data-source',
      label: translations.dialog.dataSourceLabel,
      component: ({ data, onChange }) => (
        <LocationDataSourceStep workingCopy={data} onUpdate={onChange} />
      ),
    },
    {
      id: 'license',
      label: translations.dialog.licenseAgreementLabel,
      component: ({ data, onChange }) => (
        <LocationLicenseStep workingCopy={data} onUpdate={onChange} />
      ),
    },
    {
      id: 'selection',
      label: translations.selection.title,
      component: ({ data, onChange }) => (
        <LocationSelectionStep workingCopy={data} onUpdate={onChange} />
      ),
    },
    {
      id: 'batch-parameters',
      label: translations.panel.processingSettings,
      component: ({ data, onChange }) => (
        <LocationBatchParametersStep workingCopy={data} onUpdate={onChange} />
      ),
    },
    {
      id: 'map-preview',
      label: translations.mapPreview?.title ?? 'Map Preview',
      component: ({ data }) => (
        <LocationMapPreviewStep workingCopy={data} />
      ),
    },
  ]), [
    translations.basicInfo.title,
    translations.dialog.dataSourceLabel,
    translations.dialog.licenseAgreementLabel,
    translations.selection.title,
    translations.panel.processingSettings,
    translations.mapPreview?.title,
  ]);

  const enabledStepIndices = useMemo(() => stepComponents.map((_, index) => index), [stepComponents]);
  const committableStepIndices = useMemo(() => [stepComponents.length - 1], [stepComponents.length]);

  const resolveDataSourceLabel = useCallback((value?: LocationDataSource) => {
    if (!value) return '—';
    return translations.dataSources?.[value] ?? value;
  }, [translations.dataSources]);

  const transitionDisplayMode = useCallback((mode: DialogDisplayMode) => {
    const viewport = getViewportSize();

    if (mode === 'full-screen') {
      const size: MultiDialogSize = {
        width: Math.max(viewport.width, FRAME_CONSTANTS.MIN_DIALOG_WIDTH),
        height: Math.max(viewport.height, FRAME_CONSTANTS.MIN_DIALOG_HEIGHT),
      };
      applyNormalizedState(size, { x: 0, y: 0 });
    } else if (mode === 'maximize') {
      const preset = getPresetSize('maximize', viewport);
      const normalized = normalizeDialogState(preset, {
        x: FRAME_CONSTANTS.NON_STANDARD_MARGIN,
        y: FRAME_CONSTANTS.NON_STANDARD_MARGIN,
      }, viewport, {
        enforceTopLeftMargin: false,
        minPosition: FRAME_CONSTANTS.NON_STANDARD_MARGIN,
        clampSizeToViewport: true,
      });
      applyNormalizedState(normalized.size, normalized.position);
    } else {
      const preset = getPresetSize('normal', viewport);
      const normalized = normalizeDialogState(preset, initialPosition(preset, viewport), viewport, {
        enforceTopLeftMargin: true,
      });
      applyNormalizedState(normalized.size, normalized.position);
    }

    setDisplayMode(mode);
  }, [applyNormalizedState]);

  const handleSave = useCallback(async () => {
    try {
      await commit();
      onSuccess?.(dialogData);
      notify.success('Location saved successfully');
    } catch (e) {
      onError?.(e as Error);
      notify.error('Failed to save location');
    } finally {
      onClose();
    }
  }, [commit, dialogData, onClose, onError, onSuccess]);

  const handleCancel = useCallback(async () => {
    await discard().catch(() => {});
    notify.info('Location changes discarded');
    onClose();
  }, [discard, onClose]);

  const handleSizeChange = useCallback((next?: MultiDialogSize) => {
    if (!next) return;
    const normalized = normalizeDialogState(next, dialogPositionRef.current, getViewportSize(), {
      enforceTopLeftMargin: displayMode === 'normal',
      minPosition: displayMode === 'normal' ? 0 : FRAME_CONSTANTS.NON_STANDARD_MARGIN,
      clampSizeToViewport: true,
    });
    if (!sizesEqual(dialogSizeRef.current, normalized.size) || !positionsEqual(dialogPositionRef.current, normalized.position)) {
      applyNormalizedState(normalized.size, normalized.position);
    }
  }, [applyNormalizedState, displayMode]);

  const handlePositionChange = useCallback((next?: MultiDialogPosition) => {
    if (!next) return;
    const normalized = normalizeDialogState(dialogSizeRef.current, next, getViewportSize(), {
      enforceTopLeftMargin: displayMode === 'normal',
      minPosition: displayMode === 'normal' ? 0 : FRAME_CONSTANTS.NON_STANDARD_MARGIN,
      clampSizeToViewport: true,
    });
    if (!sizesEqual(dialogSizeRef.current, normalized.size) || !positionsEqual(dialogPositionRef.current, normalized.position)) {
      applyNormalizedState(normalized.size, normalized.position);
    }
  }, [applyNormalizedState, displayMode]);

  const handleStepNavigate = useCallback((event: StepNavigationEvent) => {
    switch (event.type) {
      case 'direct':
        setActiveStepIndex(event.targetIndex);
        break;
      case 'next':
        setActiveStepIndex((prev) => Math.min(prev + 1, stepComponents.length - 1));
        break;
      case 'back':
        setActiveStepIndex((prev) => Math.max(prev - 1, 0));
        break;
      default:
        break;
    }
  }, [stepComponents.length]);

  const renderHeader: HeadlessMultiStepDialogProps<LocationWorkingCopy>['renderHeader'] = useCallback((propsHeader: HeadlessHeaderRenderProps<LocationWorkingCopy>) => (
    <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ px: 2, py: 1.5, borderBottom: '1px solid #dde1eb' }}>
      <Box display="flex" alignItems="center" gap={1.5}>
        <LocationOn color="primary" />
        <Box>
          <Typography variant="h6" component="div">
            {mode === 'create' ? translations.dialog.createTitle : translations.dialog.editTitle}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {translations.dialog.datasetDescription}
          </Typography>
        </Box>
      </Box>
      <Button size="small" onClick={() => propsHeader.stepNavigation({ type: 'back' })} disabled={propsHeader.activeStepIndex === 0}>
        Back
      </Button>
    </Box>
  ), [mode, translations.dialog.createTitle, translations.dialog.datasetDescription, translations.dialog.editTitle]);

  const renderContent: HeadlessMultiStepDialogProps<LocationWorkingCopy>['renderContent'] = useCallback((propsContent: HeadlessContentRenderProps<LocationWorkingCopy>) => {
    const ActiveComponent = propsContent.activeStep?.component;
    if (!ActiveComponent) return null;

    const dataSourceKey = (propsContent.stepData.dataSource as LocationDataSource) ?? 'openstreetmap';
    const licenseAgreementValue = Boolean(propsContent.stepData.licenseAgreement);
    const concurrentDownloadsValue = propsContent.stepData.concurrentDownloads ?? 2;
    const selectionCount = propsContent.stepData.selectionMatrix?.reduce((count, row) => (
      count + row.filter(Boolean).length
    ), 0) ?? 0;

    return (
      <Box sx={{ pt: 2, px: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {translations.dialog.datasetDescription}
        </Typography>
        <Grid container columnSpacing={2} sx={{ mb: 3 }} columns={{ xs: 12 }}>
          <Grid size={{ xs: 12, md: 3 }}>
            <Typography variant="caption" color="text.secondary">{translations.dialog.dataSourceLabel}</Typography>
            <Typography variant="body2">{resolveDataSourceLabel(dataSourceKey)}</Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <Typography variant="caption" color="text.secondary">{translations.dialog.licenseAgreementLabel}</Typography>
            <Typography variant="body2">{licenseAgreementValue ? translations.common.enabled : translations.common.disabled}</Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <Typography variant="caption" color="text.secondary">{translations.panel.concurrentDownloads}</Typography>
            <Typography variant="body2">{concurrentDownloadsValue}</Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <Typography variant="caption" color="text.secondary">{translations.selection?.selectedCount ?? 'Selected entries'}</Typography>
            <Typography variant="body2">{selectionCount}</Typography>
          </Grid>
        </Grid>

        <ActiveComponent
          stepIndex={propsContent.activeStepIndex ?? 0}
          stepId={propsContent.activeStep?.id ?? ''}
          label={propsContent.activeStep?.label ?? ''}
          data={propsContent.stepData}
          onChange={propsContent.onStepDataChange}
          invalidMessages={propsContent.invalidMessageMap}
        />
      </Box>
    );
  }, [resolveDataSourceLabel, translations]);

  const renderFooter: HeadlessMultiStepDialogProps<LocationWorkingCopy>['renderFooter'] = useCallback((propsFooter: HeadlessFooterRenderProps<LocationWorkingCopy>) => {
    const canCommit = propsFooter.committableStepIndices.includes(propsFooter.activeStepIndex);

    return (
      <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.5, borderTop: '1px solid #dde1eb' }}>
        <Box display="flex" gap={1}>
          <Button size="small" onClick={() => transitionDisplayMode('normal')} disabled={displayMode === 'normal'}>
            {translations.dialog.displayNormal}
          </Button>
          <Button size="small" onClick={() => transitionDisplayMode('maximize')} disabled={displayMode === 'maximize'}>
            {translations.dialog.displayMaximize}
          </Button>
          <Button size="small" onClick={() => transitionDisplayMode('full-screen')} disabled={displayMode === 'full-screen'}>
            {translations.dialog.displayFullscreen}
          </Button>
        </Box>
        <Box display="flex" gap={1}>
          <Button variant="outlined" onClick={() => propsFooter.onRequestClose('close')}>
            {translations.dialog.cancel}
          </Button>
          <Button
            variant="contained"
            onClick={() => propsFooter.onRequestCommit?.()}
            disabled={!canCommit}
          >
            {translations.dialog.save}
          </Button>
        </Box>
      </Box>
    );
  }, [displayMode, transitionDisplayMode, translations.dialog.cancel, translations.dialog.displayFullscreen, translations.dialog.displayMaximize, translations.dialog.displayNormal, translations.dialog.save]);

  const dialogProps: HeadlessMultiStepDialogProps<LocationWorkingCopy> = {
    open,
    stepComponents,
    stepData: dialogData,
    onStepDataChange: handleWorkingCopyPatch,
    activeStepIndex,
    enabledStepIndices,
    validatedStepIndices: [],
    committableStepIndices,
    invalidMessageMap: {},
    isDirty: true,
    onStepNavigate: handleStepNavigate,
    onRequestClose: () => { void handleCancel(); },
    onRequestCommit: () => { void handleSave(); },
    renderHeader,
    renderContent,
    renderFooter,
    size: dialogSize,
    onSizeChange: handleSizeChange,
    position: dialogPosition,
    onPositionChange: handlePositionChange,
    displayMode,
    onDisplayModeChange: transitionDisplayMode,
  };

  return (
    <HeadlessMultiStepDialog<LocationWorkingCopy> {...dialogProps} />
  );
};
