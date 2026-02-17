import { ZoomBandConfigSection as SharedZoomBandConfigSection } from '@hierarchidb/ui-accordion-config';
import { useTranslation } from '../../i18n.js';
import { useTransformConfigSection } from './useTransformConfigSection.ts';
import type { ShapeBuildConfig } from '../../../common/types/index.js';

type Props = {
  config: ShapeBuildConfig;
  disabled?: boolean;
  onChange: (next: ShapeBuildConfig) => void;
};

export const ZoomBandConfigSection: React.FC<Props> = ({
  config,
  disabled,
  onChange,
}) => {
  const { t } = useTranslation();
  const { baseTransformConfig, update } = useTransformConfigSection({ config, onChange });

  return (
    <SharedZoomBandConfigSection
      t={t}
      boundaries={baseTransformConfig.zoomBandBoundaries}
      onBoundariesChange={(zoomBandBoundaries: number[]) =>
        update({
          transformConfig: {
            ...baseTransformConfig,
            zoomBandBoundaries,
          },
        })
      }
      disabled={disabled}
    />
  );
};
