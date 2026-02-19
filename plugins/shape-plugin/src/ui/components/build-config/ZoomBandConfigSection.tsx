import { ZoomBandConfigSection as SharedZoomBandConfigSection } from '@hierarchidb/ui-accordion-config';
import { useTranslation } from '~/ui/i18n';
import { useTransformConfigSection } from '~/ui/hooks/useTransformConfigSection';
import type { ShapeBuildConfig } from '~/common/types/index';

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
