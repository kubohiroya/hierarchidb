import { createElement, useMemo } from 'react';
import type { BuildStage } from '@hierarchidb/components';
import {
  CloudDownload as CloudDownloadIcon,
  Tune as TuneIcon,
  Layers as LayersIcon,
} from '@mui/icons-material';

type Translate = (key: string, fallback?: string) => string;

export const useShapeBuildStages = (t: Translate): BuildStage[] => {
  return useMemo(() => ([
    {
      id: 'fetch',
      title: t('processing.fetch.title', 'Fetch'),
      description: t('stage.stages.fetch.description', 'Fetch and normalize source data.'),
      icon: createElement(CloudDownloadIcon, { color: 'primary' }),
    },
    {
      id: 'transform',
      title: t('processing.transform.title', 'Transform'),
      description: t('stage.stages.transform.description', 'Simplify features per zoom band.'),
      icon: createElement(TuneIcon, { color: 'primary' }),
    },
    {
      id: 'vt',
      title: t('processing.vt.title', 'VT Generation'),
      description: t('stage.stages.vt.description', 'Generate vector tiles for the selected zoom range.'),
      icon: createElement(LayersIcon, { color: 'primary' }),
    },
  ]), [t]);
};
