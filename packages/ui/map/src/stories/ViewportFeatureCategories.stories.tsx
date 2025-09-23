import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Source, Layer } from '@vis.gl/react-maplibre';
import { MapLibreMap } from '../components/MapLibreMap.js';
import type { MapLibreMapInstance } from '../types/maplibre-public.js';
import { DEFAULT_MAP_CONFIG } from '../types/unified-map-props.js';
import type { MapViewState } from '../types/unified-map-props.js';

type Position = [number, number];

type Geometry =
  | { type: 'Point'; coordinates: Position }
  | { type: 'MultiPoint'; coordinates: Position[] }
  | { type: 'LineString'; coordinates: Position[] }
  | { type: 'Polygon'; coordinates: Position[][] }
  | { type: 'MultiLineString'; coordinates: Position[][] }
  | { type: 'MultiPolygon'; coordinates: Position[][][] }
  | { type: 'GeometryCollection'; geometries: Geometry[] };

type FeatureCategory = 'shape' | 'route' | 'location';

interface DemoFeatureProperties {
  id: string;
  name: string;
  category: FeatureCategory;
  summary: string;
}

type DemoFeature = {
  type: 'Feature';
  geometry: Geometry;
  properties: DemoFeatureProperties;
  id?: string;
};

type DemoFeatureCollection = {
  type: 'FeatureCollection';
  features: DemoFeature[];
};

interface BoundingBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

interface FeatureWithBounds {
  feature: DemoFeature;
  bounds: BoundingBox;
}

const CATEGORY_ORDER: FeatureCategory[] = ['shape', 'route', 'location'];

const CATEGORY_LABELS: Record<FeatureCategory, string> = {
  shape: 'シェイプ',
  route: 'ルート',
  location: 'ロケーション',
};

const CATEGORY_COLORS: Record<FeatureCategory, string> = {
  shape: '#26a69a',
  route: '#ef5350',
  location: '#3949ab',
};

const isFeatureCategory = (value: unknown): value is FeatureCategory =>
  typeof value === 'string' && (CATEGORY_ORDER as readonly string[]).includes(value);

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: 139.767,
  latitude: 35.681,
  zoom: 12.3,
  bearing: 0,
  pitch: 0,
};

const formatNumber = (value: number, digits = 3): string => value.toFixed(digits);

const createBoundsFromPositions = (positions: Position[]): BoundingBox => {
  const first = positions[0];

  if (!first || first.length < 2) {
    return { minLng: 0, minLat: 0, maxLng: 0, maxLat: 0 };
  }

  let minLng = first[0] ?? 0;
  let minLat = first[1] ?? 0;
  let maxLng = minLng;
  let maxLat = minLat;

  for (let index = 1; index < positions.length; index += 1) {
    const point = positions[index];

    if (!point || point.length < 2) {
      continue;
    }

    const lng = point[0] ?? minLng;
    const lat = point[1] ?? minLat;
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  return { minLng, minLat, maxLng, maxLat };
};

const flattenPolygonPositions = (coordinates: Position[][]): Position[] => {
  const flattened: Position[] = [];
  coordinates.forEach((ring) => {
    ring.forEach((position) => {
      flattened.push(position);
    });
  });
  return flattened;
};

const flattenMultiLinePositions = (coordinates: Position[][]): Position[] => {
  const flattened: Position[] = [];
  coordinates.forEach((line) => {
    line.forEach((position) => {
      flattened.push(position);
    });
  });
  return flattened;
};

const flattenMultiPolygonPositions = (coordinates: Position[][][]): Position[] => {
  const flattened: Position[] = [];
  coordinates.forEach((polygon) => {
    flattenPolygonPositions(polygon).forEach((position) => {
      flattened.push(position);
    });
  });
  return flattened;
};

const collectPositions = (geometry: Geometry): Position[] => {
  switch (geometry.type) {
    case 'Point':
      return [geometry.coordinates];
    case 'MultiPoint':
    case 'LineString':
      return geometry.coordinates;
    case 'MultiLineString':
      return flattenMultiLinePositions(geometry.coordinates);
    case 'Polygon':
      return flattenPolygonPositions(geometry.coordinates);
    case 'MultiPolygon':
      return flattenMultiPolygonPositions(geometry.coordinates);
    case 'GeometryCollection': {
      const collected: Position[] = [];
      geometry.geometries.forEach((innerGeometry: Geometry) => {
        collected.push(...collectPositions(innerGeometry));
      });
      return collected;
    }
    default:
      return [];
  }
};

const computeGeometryBounds = (geometry: Geometry): BoundingBox =>
  createBoundsFromPositions(collectPositions(geometry));

const boundsIntersect = (a: BoundingBox, b: BoundingBox): boolean =>
  !(a.maxLng < b.minLng ||
    a.minLng > b.maxLng ||
    a.maxLat < b.minLat ||
    a.minLat > b.maxLat);

type MapLibreMapWithBounds = MapLibreMapInstance & {
  getBounds: () => {
    getWest(): number;
    getSouth(): number;
    getEast(): number;
    getNorth(): number;
  };
};

const DEMO_FEATURES: DemoFeature[] = [
  {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [139.7486, 35.687],
          [139.7589, 35.687],
          [139.7589, 35.6935],
          [139.7486, 35.6935],
          [139.7486, 35.687],
        ],
      ],
    },
    properties: {
      id: 'shape-imperial-gardens',
      name: '皇居外苑のグリーンベルト',
      category: 'shape',
      summary: '皇居を囲む緑地帯のシェイプ境界。',
    },
  },
  {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [139.7675, 35.709],
          [139.7736, 35.709],
          [139.7736, 35.7175],
          [139.7675, 35.7175],
          [139.7675, 35.709],
        ],
      ],
    },
    properties: {
      id: 'shape-ueno-park',
      name: '上野恩賜公園の園地',
      category: 'shape',
      summary: '上野公園をカバーする代表的なシェイプ。',
    },
  },
  {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: [
        [139.7521, 35.6883],
        [139.7545, 35.684],
        [139.7595, 35.6823],
        [139.764, 35.6855],
        [139.7601, 35.689],
        [139.754, 35.6907],
        [139.7521, 35.6883],
      ],
    },
    properties: {
      id: 'route-imperial-run',
      name: '皇居ランニングルート',
      category: 'route',
      summary: '皇居外周を一周するランニング動線。',
    },
  },
  {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: [
        [139.792, 35.708],
        [139.7955, 35.7035],
        [139.801, 35.699],
        [139.806, 35.695],
      ],
    },
    properties: {
      id: 'route-sumida-riverwalk',
      name: '隅田川リバーウォーク',
      category: 'route',
      summary: '隅田川沿いの水辺散策ルート。',
    },
  },
  {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [139.767125, 35.681236],
    },
    properties: {
      id: 'location-tokyo-station',
      name: '東京駅（丸の内口）',
      category: 'location',
      summary: '都内最大の交通結節点。',
    },
  },
  {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [139.796722, 35.714765],
    },
    properties: {
      id: 'location-sensoji',
      name: '浅草寺 本堂',
      category: 'location',
      summary: '浅草を代表する観光ランドマーク。',
    },
  },
];

