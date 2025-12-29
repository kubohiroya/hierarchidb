import { atom } from 'jotai';

export type MapNodeType = 'shape' | 'location' | 'route';

export type MapSearchTargetId =
  | 'pointName'
  | 'pointAirportCode'
  | 'pointPortCode'
  | 'pointStationCode'
  | 'routeName'
  | 'shapeRegionName'
  | 'shapeCountryName'
  | 'shapeRegionCode'
  | 'shapeCountryCode';

export type MapSearchTargetSelection = Record<MapSearchTargetId, boolean>;

export const mapSearchTextAtom = atom('');

export type MapHighlightEntry = {
  source: string;
  id: string | number;
  nodeId?: string;
  nodeType?: MapNodeType;
  layerId?: string;
};

export type MapLayerInfo = {
  nodeId: string;
  nodeType: MapNodeType;
  layerId: string;
  sourceId: string;
};

export type MapViewportFeatureIds = Record<
  string,
  Partial<Record<MapNodeType, Array<string | number>>>
>;

export const mapSearchMatchesAtom = atom<MapHighlightEntry[]>([]);

export const mapHoverMatchAtom = atom<MapHighlightEntry | null>(null);

export const mapSelectedMatchAtom = atom<MapHighlightEntry | null>(null);

export const mapLayerInfoAtom = atom<MapLayerInfo[]>([]);

export const mapViewportFeatureIdsAtom = atom<MapViewportFeatureIds | null>(null);

export const mapSearchTargetSelectionAtom = atom<MapSearchTargetSelection>({
  pointName: true,
  pointAirportCode: true,
  pointPortCode: true,
  pointStationCode: true,
  routeName: true,
  shapeRegionName: true,
  shapeCountryName: true,
  shapeRegionCode: true,
  shapeCountryCode: true,
});
