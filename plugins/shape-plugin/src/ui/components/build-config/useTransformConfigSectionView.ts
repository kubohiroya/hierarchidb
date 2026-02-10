import { useTranslation } from '../../i18n.js';
import { useTransformConfigSection } from './useTransformConfigSection.ts';
import type { ShapeBuildConfig } from '../../../common/types/index.js';
export const useTransformConfigSectionView = ({
  config,
  onChange,
}: {
  config: ShapeBuildConfig;
  onChange: (next: ShapeBuildConfig) => void;
}) => {
  const { t } = useTranslation();
  const { baseTransformConfig, update } = useTransformConfigSection({ config, onChange });

  const handleTransformWorkersChange = (maxConcurrent: number) => {
    update({
      transformConfig: {
        ...baseTransformConfig,
        maxConcurrent,
      },
    });
  };

  return {
    t,
    baseTransformConfig,
    handleTransformWorkersChange,
  };
};
