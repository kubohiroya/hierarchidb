import type React from 'react';
import type { LayerSetId } from '~/preview/layerSetDefinitions';
import type { MapLibreFilter, MapLibreGeoJSONFeature, MapLibreStyle } from '~/types/maplibre-public';
import type { SxProps, Theme } from '@mui/material/styles';
import type { MapLibreMapProps } from '../MapLibreMap.js';
import type { VectorTileDataSource, VectorTileLayerConfig, BaseMapProps } from '~/types/unified-map-props';
import type { MapAttributionItem } from '~/types/attribution';
import type { MapHighlightEntry } from '~/interaction/mapInteractionStore';
import type { MapSearchTargetDefinition, MapSearchTargetGroup } from '~/preview/mapPreviewSearchTypes';
import type { FeatureCollection } from 'geojson';

export type BasemapStyleEntry = {
  nodeId: string;
  absolutePath?: string;
  style: string | MapLibreStyle;
};

export type MapLayerType = NonNullable<VectorTileLayerConfig['layerType']>;
export type LayerStyleOverrides = Partial<Record<MapLayerType, Record<string, unknown>>>;
export type Bounds = { minLng: number; minLat: number; maxLng: number; maxLat: number };

export type ResourceVectorLayer = VectorTileDataSource & {
  nodeId: string;
  nodeType: 'shape' | 'location' | 'route';
  dataSourceName?: string;
  absolutePath?: string;
  layerConfig?: VectorTileLayerConfig;
  layerSetId?: LayerSetId;
  layerPriority?: number;
  hierarchyLevel?: number;
  layerLabel?: string;
};

export type ResourceGeoJsonLayer = {
  layerId: string;
  sourceId: string;
  data: FeatureCollection;
  layerType: 'line' | 'circle' | 'fill' | 'symbol';
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
  filter?: MapLibreFilter;
  beforeId?: string;
  absolutePath?: string;
  layerSetId?: LayerSetId;
  layerPriority?: number;
  hierarchyLevel?: number;
  layerLabel?: string;
};

export type ResourceLayerMapProps = BaseMapProps & {
  basemapStyles?: BasemapStyleEntry[];
  vectorLayers: ResourceVectorLayer[];
  geoJsonLayers?: ResourceGeoJsonLayer[];
  styleOverrides?: Record<string, unknown>;
  styleOverridesByType?: LayerStyleOverrides;
  highlightOverridesByType?: LayerStyleOverrides;
  attributionItems?: MapAttributionItem[];
  controls?: MapLibreMapProps['controls'];
  hoveredFeatures?: MapLibreGeoJSONFeature[];
  snackbar?: {
    position?: 'top' | 'bottom' | 'bottom-center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    content?: React.ReactNode;
    renderContent?: (features: MapLibreGeoJSONFeature[]) => React.ReactNode;
    autoHideDuration?: number | null;
    open?: boolean;
    contentSx?: SxProps<Theme>;
  };
  interaction?: {
    enabled?: boolean;
    highlightLayerIds?: string[];
    buildHighlightEntry?: (feature?: MapLibreGeoJSONFeature | null) => MapHighlightEntry | null;
    onMissingLayers?: (layerIds: string[]) => void;
    search?: {
      enabled?: boolean;
      targetDefinitions?: Record<string, MapSearchTargetDefinition>;
      targetGroups?: Array<MapSearchTargetGroup<string>>;
      placeholder?: string;
      showSettings?: boolean;
      fitOnSearch?: boolean;
      fitPadding?: number;
    };
    hover?: {
      enabled?: boolean;
      radius?: number;
    };
    selection?: {
      enabled?: boolean;
      radius?: number;
    };
    fitSelection?: {
      enabled?: boolean;
      padding?: number;
    };
    snackbar?: {
      enabled?: boolean;
      position?: 'top' | 'bottom' | 'bottom-center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
      content?: React.ReactNode;
      renderContent?: (features: MapLibreGeoJSONFeature[]) => React.ReactNode;
      autoHideDuration?: number | null;
      open?: boolean;
      contentSx?: SxProps<Theme>;
    };
  };
  stats?: {
    enabled?: boolean;
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    display?: 'overlay' | 'floating';
    renderExtra?: () => React.ReactNode;
    floatingWindow?: {
      title?: string;
      titleIcon?: React.ReactNode;
      initialState?: import('@hierarchidb/ui-floating-window').WindowState;
      resizable?: boolean;
      draggable?: boolean;
      minWidth?: number;
      minHeight?: number;
      maxWidth?: number;
      maxHeight?: number;
      showToggleButton?: boolean;
      toggleButtonIcon?: React.ReactNode;
      toggleButtonPosition?: {
        top?: number;
        right?: number;
        bottom?: number;
        left?: number;
      };
    };
  };
};
