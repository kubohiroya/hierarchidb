import { useTranslation } from '@hierarchidb/ui-i18n';
import type { ShapeBuildConfig } from '~/common/types/BuildTaskResult';
import { SourceGeometryIntakeGuardCardView } from './SourceGeometryIntakeGuardCardView.js';
import { useSourceGeometryIntakeGuardCardState } from './useSourceGeometryIntakeGuardCardState.js';

type Props = {
  config: ShapeBuildConfig;
  onChange: (next: ShapeBuildConfig | ((prev: ShapeBuildConfig) => ShapeBuildConfig)) => void;
  disabled?: boolean;
  disableHoverLift?: boolean;
};

export const SourceGeometryIntakeGuardCard = ({
  config,
  onChange,
  disableHoverLift = false,
}: Props) => {
  const { t } = useTranslation('shape-plugin');
  const state = useSourceGeometryIntakeGuardCardState(config, onChange);

  return (
    <SourceGeometryIntakeGuardCardView
      {...state}
      disableHoverLift={disableHoverLift}
      labels={{
        title: t('processing.source.geometryIntakeGuard.title', 'Geometry intake guard'),
        description: t(
          'processing.source.geometryIntakeGuard.description',
          'Configure normalization and strictness for source geometry intake checks.'
        ),
        comingSoon: t(
          'processing.source.geometryIntakeGuard.comingSoon',
          'This guard is reserved for a future implementation. Editing is currently disabled.'
        ),
        validationLevel: t(
          'processing.source.geometryIntakeGuard.validationLevel',
          'Validation Level'
        ),
        levelOff: t('processing.source.geometryIntakeGuard.level.off', 'off'),
        levelBasic: t('processing.source.geometryIntakeGuard.level.basic', 'basic'),
        levelStrict: t('processing.source.geometryIntakeGuard.level.strict', 'strict'),
        dedupeEpsilon: t(
          'processing.source.geometryIntakeGuard.dedupeEpsilon',
          'Duplicate vertex epsilon'
        ),
        minRingAreaThreshold: t(
          'processing.source.geometryIntakeGuard.minRingAreaThreshold',
          'Minimum ring area threshold'
        ),
        normalizeRingOrientation: t(
          'processing.source.geometryIntakeGuard.normalizeRingOrientation',
          'Normalize ring orientation'
        ),
        keepBaselineSnapshot: t(
          'processing.source.geometryIntakeGuard.keepBaselineSnapshot',
          'Keep baseline snapshot for anomaly scoring'
        ),
      }}
    />
  );
};
