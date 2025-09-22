/**
  * Location Dialog Component
   */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { LocationOn } from '@mui/icons-material';
import { notify } from '@hierarchidb/ui-core';
import type { LocationDialogProps, LocationWorkingCopy } from '../types/index.js';
import { useWorkingCopy } from '@hierarchidb/ui-core';
import {
  HeadlessMultiStepDialog,
  FRAME_CONSTANTS,
  getViewportSize,
  getPresetSize,
  normalizeDialogState,
  initialPosition,
  sizesEqual,
  positionsEqual,
  type HeadlessMultiStepDialogProps,
  type StepComponentDescriptor,
  type HeadlessHeaderRenderProps,
  type HeadlessContentRenderProps,
  type HeadlessFooterRenderProps,
  type StepNavigationEvent,
  type DialogDisplayMode,
  type MultiDialogSize,
  type MultiDialogPosition,
} from '@hierarchidb/ui-dialog';

const toIdString = (value?: LocationDialogProps['nodeId']): string | undefined =>
  value ? `${value}` : undefined;

const dataSourceOptions = ['openstreetmap', 'geonames', 'wikidata', 'overpass'] as const;
type DataSourceName = typeof dataSourceOptions[number];

const dataSourceLabels: Record<DataSourceName, string> = {
  openstreetmap: 'OpenStreetMap',
  geonames: 'GeoNames',
  wikidata: 'Wikidata',
  overpass: 'Overpass API',
};

const isDataSourceName = (value: string): value is DataSourceName =>
  (dataSourceOptions as readonly string[]).includes(value);

