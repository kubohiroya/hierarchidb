import type { MapViewState } from '@hierarchidb/ui-map';
import type { ShapePreviewMapView } from '~/common/types/index';

export const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export const arePreviewViewsClose = (
  a?: ShapePreviewMapView | null,
  b?: ShapePreviewMapView | null
): boolean => {
  if (!a || !b) return false;
  const eps = 1e-6;
  return (
    Math.abs(a.longitude - b.longitude) < eps &&
    Math.abs(a.latitude - b.latitude) < eps &&
    Math.abs(a.zoom - b.zoom) < eps
  );
};

export const toPreviewMapView = (viewState: MapViewState): ShapePreviewMapView | null => {
  const { longitude, latitude, zoom } = viewState;
  if (!isFiniteNumber(longitude) || !isFiniteNumber(latitude) || !isFiniteNumber(zoom)) {
    return null;
  }
  return { longitude, latitude, zoom };
};

export const isShapeLayerParentToggle = (toggleId: string): boolean =>
  toggleId === 'adm0' || toggleId === 'adm1' || toggleId === 'adm2';
