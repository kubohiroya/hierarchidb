import { useTranslation } from '@hierarchidb/ui-i18n';
import type { ShapeBuildConfig } from '~/common/types/BuildTaskResult';
import { TileEmitInvalidGeometryFilterCardView } from './TileEmitInvalidGeometryFilterCardView.js';
import { useTileEmitInvalidGeometryFilterCardState } from './useTileEmitInvalidGeometryFilterCardState.js';

type Props = {
  config: ShapeBuildConfig;
  onChange: (next: ShapeBuildConfig | ((prev: ShapeBuildConfig) => ShapeBuildConfig)) => void;
  disabled?: boolean;
  disableHoverLift?: boolean;
};

export const TileEmitInvalidGeometryFilterCard = ({
  config,
  onChange,
  disabled,
  disableHoverLift = false,
}: Props) => {
  const { t } = useTranslation('shape-plugin');
  const state = useTileEmitInvalidGeometryFilterCardState(config, onChange, disabled, {
    selfIntersection: t(
      'processing.tileEmit.invalidGeometryFilter.selfIntersection',
      'Self intersection'
    ),
    triangleRingRatio: t(
      'processing.tileEmit.invalidGeometryFilter.triangleRingRatio',
      'Triangle ring ratio'
    ),
    area: t('processing.tileEmit.invalidGeometryFilter.area', 'Area'),
    lineLength: t('processing.tileEmit.invalidGeometryFilter.lineLength', 'Line length'),
    maxEdgeLength: t('processing.tileEmit.invalidGeometryFilter.maxEdgeLength', 'Max edge length'),
  });

  return (
    <TileEmitInvalidGeometryFilterCardView
      {...state}
      disabled={Boolean(disabled)}
      disableHoverLift={disableHoverLift}
      title={t('processing.tileEmit.invalidGeometryFilter.title', 'Invalid geometry filtering')}
      description={t(
        'processing.tileEmit.invalidGeometryFilter.description',
        'Run additional invalid-shape checks immediately before vector-tile indexing.'
      )}
    />
  );
};
