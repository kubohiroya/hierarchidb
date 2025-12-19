import React, { Suspense } from 'react';
import { Box, Typography, Alert } from '@mui/material';
import type { ShapeEntity } from '../../../common/types/index.js';
import { useTranslation } from '../../i18n.js';
import { loadMapWithVectorTiles, type MapWithVectorTilesProps } from '@hierarchidb/ui-map';

type Props = {
  draft: Partial<ShapeEntity>;
};

const DEFAULT_VIEW: MapWithVectorTilesProps['initialViewState'] = {
  longitude: 0,
  latitude: 20,
  zoom: 1.5,
};

export const ShapePreviewStep: React.FC<Props> = ({ draft }) => {
  const { t } = useTranslation();

  const tilesUrl = (draft as any)?.tilesUrl || (draft as any)?.tilesEndpoint || '';
  const tilesLayer = (draft as any)?.tilesLayer || 'default';

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
            tiles={{
              url: tilesUrl,
            } as any}
            layerConfig={{
              id: 'shape-preview',
              sourceLayer: tilesLayer,
              fillColor: '#3b82f6',
              fillOpacity: 0.3,
              outlineColor: '#1d4ed8',
              lineColor: '#1d4ed8',
              lineWidth: 1.5,
            } as any}
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
