import type { Meta, StoryObj } from '@storybook/react';
import type React from 'react';
import { useCallback, useState } from 'react';
import { Box, Divider, Paper, Stack, Typography } from '@mui/material';
import { MapLibreMap } from './MapLibreMap.js';
import type { MapLibreMapInstance } from '../types/maplibre-public.js';
import type {
  MapClickEvent,
  MapFeatureIdentifyResult,
  MapFeatureIdentifier,
} from '../types/unified-map-props.js';

const DEMO_SOURCE_ID = 'demo-click-points';
const DEMO_LAYER_ID = 'demo-click-points-layer';
const DEMO_LABEL_LAYER_ID = 'demo-click-points-label';

const DEMO_POINTS_GEOJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'tokyo-station',
      properties: {
        name: '東京駅',
      },
      geometry: {
        type: 'Point',
        coordinates: [139.767125, 35.681236],
      },
    },
    {
      type: 'Feature',
      id: 'osaka-station',
      properties: {
        name: '大阪駅',
      },
      geometry: {
        type: 'Point',
        coordinates: [135.498302, 34.702485],
      },
    },
    {
      type: 'Feature',
      id: 'sapporo-station',
      properties: {
        name: '札幌駅',
      },
      geometry: {
        type: 'Point',
        coordinates: [141.350755, 43.068661],
      },
    },
  ],
} as const;

const ensureDemoLayers = (map: MapLibreMapInstance) => {
  if (!map.getSource(DEMO_SOURCE_ID)) {
    map.addSource(DEMO_SOURCE_ID, {
      type: 'geojson',
      data: DEMO_POINTS_GEOJSON as unknown,
    } as Record<string, unknown>);
  }

  if (!map.getLayer(DEMO_LAYER_ID)) {
    map.addLayer({
      id: DEMO_LAYER_ID,
      type: 'circle',
      source: DEMO_SOURCE_ID,
      paint: {
        'circle-radius': 10,
        'circle-color': '#F57C00',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
      },
    });
  }

  if (!map.getLayer(DEMO_LABEL_LAYER_ID)) {
    map.addLayer({
      id: DEMO_LABEL_LAYER_ID,
      type: 'symbol',
      source: DEMO_SOURCE_ID,
      layout: {
        'text-field': ['get', 'name'],
        'text-size': 14,
        'text-offset': [0, 1.2],
        'text-anchor': 'top',
      },
      paint: {
        'text-color': '#1a237e',
      },
    });
  }
};

const meta = {
  title: 'UI Map/MapLibreMap',
  component: MapLibreMap,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof MapLibreMap>;

export default meta;
type Story = StoryObj<typeof meta>;

const FeatureIdentifyContent: React.FC = () => {
  const [identifyResult, setIdentifyResult] = useState<MapFeatureIdentifyResult | null>(null);
  const [eventIds, setEventIds] = useState<MapFeatureIdentifier[]>([]);

  const handleMapLoad = useCallback((map: MapLibreMapInstance) => {
    ensureDemoLayers(map);
  }, []);

  const handleIdentify = useCallback((result: MapFeatureIdentifyResult) => {
    setIdentifyResult(result);
  }, []);

  const handleClick = useCallback((event: MapClickEvent) => {
    setEventIds(event.identifiedFeatureIds ?? []);
  }, []);

  const identifyItems = identifyResult?.featureIds ?? [];

  return (
    <Stack spacing={2} sx={{ height: '100%', p: 2 }}>
      <Box sx={{ flexGrow: 1, minHeight: 360, borderRadius: 2, overflow: 'hidden', boxShadow: 1 }}>
        <MapLibreMap
          width="100%"
          height="100%"
          initialViewState={{ longitude: 137.0, latitude: 37.5, zoom: 4.5 }}
          identifyFeatureOnClick={{
            layerIds: [DEMO_LAYER_ID],
            radius: 12,
            onIdentify: handleIdentify,
          }}
          onLoad={handleMapLoad}
          onClick={handleClick}
        />
      </Box>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          クリックしたフィーチャー
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          identifyFeatureOnClick（radius=12px, layerIds で絞り込み）と onClick(event.identifiedFeatureIds)
          の出力例です。queryRenderedFeatures で見つからない場合は event.features からフォールバックします。
        </Typography>
        <Divider sx={{ my: 1.5 }} />
        <Typography variant="subtitle2">identifyFeatureOnClick.onIdentify</Typography>
        {identifyItems.length ? (
          <Stack component="ul" spacing={0.5} sx={{ pl: 3, my: 1 }}>
            {identifyItems.map((id: MapFeatureIdentifier) => (
              <Typography component="li" variant="body2" key={`identify-${String(id)}`}>
                {String(id)}
              </Typography>
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            まだフィーチャーはクリックされていません。
          </Typography>
        )}
        <Divider sx={{ my: 1.5 }} />
        <Typography variant="subtitle2">onClick: event.identifiedFeatureIds</Typography>
        {eventIds.length ? (
          <Stack component="ul" spacing={0.5} sx={{ pl: 3, my: 1 }}>
            {eventIds.map((id: MapFeatureIdentifier) => (
              <Typography component="li" variant="body2" key={`event-${String(id)}`}>
                {String(id)}
              </Typography>
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            こちらもクリックすると更新されます。
          </Typography>
        )}
      </Paper>
    </Stack>
  );
};

export const IdentifyFeaturesOnClick: Story = {
  name: 'フィーチャーIDの取得',
  args: {
    initialViewState: { longitude: 137.0, latitude: 37.5, zoom: 4.5 },
  },
  render: () => <FeatureIdentifyContent />,
};
