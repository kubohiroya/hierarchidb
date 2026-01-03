import type {
  FeatureStateEntry,
  MapLibreStyle,
  MapViewState,
} from '@hierarchidb/ui-plugin-shell/ui-map';

export type MapSearch = {
  zxy?: string;
};

export type BasemapStyleEntry = {
  nodeId: string;
  absolutePath?: string;
  style: string | MapLibreStyle;
};

export type LayerStyleOverrides = Partial<
  Record<'fill' | 'line' | 'circle' | 'symbol', Record<string, unknown>>
>;

export type FeatureStateBundle = {
  featureIdProperty: string;
  entries: FeatureStateEntry[];
};

export type MapStyle = {
  style: 'streets' | 'satellite' | 'terrain' | 'dark' | 'light' | 'custom';
  customStyleUrl?: string;
  customStyleConfig?: Record<string, unknown>;
};

export type PersistedZxyHandler = (viewState: MapViewState) => void;
