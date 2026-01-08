import { useMemo } from 'react';
import type { BuildStage } from '@hierarchidb/components';
import {
  CloudDownload as CloudDownloadIcon,
  Tune as TuneIcon,
  Layers as LayersIcon,
} from '@mui/icons-material';
import { useTranslation } from '../../i18n.js';

export const useBuildStages = (): BuildStage[] => {
  const { t } = useTranslation();
  return useMemo(() => ([
    {
      id: 'fetch',
      title: t('processing.fetch.title', 'Fetch / Cache Management'),
      description: t('stage.stages.fetch.description', 'Fetch and normalize source data.'),
      icon: <CloudDownloadIcon color="primary" />,
    },
    {
      id: 'transform',
      title: t('processing.transform.title', 'Transform'),
      description: t('stage.stages.transform.description', 'Simplify and index buffers for tile generation.'),
      icon: <TuneIcon color="primary" />,
    },
    {
      id: 'vt',
      title: t('processing.vt.title', 'VT Generation'),
      description: t('stage.stages.vt.description', 'Generate vector tiles for the selected zoom range.'),
      icon: <LayersIcon color="primary" />,
    },
  ]), [t]);
};
