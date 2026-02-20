import type { Meta, StoryObj } from '@storybook/react';
import { Suspense, lazy, useMemo } from 'react';
import type { Feature, Polygon } from 'geojson';
import { TileLayer } from '@deck.gl/geo-layers';
import type { TileLayerProps } from '@deck.gl/geo-layers';
import { GeoJsonLayer } from '@deck.gl/layers';
import type { GeoJsonLayerProps } from '@deck.gl/layers';
import { DEFAULT_MAP_CONFIG, loadMapWithDeckGL } from '~/index';

const LazyMapWithDeckGL = lazy(async () => {
  const mod = await loadMapWithDeckGL();
  return { default: mod.MapWithDeckGL };
});

type PrefectureFeatureProperties = {
  name: string;
  prefecture: string;
  description: string;
};

type PrefectureFeature = Feature<Polygon, PrefectureFeatureProperties>;

type HighlightArgs = {
  /** Highlight features that matches this id */
  highlightId?: string;
  /** GeoJSON property key to test */
  matchProperty?: keyof PrefectureFeatureProperties;
  /** Expected property value to highlight */
  matchValue?: string;
};

const INITIAL_VIEW_STATE = {
  longitude: 139.7,
  latitude: 35.6,
  zoom: 9,
  pitch: 0,
  bearing: 0,
};

const BASE_FILL_COLOR: [number, number, number, number] = [180, 196, 210, 110];
const HIGHLIGHT_FILL_COLOR: [number, number, number, number] = [234, 102, 60, 210];
const OUTLINE_COLOR: [number, number, number, number] = [64, 64, 64, 220];

const PREFECTURE_FEATURES: PrefectureFeature[] = [
  {
    type: 'Feature',
    id: 'tokyo-central',
    properties: {
      name: 'Tokyo Station Area',
      prefecture: 'Tokyo',
      description: 'Represents the Marunouchi business district around Tokyo Station.',
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [139.75, 35.69],
          [139.77, 35.69],
          [139.77, 35.67],
          [139.75, 35.67],
          [139.75, 35.69],
        ],
      ],
    },
  },
  {
    type: 'Feature',
    id: 'yokohama-bay',
    properties: {
      name: 'Yokohama Bay Area',
      prefecture: 'Kanagawa',
      description: 'Covers the Minato Mirai district around Yokohama port.',
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [139.63, 35.47],
          [139.66, 35.47],
          [139.66, 35.44],
          [139.63, 35.44],
          [139.63, 35.47],
        ],
      ],
    },
  },
  {
    type: 'Feature',
    id: 'saitama-city',
    properties: {
      name: 'Saitama City Center',
      prefecture: 'Saitama',
      description: 'Highlights the Omiya district within Saitama prefecture.',
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [139.63, 35.92],
          [139.66, 35.92],
          [139.66, 35.89],
          [139.63, 35.89],
          [139.63, 35.92],
        ],
      ],
    },
  },
];

const PREFECTURE_IDS = PREFECTURE_FEATURES.map((feature) => feature.id as string);
const PREFECTURE_NAMES = Array.from(new Set(PREFECTURE_FEATURES.map((feature) => feature.properties.prefecture)));

type PrefectureTileProps = TileLayerProps<PrefectureFeature[]>;
type PrefectureGeoJsonProps = GeoJsonLayerProps<PrefectureFeatureProperties>;

