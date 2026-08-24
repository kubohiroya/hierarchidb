// Container logic for CacheManagementSection.
// Extracts hooks and derived state, returns props for the View.

import { getBuildConfigHoverCardSx } from '@hierarchidb/ui-accordion-config';
import { useTranslation } from '@hierarchidb/ui-i18n';
import type { SxProps, Theme } from '@mui/material';
import type { TFunction } from 'i18next';
import { useCallback, useMemo } from 'react';
import type { ShapeBuildConfig } from '~/common/types/BuildTaskResult';
import { useGeometryConfigSection } from '~/ui/hooks/useGeometryConfigSection';
import type { SourceConfigSectionState } from '~/ui/hooks/useSourceConfigSection';

interface CacheManagementSectionStateProps {
  readonly config: ShapeBuildConfig;
  readonly onChange: (
    next: ShapeBuildConfig | ((prev: ShapeBuildConfig) => ShapeBuildConfig)
  ) => void;
  readonly fetchState: SourceConfigSectionState;
  readonly disabled?: boolean;
  readonly disableHoverLift?: boolean;
}

export interface CacheManagementSectionViewProps {
  readonly t: TFunction;
  readonly config: ShapeBuildConfig;
  readonly disabled: boolean;
  readonly hoverCardSx: SxProps<Theme>;
  readonly switchId: string;
  readonly executionLogLevel: 'off' | 'summary' | 'verbose';
  readonly handleResetDefaults: () => void;
  readonly onRetainChange: (field: string, retain: boolean) => void;
  readonly onChangeExecutionLogLevel: (next: 'off' | 'summary' | 'verbose') => void;
  readonly onUrlRulesChange: (
    next: ShapeBuildConfig | ((prev: ShapeBuildConfig) => ShapeBuildConfig)
  ) => void;
}

export function useCacheManagementSectionState(
  props: CacheManagementSectionStateProps
): CacheManagementSectionViewProps {
  const { config, onChange, fetchState, disabled = false, disableHoverLift = false } = props;
  const { t } = useTranslation('shape-plugin');
  const { switchId, handleResetDefaults, update } = fetchState;
  const { update: updateGeometryConfig } = useGeometryConfigSection({ config, onChange });

  const hoverCardSx = useMemo(
    () => getBuildConfigHoverCardSx(disabled, disableHoverLift),
    [disabled, disableHoverLift]
  );

  const executionLogLevel = config.geometryConfig.executionLogLevel ?? 'summary';

  const onRetainChange = useCallback(
    (field: string, retain: boolean) => {
      update({
        cleanupConfig: {
          ...config.cleanupConfig,
          [field]: !retain,
        },
      });
    },
    [config.cleanupConfig, update]
  );

  const onChangeExecutionLogLevel = useCallback(
    (next: 'off' | 'summary' | 'verbose') => {
      updateGeometryConfig({ geometryConfig: { executionLogLevel: next } });
    },
    [updateGeometryConfig]
  );

  return {
    t,
    config,
    disabled,
    hoverCardSx,
    switchId,
    executionLogLevel,
    handleResetDefaults,
    onRetainChange,
    onChangeExecutionLogLevel,
    onUrlRulesChange: onChange,
  };
}
