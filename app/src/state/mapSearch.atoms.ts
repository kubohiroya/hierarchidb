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

export type MapFeatureIdSet = Record<
  string,
  Partial<Record<MapNodeType, Set<string | number>>>
>;

export const mapSearchMatchesAtom = atom<MapFeatureIdSet>({});

export const mapHoverMatchAtom = atom<MapFeatureIdSet>({});

export const mapSelectedMatchAtom = atom<MapFeatureIdSet>({});

export const mapLayerInfoAtom = atom<MapLayerInfo[]>([]);

export const mapViewportFeatureIdsAtom = atom<MapFeatureIdSet | null>(null);

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

export const mapStylerToggleAtom = atom<Record<string, boolean>>({});