const createVectorTileLayer = ({ highlightId, matchProperty, matchValue }: HighlightArgs) =>
  new TileLayer<PrefectureFeature[]>({
    id: 'prefecture-vector-tiles',
    tileSize: 512,
    minZoom: 5,
    maxZoom: 12,
    getTileData: () => PREFECTURE_FEATURES,
    renderSubLayers: (props: PrefectureTileProps & { id: string; data: PrefectureFeature[] }) => {
      const fillColorResolver: NonNullable<PrefectureGeoJsonProps['getFillColor']> = (feature) => {
        const featureId = feature.id != null ? String(feature.id) : undefined;
        const matchesId = highlightId ? featureId === highlightId : false;
        const matchesProperty = matchProperty && matchValue
          ? feature.properties?.[matchProperty] === matchValue
          : false;
        return matchesId || matchesProperty ? HIGHLIGHT_FILL_COLOR : BASE_FILL_COLOR;
      };

      const geoJsonProps: PrefectureGeoJsonProps = {
        id: `${props.id}-geojson`,
        data: props.data,
        stroked: true,
        filled: true,
        getLineColor: OUTLINE_COLOR,
        lineWidthMinPixels: 1.5,
        pickable: true,
        getFillColor: fillColorResolver,
        updateTriggers: {
          getFillColor: [highlightId, matchProperty, matchValue],
        },
      };

      return new GeoJsonLayer<PrefectureFeatureProperties>(geoJsonProps);
    },
  });

const VectorTileHighlightDemo = ({ highlightId, matchProperty, matchValue }: HighlightArgs) => {
  const layers = useMemo(
    () => [createVectorTileLayer({ highlightId, matchProperty, matchValue })],
    [highlightId, matchProperty, matchValue],
  );

  return (
    <Suspense
      fallback={
        <div
          style={{
            width: '100%',
            height: '520px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, rgba(15,23,42,0.08), rgba(15,23,42,0.02))',
            borderRadius: 12,
            boxShadow: 'inset 0 0 0 1px rgba(15, 23, 42, 0.08)',
            color: '#334155',
            fontSize: '0.9rem',
          }}
        >
          Loading Deck.gl layers…
        </div>
      }
    >
      <LazyMapWithDeckGL
        initialViewState={INITIAL_VIEW_STATE}
        mapStyleUrl={DEFAULT_MAP_CONFIG.mapStyleUrl}
        height="520px"
        deck={{
          layers,
          getTooltip: ({ object }: { object?: PrefectureFeature }) =>
            object
              ? {
                  text: `${object.properties?.name}\n${object.properties?.prefecture}`,
                }
              : null,
        }}
        style={{ minHeight: '520px', borderRadius: 12, overflow: 'hidden', boxShadow: '0 12px 30px rgba(15, 23, 42, 0.18)' }}
      />
    </Suspense>
  );
};

const meta = {
  title: 'Map/Deck.gl Vector Tiles/Feature Highlight',
  component: VectorTileHighlightDemo,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Deck.gl の TileLayer + GeoJsonLayer を利用して、指定した ID もしくはプロパティ値に一致するフィーチャーだけを強調表示します。',
      },
    },
  },
  argTypes: {
    highlightId: {
      options: PREFECTURE_IDS,
      control: { type: 'select' },
      description: '塗りつぶし対象にしたいフィーチャー ID',
    },
    matchProperty: {
      options: ['prefecture'],
      control: { type: 'select' },
      description: '判定に利用する GeoJSON プロパティのキー',
    },
    matchValue: {
      options: PREFECTURE_NAMES,
      control: { type: 'select' },
      description: '判定に利用する GeoJSON プロパティの値',
    },
  },
} satisfies Meta<typeof VectorTileHighlightDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const HighlightById: Story = {
  name: 'ID での強調表示',
  args: {
    highlightId: 'yokohama-bay',
    matchProperty: undefined,
    matchValue: undefined,
  },
  parameters: {
    docs: {
      description: {
        story: 'ID が `yokohama-bay` のタイルだけを Deck.gl のカラー設定で強調表示します。',
      },
    },
  },
};

export const HighlightByPropertyValue: Story = {
  name: 'プロパティ値での強調表示',
  args: {
    highlightId: undefined,
    matchProperty: 'prefecture',
    matchValue: 'Tokyo',
  },
  parameters: {
    docs: {
      description: {
        story: '`prefecture` プロパティが `Tokyo` のフィーチャーだけを塗り分ける例です。',
      },
    },
  },
};
