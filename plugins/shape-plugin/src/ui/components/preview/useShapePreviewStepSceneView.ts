import { useFloatingWindow } from '@hierarchidb/components';
import type { MapViewState } from '@hierarchidb/ui-map';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ShapePreviewMapView } from '~/common/types/index';

type ShapePreviewDebugFlags = {
  hideLayerSetsFloatingWindow: boolean;
  hideMapPreview: boolean;
};

const parseDebugFlag = (value: string | null): boolean => {
  if (value === null) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'on' || normalized === 'yes';
};

const getShapePreviewDebugFlags = (): ShapePreviewDebugFlags => {
  if (typeof window === 'undefined') {
    return { hideLayerSetsFloatingWindow: false, hideMapPreview: false };
  }

  const params = new URLSearchParams(window.location.search);
  const queryValue = params.get('hdbNoShapeLayerSetsWindow');
  const mapQueryValue = params.get('hdbNoShapePreviewMap');
  const storageValue = window.localStorage.getItem('hdbNoShapeLayerSetsWindow');
  const mapStorageValue = window.localStorage.getItem('hdbNoShapePreviewMap');
  return {
    hideLayerSetsFloatingWindow: parseDebugFlag(queryValue ?? storageValue),
    hideMapPreview: parseDebugFlag(mapQueryValue ?? mapStorageValue),
  };
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const arePreviewViewsClose = (
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

const toPreviewMapView = (viewState: MapViewState): ShapePreviewMapView | null => {
  const { longitude, latitude, zoom } = viewState;
  if (!isFiniteNumber(longitude) || !isFiniteNumber(latitude) || !isFiniteNumber(zoom)) {
    return null;
  }
  return { longitude, latitude, zoom };
};

export const isShapeLayerParentToggle = (toggleId: string): boolean =>
  toggleId === 'adm0' || toggleId === 'adm1' || toggleId === 'adm2';

type Args = {
  previewMapView: ShapePreviewMapView | undefined;
  onChange: (patch: { previewMapView: ShapePreviewMapView }) => void;
  shapePreviewLayerFeatureCounts: Record<string, number | undefined>;
  t: (key: string, fallback: string) => string;
};

export const useShapePreviewStepSceneView = ({
  previewMapView,
  onChange,
  shapePreviewLayerFeatureCounts,
  t,
}: Args) => {
  const [featureWindowOpen, setFeatureWindowOpen] = useState(true);
  const debugFlags = useMemo(() => getShapePreviewDebugFlags(), []);
  const lastPersistedViewRef = useRef<ShapePreviewMapView | null>(previewMapView ?? null);

  useEffect(() => {
    setFeatureWindowOpen(true);
  }, []);

  useEffect(() => {
    lastPersistedViewRef.current = previewMapView ?? null;
  }, [previewMapView, previewMapView?.latitude, previewMapView?.longitude, previewMapView?.zoom]);

  const layerSetsWindow = useFloatingWindow({
    persistKey: 'hierarchidb:ui:floating-window:shape:layer-sets',
    initialPosition: { x: 320, y: 96 },
    initialSize: { width: 260, height: 420 },
  });

  const handleViewStateCommit = useCallback(
    (viewState: MapViewState) => {
      const next = toPreviewMapView(viewState);
      if (!next) return;
      if (arePreviewViewsClose(lastPersistedViewRef.current, next)) return;
      lastPersistedViewRef.current = next;
      onChange({ previewMapView: next });
    },
    [onChange]
  );

  const resolveLayerToggleCountLabel = useCallback(
    (id: string): string => {
      const count = shapePreviewLayerFeatureCounts[id];
      return typeof count === 'number'
        ? count.toLocaleString()
        : t('preview.layerSets.counts.unavailable', '—');
    },
    [shapePreviewLayerFeatureCounts, t]
  );

  const showLayerSetsWindow =
    !debugFlags.hideLayerSetsFloatingWindow && layerSetsWindow.windowState.isVisible;
  const showLayerSetsReopenButton =
    !debugFlags.hideLayerSetsFloatingWindow && !layerSetsWindow.windowState.isVisible;
  const showMetadataReopenButton = !featureWindowOpen;
  const reserveMetadataReopenSlot = showLayerSetsReopenButton && !showMetadataReopenButton;

  return {
    featureWindowOpen,
    setFeatureWindowOpen,
    handleViewStateCommit,
    layerSetsWindow,
    showLayerSetsWindow,
    showLayerSetsReopenButton,
    showMetadataReopenButton,
    reserveMetadataReopenSlot,
    resolveLayerToggleCountLabel,
    hideMapPreview: debugFlags.hideMapPreview,
  };
};
