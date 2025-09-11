import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material';
import AspectRatioIcon from '@mui/icons-material/AspectRatio';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import type { NodeId } from '@hierarchidb/common-type';
import type { ProjectEntity } from '~/types/project-types';
import { BasicInfoStep } from './steps/BasicInfoStep';
import { CrossViewSnackbar } from '@hierarchidb/ui-core';
import { RegionConfigStep } from './steps/RegionConfigStep';
import { LayerConfigStep } from './steps/LayerConfigStep';
import { SpatialAnalysisStep } from './steps/SpatialAnalysisStep';
import { TemporalAnalysisStep } from './steps/TemporalAnalysisStep';
import { OutputConfigStep } from './steps/OutputConfigStep';

export interface ProjectWizardProps {
  open: boolean;
  nodeId: NodeId;
  initialData?: Partial<ProjectEntity>;
  onClose: () => void;
  onComplete: (data: Partial<ProjectEntity>) => Promise<void>;
}

const steps = [
  'Basic Information',
  'Target Region',
  'Data Layers',
  'Spatial Analysis',
  'Temporal Analysis',
  'Output Settings',
];

export const ProjectWizard: React.FC<ProjectWizardProps> = ({
  open,
  nodeId,
  initialData,
  onClose,
  onComplete,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [projectData, setProjectData] = useState<Partial<ProjectEntity>>(
    initialData || {},
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Display mode (host persists via UI side; plugin does not persist)
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [modeMenuAnchor, setModeMenuAnchor] = useState<null | HTMLElement>(null);
  const paperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Initialize from host defaults; no plugin-side persistence
    setIsFullscreen(false);
    setIsMaximized(false);
    const onFsChange = () => {
      const active = !!document.fullscreenElement;
      setIsFullscreen(active);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange' as any, onFsChange);
    return () => { document.removeEventListener('fullscreenchange', onFsChange); document.removeEventListener('webkitfullscreenchange' as any, onFsChange); };
  }, [nodeId, isMaximized]);

  // Host persists; plugin no-op
  const persistMode = async (_m: 'standard' | 'maximized' | 'fullscreen') => {};

  const openModeMenu = (e: React.MouseEvent<HTMLElement>) => setModeMenuAnchor(e.currentTarget);
  const closeModeMenu = () => setModeMenuAnchor(null);
  const toggleMaximize = async (next?: boolean) => {
    const val = next ?? !isMaximized;
    setIsMaximized(val);
    await persistMode(val ? 'maximized' : 'standard');
  };
  const toggleFullscreen = async (next?: boolean) => {
    const val = next ?? !isFullscreen;
    if (val) {
      const el: any = paperRef.current;
      const req = el?.requestFullscreen || el?.webkitRequestFullscreen || el?.msRequestFullscreen;
      try { if (typeof req === 'function') await req.call(el); } catch {}
      setIsFullscreen(true);
      setIsMaximized(false);
      await persistMode('fullscreen');
    } else {
      try { if (document.fullscreenElement) await document.exitFullscreen?.(); } catch {}
      setIsFullscreen(false);
      await persistMode('standard');
    }
  };
  const selectDisplayMode = async (m: 'standard' | 'maximized' | 'fullscreen') => {
    if (m === 'fullscreen') {
      await toggleFullscreen(true);
    } else if (m === 'maximized') {
      if (isFullscreen) await toggleFullscreen(false);
      await toggleMaximize(true);
    } else {
      if (isFullscreen) await toggleFullscreen(false);
      await toggleMaximize(false);
    }
    closeModeMenu();
  };

  const handleNext = () => {
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleStepComplete = (stepData: any) => {
    setProjectData((prev) => ({
      ...prev,
      ...stepData,
    }));

    if (activeStep === steps.length - 1) {
      handleSubmit();
    } else {
      handleNext();
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onComplete(projectData);
      onClose();
    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <BasicInfoStep
            data={projectData}
            onComplete={handleStepComplete}
          />
        );
      case 1:
        return (
          <RegionConfigStep
            data={projectData}
            onComplete={handleStepComplete}
            datasetId={`project:${nodeId}`}
          />
        );
      case 2:
        return (
          <LayerConfigStep
            data={projectData}
            nodeId={nodeId}
            onComplete={handleStepComplete}
          />
        );
      case 3:
        return (
          <SpatialAnalysisStep
            data={projectData}
            onComplete={handleStepComplete}
          />
        );
      case 4:
        return (
          <TemporalAnalysisStep
            data={projectData}
            onComplete={handleStepComplete}
          />
        );
      case 5:
        return (
          <OutputConfigStep
            data={projectData}
            onComplete={handleStepComplete}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={isFullscreen ? false : (isMaximized ? false : 'lg')}
      fullWidth={!isFullscreen && !isMaximized}
      fullScreen={isFullscreen}
      PaperProps={{
        ref: paperRef,
        sx: isFullscreen ? undefined : (isMaximized ? {
          m: 1,
          width: 'calc(100vw - 16px * 2)',
          height: 'calc(100vh - 16px * 2)',
          display: 'flex', flexDirection: 'column'
        } : { height: '90vh', display: 'flex', flexDirection: 'column' }),
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h5">Create Project</Typography>
        <Box>
          <IconButton aria-label="Display mode" onClick={openModeMenu} size="small">
            <AspectRatioIcon />
          </IconButton>
          <Menu anchorEl={modeMenuAnchor} open={Boolean(modeMenuAnchor)} onClose={closeModeMenu} keepMounted>
            <MenuItem selected={!isFullscreen && !isMaximized} onClick={() => selectDisplayMode('standard')}>
              <ListItemIcon><CropSquareIcon fontSize="small" /></ListItemIcon>
              <ListItemText>標準サイズ</ListItemText>
            </MenuItem>
            <MenuItem selected={!isFullscreen && isMaximized} onClick={() => selectDisplayMode('maximized')}>
              <ListItemIcon><OpenInFullIcon fontSize="small" /></ListItemIcon>
              <ListItemText>最大化（ウィンドウ内）</ListItemText>
            </MenuItem>
            <MenuItem selected={isFullscreen} onClick={() => selectDisplayMode('fullscreen')}>
              <ListItemIcon><FullscreenIcon fontSize="small" /></ListItemIcon>
              <ListItemText>フルスクリーン</ListItemText>
            </MenuItem>
          </Menu>
          {!isFullscreen && (
            <IconButton aria-label={isMaximized ? '標準サイズに戻す' : '最大化'} onClick={() => toggleMaximize()} size="small">
              {isMaximized ? <CloseFullscreenIcon /> : <OpenInFullIcon />}
            </IconButton>
          )}
          <IconButton aria-label={isFullscreen ? 'フルスクリーン解除' : 'フルスクリーン'} onClick={() => toggleFullscreen()} size="small">
            {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Cross-view focus snackbar for project-related maps (e.g., Region step) */}
        <CrossViewSnackbar datasetId={`project:${nodeId}`} />
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {renderStepContent()}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleBack}
          disabled={activeStep === 0}
        >
          Back
        </Button>
        {activeStep === steps.length - 1 ? (
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            Create Project
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleNext}
          >
            Next
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