const DEMO_COLLECTION: DemoFeatureCollection = {
  type: 'FeatureCollection',
  features: DEMO_FEATURES,
};

const FEATURES_WITH_BOUNDS: FeatureWithBounds[] = DEMO_FEATURES.map((feature) => ({
  feature,
  bounds: computeGeometryBounds(feature.geometry),
}));

interface GroupedFeatures {
  shape: DemoFeature[];
  route: DemoFeature[];
  location: DemoFeature[];
}

const createEmptyGroups = (): GroupedFeatures => ({
  shape: [],
  route: [],
  location: [],
});

interface FeatureListProps {
  groups: GroupedFeatures;
  bounds: BoundingBox | null;
  viewState: MapViewState | null;
}

const FeatureList: React.FC<FeatureListProps> = ({ groups, bounds, viewState }) => {
  const totalCount = useMemo(
    () => CATEGORY_ORDER.reduce((sum, category) => sum + groups[category].length, 0),
    [groups],
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        height: '100%',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: '1rem',
              fontWeight: 600,
            }}
          >
            表示範囲のサマリー
          </h3>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#555' }}>
            地図をドラッグまたはズームすると、ビューポート内のフィーチャーがタイプ別に集計されます。
          </p>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: '0.25rem 0.5rem',
            fontSize: '0.85rem',
            color: '#333',
            background: '#f7f7f7',
            borderRadius: 8,
            padding: '0.75rem',
          }}
        >
          <span>ズーム</span>
          <span>{viewState ? formatNumber(viewState.zoom, 2) : '—'}</span>
          <span>西端</span>
          <span>{bounds ? `${formatNumber(bounds.minLng)}°` : '—'}</span>
          <span>東端</span>
          <span>{bounds ? `${formatNumber(bounds.maxLng)}°` : '—'}</span>
          <span>南端</span>
          <span>{bounds ? `${formatNumber(bounds.minLat)}°` : '—'}</span>
          <span>北端</span>
          <span>{bounds ? `${formatNumber(bounds.maxLat)}°` : '—'}</span>
          <span>合計</span>
          <span>{totalCount} 件</span>
        </div>
      </div>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          paddingRight: '0.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        {CATEGORY_ORDER.map((category) => (
          <section
            key={category}
            style={{
              border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: 8,
              padding: '0.75rem',
              background: '#fff',
              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)',
            }}
          >
            <header
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.5rem',
                marginBottom: '0.5rem',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: category === 'location' ? '50%' : '2px',
                    background: CATEGORY_COLORS[category],
                    boxShadow: '0 0 0 1px rgba(0,0,0,0.1)',
                  }}
                />
                <strong style={{ fontSize: '0.9rem' }}>{CATEGORY_LABELS[category]}</strong>
              </span>
              <span style={{ fontSize: '0.85rem', color: '#555' }}>{groups[category].length} 件</span>
            </header>
            {groups[category].length === 0 ? (
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#777' }}>
                表示範囲内に該当するフィーチャーはありません。
              </p>
            ) : (
              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                {groups[category].map((feature) => (
                  <li key={feature.properties.id} style={{ fontSize: '0.85rem', color: '#333' }}>
                    <strong style={{ display: 'block', fontSize: '0.9rem' }}>{feature.properties.name}</strong>
                    <span style={{ color: '#555' }}>{feature.properties.summary}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
};

const ViewportFeatureDemo: React.FC = () => {
  const mapRef = useRef<MapLibreMapWithBounds | null>(null);
  const [groupedFeatures, setGroupedFeatures] = useState<GroupedFeatures>(createEmptyGroups);
  const [bounds, setBounds] = useState<BoundingBox | null>(null);
  const [viewState, setViewState] = useState<MapViewState | null>(INITIAL_VIEW_STATE);

  const recomputeVisibleFeatures = useCallback(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const currentBounds = map.getBounds();
    const normalizedBounds: BoundingBox = {
      minLng: currentBounds.getWest(),
      minLat: currentBounds.getSouth(),
      maxLng: currentBounds.getEast(),
      maxLat: currentBounds.getNorth(),
    };

    const nextGroups = createEmptyGroups();
    FEATURES_WITH_BOUNDS.forEach(({ feature, bounds: featureBounds }) => {
      if (!boundsIntersect(featureBounds, normalizedBounds)) {
        return;
      }

      const category = feature.properties.category;

      if (!isFeatureCategory(category)) {
        return;
      }

      nextGroups[category].push(feature);
    });

    setGroupedFeatures(nextGroups);
    setBounds(normalizedBounds);
  }, []);

  const handleMapLoad = useCallback(
    (mapInstance: MapLibreMapInstance) => {
      mapRef.current = mapInstance as MapLibreMapWithBounds;
      recomputeVisibleFeatures();
    },
    [recomputeVisibleFeatures],
  );

  const handleViewStateChange = useCallback(
    (nextViewState: MapViewState) => {
      setViewState(nextViewState);
      recomputeVisibleFeatures();
    },
    [recomputeVisibleFeatures],
  );

  return (
    <div
      style={{
        display: 'flex',
        gap: '1rem',
        height: '520px',
        padding: '1rem',
        boxSizing: 'border-box',
        background: '#f0f3f7',
        borderRadius: 12,
      }}
    >
      <div
        style={{
          flex: '1 1 60%',
          minWidth: 0,
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 10px 25px rgba(15, 23, 42, 0.12)',
        }}
      >
        <MapLibreMap
          initialViewState={INITIAL_VIEW_STATE}
          mapStyle={DEFAULT_MAP_CONFIG.mapStyle}
          width="100%"
          height="100%"
          controls={{ navigation: true, scale: true }}
          onLoad={handleMapLoad}
          onViewStateChange={handleViewStateChange}
        >
          <Source id="demo-viewport-features" type="geojson" data={DEMO_COLLECTION}>
            <Layer
              id="demo-shape-fill"
              type="fill"
              paint={{ 'fill-color': 'rgba(38, 166, 154, 0.35)', 'fill-outline-color': '#1f8f85' }}
              filter={['==', ['get', 'category'], 'shape']}
            />
            <Layer
              id="demo-route-line"
              type="line"
              paint={{ 'line-color': CATEGORY_COLORS.route, 'line-width': 3 }}
              filter={['==', ['get', 'category'], 'route']}
            />
            <Layer
              id="demo-location-points"
              type="circle"
              paint={{
                'circle-color': CATEGORY_COLORS.location,
                'circle-radius': 6,
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 2,
              }}
              filter={['==', ['get', 'category'], 'location']}
            />
          </Source>
        </MapLibreMap>
      </div>
      <div
        style={{
          flex: '1 1 40%',
          minWidth: 0,
          background: '#ffffff',
          borderRadius: 12,
          padding: '1rem',
          boxShadow: '0 10px 25px rgba(15, 23, 42, 0.08)',
          display: 'flex',
        }}
      >
        <FeatureList groups={groupedFeatures} bounds={bounds} viewState={viewState} />
      </div>
    </div>
  );
};

const meta: Meta<typeof MapLibreMap> = {
  title: 'UI/Map/Viewport Feature Categories',
  component: MapLibreMap,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'MapLibreのビューポート内にあるシェイプ・ルート・ロケーションのフィーチャーをグルーピングして一覧表示するデモです。',
      },
    },
  },
};

type Story = StoryObj<typeof MapLibreMap>;

export const FeaturesGroupedByCategory: Story = {
  render: () => <ViewportFeatureDemo />,
};

export default meta;
