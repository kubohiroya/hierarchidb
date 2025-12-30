import { useMemo } from 'react';
import type { BuildStage } from '@hierarchidb/components';
import {
  CloudDownload as CloudDownloadIcon,
  FilterAlt as FilterAltIcon,
  Tune as TuneIcon,
  Layers as LayersIcon,
} from '@mui/icons-material';
import { useTranslation } from '../../i18n.js';

export const useBuildStages = (): BuildStage[] => {
  const { t } = useTranslation();
  return useMemo(() => ([
    {
      id: 'download',
      title: t('processing.download.title', 'Download Setting / Cache Management'),
      description: t('stage.stages.download.description', 'Download and normalize source data.'),
      icon: <CloudDownloadIcon color="primary" />,
    },
    {
      id: 'extract1',
      title: t('processing.extract1.title', 'Primary Extraction'),
      description: t('stage.stages.extract1.description', 'Apply primary extraction for selections.'),
      icon: <FilterAltIcon color="primary" />,
    },
    {
      id: 'extract2',
      title: t('processing.extract2.title', 'Tile Preprocessing'),
      description: t('stage.stages.extract2.description', 'Prepare extracted buffers for tile generation.'),
      icon: <TuneIcon color="primary" />,
    },
    {
      id: 'vectorTiles',
      title: t('processing.tile.title', 'Tile Generation Setting'),
      description: t('stage.stages.vectorTiles.description', 'Generate vector tiles for the selected zoom range.'),
      icon: <LayersIcon color="primary" />,
    },
  ]), [t]);
};
