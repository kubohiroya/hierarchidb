import { useMemo } from 'react';
import type { BuildStage } from '@hierarchidb/components';
import {
  CloudDownload as CloudDownloadIcon,
  Tune as TuneIcon,
  FilterAlt as FilterAltIcon,
  Layers as LayersIcon,
} from '@mui/icons-material';
import { useTranslation } from '../../i18n.js';

export const useBuildStages = (): BuildStage[] => {
  const { t } = useTranslation();
  return useMemo(() => ([
    {
      id: 'fetch',
      title: t('processing.fetch.title', 'Fetch'),
      description: t('stage.stages.fetch.description', 'Fetch and normalize source data.'),
      icon: <CloudDownloadIcon color="primary" />,
    },
    {
      id: 'transform-by-band',
      title: t('processing.transformByBand.title', 'Transform by band'),
      description: t('stage.stages.transformByBand.description', 'Simplify features per zoom band.'),
      icon: <TuneIcon color="primary" />,
    },
    {
      id: 'transform-by-zoom',
      title: t('processing.transformByZoom.title', 'Transform by zoom'),
      description: t('stage.stages.transformByZoom.description', 'Build tile indexes per zoom band.'),
      icon: <FilterAltIcon color="primary" />,
    },
    {
      id: 'vt',
      title: t('processing.vt.title', 'VT Generation'),
      description: t('stage.stages.vt.description', 'Generate vector tiles for the selected zoom range.'),
      icon: <LayersIcon color="primary" />,
    },
  ]), [t]);
};
