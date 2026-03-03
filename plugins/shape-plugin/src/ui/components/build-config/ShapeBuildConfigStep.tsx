import type React from 'react';
import { Alert, Button, Stack, Typography } from '@mui/material';
import {
  BuildConfigShell,
  SourceConfigSection,
  TileEmitConfigSection,
} from '@hierarchidb/ui-accordion-config';
import { GeometryConfigSection } from './GeometryConfigSection.js';
import { ZoomBandConfigSection } from './ZoomBandConfigSection.js';
import { CacheManagementSection } from './CacheManagementSection.tsx';
import {
  SourceGeometryIntakeGuardCard,
  TileEmitInvalidGeometryFilterCard,
} from './SourceInvalidGeometryFilterCard.tsx';
import { useShapeBuildConfigStep } from './useShapeBuildConfigStep.js';
import { useTranslation } from '~/ui/useTranslation';
import type { ShapeDialogStepProps } from '~/ui/components/ShapeDialogStepProps';
import { useDialogContext } from '@hierarchidb/ui-dialog';
import {
  type ShapeEntity,
} from '~/common/types/index';
import { useShapeBuildConfigContentView } from './useShapeBuildConfigContentView.js';
import { useShapeBuildConfigStepSession } from './useShapeBuildConfigStepSession.js';

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
  const { t } = useTranslation();
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
        additionalCards={(
          <TileEmitInvalidGeometryFilterCard
            config={workingConfig}
            onChange={updateWorkingConfig}
            disabled={disabled}
            disableHoverLift
          />
        )}
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

const ShapeBuildConfigRunningNotice: React.FC = () => {
  const { t } = useTranslation();
  const { buildStepIndex, handleOpenBuildStep } = useShapeBuildConfigStepSession({ nodeId: undefined });

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
  const { isBuildRunning } = useShapeBuildConfigStepSession({ nodeId: props.nodeId });
  if (isBuildRunning) {
    return <ShapeBuildConfigRunningNotice />;
  }
  return <ShapeBuildConfigContent {...props} />;
};
