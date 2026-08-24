import {
  BuildConfigShell,
  SourceConfigSection,
  TileEmitConfigSection,
} from '@hierarchidb/ui-accordion-config';
import { useDialogContext } from '@hierarchidb/ui-dialog';
import { useTranslation } from '@hierarchidb/ui-i18n';
import { Alert, Button, Stack, Typography } from '@mui/material';
import type React from 'react';
import type { ShapeEntity } from '~/common/types/ShapeEntity';
import type { ShapeDialogStepProps } from '~/ui/components/ShapeDialogStepProps';
import { CacheManagementSection } from './CacheManagementSection.tsx';
import { GeometryConfigSection } from './GeometryConfigSection.js';
import { SourceGeometryIntakeGuardCard } from './SourceGeometryIntakeGuardCard/SourceGeometryIntakeGuardCard.js';
import { TileEmitInvalidGeometryFilterCard } from './TileEmitInvalidGeometryFilterCard/TileEmitInvalidGeometryFilterCard.js';
import { useShapeBuildConfigContentView } from './useShapeBuildConfigContentView.js';
import { useShapeBuildConfigStep } from './useShapeBuildConfigStep.js';
import { useShapeBuildConfigStepSession } from './useShapeBuildConfigStepSession.js';
import { ZoomBandConfigSection } from './ZoomBandConfigSection.js';

/**
 * Processing configuration step for Shape plugin.
 */
const ShapeBuildConfigContent: React.FC<ShapeDialogStepProps> = ({
  data,
  nodeId,
  onChange,
  disabled,
}) => {
  const { registerStepDraftCommitter } = useDialogContext<Partial<ShapeEntity>>();
  const { t } = useTranslation('shape-plugin');
  const { config } = useShapeBuildConfigStep({ data, onChange });
  const {
    workingConfig,
    runtimeBuildConfig,
    heapWarning,
    filteringPreviewImages,
    updateWorkingConfig,
    updateRuntimeBuildConfig,
    fetchState,
  } = useShapeBuildConfigContentView({
    config,
    data,
    nodeId,
    disabled,
    t,
    registerStepDraftCommitter,
  });

  return (
    <BuildConfigShell
      padding={2}
      spacing={2}
      sx={{
        '& .MuiCard-root:hover': {
          transform: 'none !important',
          boxShadow: 'none !important',
          transition: 'none !important',
        },
        '& .MuiPaper-root:hover': {
          transform: 'none !important',
          boxShadow: 'none !important',
          transition: 'none !important',
        },
      }}
      alert={
        heapWarning ? (
          <Alert severity={heapWarning.severity} sx={{ alignItems: 'center' }}>
            {heapWarning.message}
          </Alert>
        ) : null
      }
    >
      <ZoomBandConfigSection
        config={workingConfig}
        onChange={updateWorkingConfig}
        disabled={disabled}
        disableHoverLift
      />
      <SourceConfigSection
        t={t}
        buildConfig={runtimeBuildConfig}
        update={updateRuntimeBuildConfig}
        filteringPreviewImages={filteringPreviewImages}
        showConcurrencyCard={false}
        showRetryCard={false}
        disabled={disabled}
        disableHoverLift
        additionalCards={
          <SourceGeometryIntakeGuardCard
            config={workingConfig}
            onChange={updateWorkingConfig}
            disabled={disabled}
            disableHoverLift
          />
        }
      />
      <GeometryConfigSection
        config={workingConfig}
        onChange={updateWorkingConfig}
        disabled={disabled}
        disableHoverLift
      />
      <TileEmitConfigSection
        t={t}
        buildConfig={runtimeBuildConfig}
        update={updateRuntimeBuildConfig}
        showConcurrencyCard={false}
        disabled={disabled}
        disableHoverLift
        additionalCards={
          <TileEmitInvalidGeometryFilterCard
            config={workingConfig}
            onChange={updateWorkingConfig}
            disabled={disabled}
            disableHoverLift
          />
        }
      />
      <CacheManagementSection
        config={workingConfig}
        onChange={updateWorkingConfig}
        fetchState={fetchState}
        disabled={disabled}
        disableHoverLift
      />
    </BuildConfigShell>
  );
};

type ShapeBuildConfigRunningNoticeProps = {
  buildStepIndex: number;
  handleOpenBuildStep: () => void;
};

const ShapeBuildConfigRunningNotice: React.FC<ShapeBuildConfigRunningNoticeProps> = ({
  buildStepIndex,
  handleOpenBuildStep,
}) => {
  const { t } = useTranslation('shape-plugin');

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Typography variant="subtitle1">
        {t('processing.buildRunning.title', 'Build is running')}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t(
          'processing.buildRunning.body',
          'A build session is currently running. Open the Build step to view progress.'
        )}
      </Typography>
      <Button variant="contained" onClick={handleOpenBuildStep} disabled={buildStepIndex < 0}>
        {t('processing.buildRunning.action', 'Open Build Step')}
      </Button>
    </Stack>
  );
};

export const ShapeBuildConfigStep: React.FC<ShapeDialogStepProps> = (props) => {
  const { buildStepIndex, handleOpenBuildStep, isBuildRunning } = useShapeBuildConfigStepSession({
    nodeId: props.nodeId,
  });
  if (isBuildRunning) {
    return (
      <ShapeBuildConfigRunningNotice
        buildStepIndex={buildStepIndex}
        handleOpenBuildStep={handleOpenBuildStep}
      />
    );
  }
  return <ShapeBuildConfigContent {...props} />;
};
