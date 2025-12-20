import React, { Suspense } from 'react';
import { Box, Typography, Alert } from '@mui/material';
import type { ShapeEntity } from '../../../common/types/index.js';
import { useTranslation } from '../../i18n.js';
import { loadMapWithVectorTiles, type MapWithVectorTilesProps } from '@hierarchidb/ui-map';
import type { ShapeDialogStepProps } from './ShapeDialogStepProps.ts';

type ShapePreviewDraft = Partial<ShapeEntity> & {
  tilesUrl?: string;
  tilesEndpoint?: string;
  tilesLayer?: string;
};

const DEFAULT_VIEW: MapWithVectorTilesProps['initialViewState'] = {
  longitude: 0,
  latitude: 20,
  zoom: 1.5,
};

export const ShapePreviewStep: React.FC<ShapeDialogStepProps> = ({ data }) => {
  const { t } = useTranslation();

  const previewDraft = data as ShapePreviewDraft;
  const tilesUrl = previewDraft.tilesUrl ?? previewDraft.tilesEndpoint ?? '';
  const tilesLayer = previewDraft.tilesLayer ?? 'default';

  if (!tilesUrl) {
    return (
      <Alert severity="info">
        {t('preview.noTiles', 'No vector tiles are available yet. Run the build to generate tiles.')}
      </Alert>
    );
  }

  return (
    <Box display="flex" flexDirection="column" gap={2} height={480}>
      <Typography variant="h6">{t('preview.title', 'Preview')}</Typography>
      <Typography variant="body2" color="text.secondary">
        {t('preview.description', 'Visualize generated vector tiles on the map.')}
      </Typography>
      <Box flex={1} minHeight={360} borderRadius={1} overflow="hidden" border="1px solid #e0e0e0">
        <Suspense fallback={null}>
          <LazyMapWithVectorTiles
            tiles={[tilesUrl]}
            layerConfig={{
              layerId: 'shape-preview',
              sourceLayer: tilesLayer,
              layerType: 'fill',
              paint: {
                'fill-color': '#3b82f6',
                'fill-opacity': 0.3,
                'fill-outline-color': '#1d4ed8',
              },
            }}
            initialViewState={DEFAULT_VIEW}
            style={{ width: '100%', height: '100%' }}
          />
        </Suspense>
      </Box>
    </Box>
  );
};

const LazyMapWithVectorTiles = React.lazy(async () => {
  const mod = await loadMapWithVectorTiles();
  return { default: mod.MapWithVectorTiles };
});
