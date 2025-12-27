import { atom } from 'jotai';

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

export type MapHighlightEntry = { source: string; id: string | number };

export const mapSearchMatchesAtom = atom<MapHighlightEntry[]>([]);

export const mapHoverMatchAtom = atom<MapHighlightEntry | null>(null);

export const mapSelectedMatchAtom = atom<MapHighlightEntry | null>(null);

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
