import type { LocationType, NodeId } from '~/common/types/index';

export interface PreviewLocationPoint {
  id: string;
  name: string;
  nameEn?: string;
  type: LocationType;
  countryCode: string;
  coordinates: [number, number];
  properties: Record<string, unknown>;
}

export type DisplayMode = 'points' | 'clusters' | 'heatmap';

export interface MapStatistics {
  totalPoints: number;
  visiblePoints: number;
  clusters: number;
  density: number;
  viewport: {
    bounds: [[number, number], [number, number]];
    zoom: number;
    center: [number, number];
  };
  distribution: {
    byType: Record<LocationType, number>;
    byCountry: Record<string, number>;
  };
}

export interface LocationMapPreviewProps {
  nodeId: NodeId;
  locations: PreviewLocationPoint[];
  onLocationSelect?: (location: PreviewLocationPoint) => void;
}