export const LocationDialog: React.FC<LocationDialogProps> = ({
  mode,
  nodeId,
  parentId,
  open,
  onClose,
  onSuccess,
  onError,
}) => {
  const { workingCopy, setWorkingCopy, init, commit, discard } = useWorkingCopy<LocationWorkingCopy>({
    nodeType: 'location',
    mode,
    nodeId: toIdString(nodeId),
    parentId: toIdString(parentId),
  });

  useEffect(() => { if (open) void init(); }, [open, init]);
  useEffect(() => { return () => { void discard().catch(() => {}); }; }, [discard]);

  const initialLayout = useMemo(() => {
    const viewport = getViewportSize();
    const defaultSize = getPresetSize('normal', viewport);
    return normalizeDialogState(
      defaultSize,
      initialPosition(defaultSize, viewport),
      viewport,
      { enforceTopLeftMargin: true },
    );
  }, []);

  const [displayMode, setDisplayModeState] = useState<DialogDisplayMode>('normal');
  const [dialogSize, setDialogSize] = useState<MultiDialogSize>(initialLayout.size);
  const [dialogPosition, setDialogPosition] = useState<MultiDialogPosition>(initialLayout.position);
  const dialogSizeRef = useRef(dialogSize);
  const dialogPositionRef = useRef(dialogPosition);

  const applyNormalizedState = useCallback((size: MultiDialogSize, position: MultiDialogPosition) => {
    dialogSizeRef.current = size;
    dialogPositionRef.current = position;
    setDialogSize(size);
    setDialogPosition(position);
  }, [setDialogPosition, setDialogSize]);

  useEffect(() => {
    dialogSizeRef.current = dialogSize;
  }, [dialogSize]);

  useEffect(() => {
    dialogPositionRef.current = dialogPosition;
  }, [dialogPosition]);

  useEffect(() => {
    if (!open) {
      setDisplayModeState('normal');
      dialogSizeRef.current = initialLayout.size;
      dialogPositionRef.current = initialLayout.position;
      setDialogSize(initialLayout.size);
      setDialogPosition(initialLayout.position);
    }
  }, [open, initialLayout]);

  const handleSave = useCallback(async () => {
    try {
      await commit();
      if (workingCopy) onSuccess?.(workingCopy);
      notify.success('Location saved successfully');
    } catch (e) {
      onError?.(e as Error);
      notify.error('Failed to save location');
    } finally {
      onClose();
    }
  }, [commit, onClose, onError, onSuccess, workingCopy]);

  const handleCancel = useCallback(async () => {
    await discard().catch(() => {});
    notify.info('Location changes discarded');
    onClose();
  }, [discard, onClose]);

  const updateWorkingCopy = useCallback((updates: Partial<LocationWorkingCopy>) => {
    setWorkingCopy((prev) => ({ ...prev, ...updates }));
  }, [setWorkingCopy]);

  const dataSourceValue: DataSourceName = workingCopy?.dataSourceName ?? 'openstreetmap';
  const handleDataSourceChange = useCallback((event: SelectChangeEvent<DataSourceName>) => {
    const nextValue = event.target.value;
    if (isDataSourceName(nextValue)) updateWorkingCopy({ dataSourceName: nextValue });
  }, [updateWorkingCopy]);

  const nameValue = workingCopy?.name ?? '';
  const descriptionValue = workingCopy?.description ?? '';
  const licenseAgreementValue = workingCopy?.licenseAgreement ?? false;

  const steps = useMemo<ReadonlyArray<StepComponentDescriptor<LocationWorkingCopy | null>>>(() => ([
    { id: 'location-form', label: 'Location Details', component: () => null },
  ]), []);

  const [activeStepIndex, setActiveStepIndex] = useState(0);

  useEffect(() => {
    if (!open) {
      setActiveStepIndex(0);
    }
  }, [open]);

  const enabledStepIndices = useMemo<ReadonlyArray<number>>(() => [0], []);
  const validatedStepIndices = useMemo<ReadonlyArray<number>>(() => (
    (nameValue && licenseAgreementValue) ? [0] : []
  ), [licenseAgreementValue, nameValue]);
  const committableStepIndices = useMemo<ReadonlyArray<number>>(() => [0], []);

  const handleNavigation = useCallback((event: StepNavigationEvent) => {
    switch (event.type) {
      case 'direct':
        setActiveStepIndex(event.targetIndex);
        break;
      case 'next':
      case 'back':
        // Single step dialog; ignore navigation requests beyond bounds
        break;
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let rafId: number | null = null;

    const normalize = () => {
      rafId = null;
      const viewport = getViewportSize();
      let targetSize = dialogSizeRef.current;
      let targetPosition = dialogPositionRef.current;
      let options = {
        enforceTopLeftMargin: displayMode === 'normal',
        minPosition: displayMode === 'normal' ? 0 : FRAME_CONSTANTS.NON_STANDARD_MARGIN,
        clampSizeToViewport: true,
      };

      if (displayMode === 'full-screen') {
        targetSize = {
          width: Math.max(viewport.width, FRAME_CONSTANTS.MIN_DIALOG_WIDTH),
          height: Math.max(viewport.height, FRAME_CONSTANTS.MIN_DIALOG_HEIGHT),
        };
        targetPosition = { x: 0, y: 0 };
        options = {
          enforceTopLeftMargin: false,
          minPosition: 0,
          clampSizeToViewport: false,
        };
      } else if (displayMode === 'maximize') {
        targetSize = getPresetSize('maximize', viewport);
        targetPosition = {
          x: FRAME_CONSTANTS.NON_STANDARD_MARGIN,
          y: FRAME_CONSTANTS.NON_STANDARD_MARGIN,
        };
        options = {
          enforceTopLeftMargin: false,
          minPosition: FRAME_CONSTANTS.NON_STANDARD_MARGIN,
          clampSizeToViewport: true,
        };
      }

      const normalized = normalizeDialogState(targetSize, targetPosition, viewport, options);
      if (!sizesEqual(dialogSizeRef.current, normalized.size) || !positionsEqual(dialogPositionRef.current, normalized.position)) {
        applyNormalizedState(normalized.size, normalized.position);
      }
    };

    const schedule = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(normalize);
    };

    window.addEventListener('resize', schedule, { passive: true });
    schedule();

    return () => {
      window.removeEventListener('resize', schedule);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    };
  }, [applyNormalizedState, displayMode]);

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

    setDisplayModeState(mode);
  }, [applyNormalizedState, setDisplayModeState]);

  const handleSizeChange = useCallback((next?: MultiDialogSize) => {
    if (!next) return;
    const normalized = normalizeDialogState(
      next,
      dialogPositionRef.current,
      getViewportSize(),
      {
        enforceTopLeftMargin: displayMode === 'normal',
        minPosition: displayMode === 'normal' ? 0 : FRAME_CONSTANTS.NON_STANDARD_MARGIN,
        clampSizeToViewport: true,
      },
    );
    if (!sizesEqual(dialogSizeRef.current, normalized.size) || !positionsEqual(dialogPositionRef.current, normalized.position)) {
      applyNormalizedState(normalized.size, normalized.position);
    }
  }, [applyNormalizedState, displayMode]);

  const handlePositionChange = useCallback((next?: MultiDialogPosition) => {
    if (!next) return;
    const normalized = normalizeDialogState(
      dialogSizeRef.current,
      next,
      getViewportSize(),
      {
        enforceTopLeftMargin: displayMode === 'normal',
        minPosition: displayMode === 'normal' ? 0 : FRAME_CONSTANTS.NON_STANDARD_MARGIN,
        clampSizeToViewport: true,
      },
    );
    if (!sizesEqual(dialogSizeRef.current, normalized.size) || !positionsEqual(dialogPositionRef.current, normalized.position)) {
      applyNormalizedState(normalized.size, normalized.position);
    }
  }, [applyNormalizedState, displayMode]);

  const renderHeader: HeadlessMultiStepDialogProps<LocationWorkingCopy | null>['renderHeader'] = useCallback((propsHeader: HeadlessHeaderRenderProps<LocationWorkingCopy | null>) => (
    <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ px: 2, py: 1.5, borderBottom: '1px solid #dde1eb' }}>
      <Box display="flex" alignItems="center" gap={1.5}>
        <LocationOn color="primary" />
        <Box>
          <Typography variant="h6" component="div">
            {mode === 'create' ? '地点情報ノードの作成' : '地点情報ノードの編集'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            ステップ {propsHeader.activeStepIndex + 1} / {steps.length}
          </Typography>
        </Box>
      </Box>
      <Button size="small" onClick={() => propsHeader.stepNavigation({ type: 'back' })} disabled>
        Back
      </Button>
    </Box>
  ), [mode, steps.length]);

  const renderContent: HeadlessMultiStepDialogProps<LocationWorkingCopy | null>['renderContent'] = useCallback((_: HeadlessContentRenderProps<LocationWorkingCopy | null>) => (
    <Box sx={{ pt: 2, px: 2 }}>
      <TextField
        fullWidth
        required
        label="名前"
        value={nameValue}
        onChange={(e) => updateWorkingCopy({ name: e.target.value })}
        disabled={!workingCopy}
        sx={{ mb: 3 }}
      />

      <TextField
        fullWidth
        multiline
        rows={3}
        label="説明"
        value={descriptionValue}
        onChange={(e) => updateWorkingCopy({ description: e.target.value })}
        disabled={!workingCopy}
        sx={{ mb: 3 }}
      />

      <FormControl fullWidth sx={{ mb: 3 }}>
        <InputLabel>データソース</InputLabel>
        <Select<DataSourceName>
          value={dataSourceValue}
          onChange={handleDataSourceChange}
          label="データソース"
          disabled={!workingCopy}
        >
          {dataSourceOptions.map((value) => (
            <MenuItem key={value} value={value}>
              {dataSourceLabels[value]}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControlLabel
        control={
          <Checkbox
            checked={licenseAgreementValue}
            onChange={(e) => updateWorkingCopy({ licenseAgreement: e.target.checked })}
            disabled={!workingCopy}
          />
        }
        label="ライセンスに同意する"
        sx={{ mb: 2 }}
      />
    </Box>
  ), [dataSourceValue, descriptionValue, handleDataSourceChange, licenseAgreementValue, nameValue, updateWorkingCopy, workingCopy]);

  const renderFooter: HeadlessMultiStepDialogProps<LocationWorkingCopy | null>['renderFooter'] = useCallback((propsFooter: HeadlessFooterRenderProps<LocationWorkingCopy | null>) => (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, px: 2, py: 1.5, borderTop: '1px solid #dde1eb' }}>
      <Button onClick={() => propsFooter.onRequestClose('close')} color="inherit">
        キャンセル
      </Button>
      <Button
        variant="contained"
        onClick={() => propsFooter.onRequestCommit?.()}
        disabled={!workingCopy || !nameValue || !licenseAgreementValue}
      >
        保存
      </Button>
    </Box>
  ), [licenseAgreementValue, nameValue, workingCopy]);

  const invalidMessageMap = useMemo(() => ({} as Record<string, string>), []);

  const frameSx = useMemo(() => {
    const fullScreen = displayMode === 'full-screen';
    return {
      width: fullScreen ? '100%' : `${dialogSize.width}px`,
      maxWidth: fullScreen ? '100%' : 'min(calc(100vw - 48px), 1280px)',
      height: fullScreen ? '100%' : `${dialogSize.height}px`,
      maxHeight: fullScreen ? '100%' : 'calc(100vh - 48px)',
      display: 'flex',
      flexDirection: 'column',
      borderRadius: fullScreen ? 0 : 12,
      boxShadow: fullScreen ? 'none' : '0 22px 80px rgba(10, 14, 36, 0.38)',
      overflow: 'hidden',
      backgroundColor: '#fff',
    } as const;
  }, [dialogSize.height, dialogSize.width, displayMode]);

  return (
    <Box sx={frameSx} role="dialog" aria-modal={open}>
      <HeadlessMultiStepDialog<LocationWorkingCopy | null>
        open={open}
        stepComponents={steps}
        stepData={workingCopy}
        onStepDataChange={(patch: Partial<LocationWorkingCopy> | null | undefined) => {
          if (!patch) return;
          updateWorkingCopy(patch);
        }}
        activeStepIndex={activeStepIndex}
        onStepNavigate={handleNavigation}
        enabledStepIndices={enabledStepIndices}
        validatedStepIndices={validatedStepIndices}
        committableStepIndices={committableStepIndices}
        invalidMessageMap={invalidMessageMap}
        onRequestClose={() => { void handleCancel(); }}
        onRequestCommit={() => { void handleSave(); }}
        displayMode={displayMode}
        onDisplayModeChange={(mode: DialogDisplayMode) => { transitionDisplayMode(mode); }}
        position={dialogPosition}
        onPositionChange={handlePositionChange}
        size={dialogSize}
        onSizeChange={handleSizeChange}
        renderHeader={renderHeader}
        renderContent={renderContent}
        renderFooter={renderFooter}
      />
    </Box>
  );
};
