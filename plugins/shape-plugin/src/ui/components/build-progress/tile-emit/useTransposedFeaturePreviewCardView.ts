import { useCallback, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import type { TileBBox } from './TransposedFeaturePreviewCard';

type Point = { x: number; y: number };

const WIDTH = 1000;
const HEIGHT = 1000;

const lonLatToMercator = (lon: number, lat: number): Point | null => {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  const maxLat = 85.05112878;
  const clampedLat = Math.max(-maxLat, Math.min(maxLat, lat));
  const rad = Math.PI / 180;
  const x = lon * 20037508.34 / 180;
  const y = Math.log(Math.tan((90 + clampedLat) * rad / 2)) * 20037508.34 / Math.PI;
  return { x, y };
};

type MercatorBBox = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

const toMercatorBBox = (bbox: TileBBox): MercatorBBox | null => {
  const min = lonLatToMercator(bbox.minX, bbox.minY);
  const max = lonLatToMercator(bbox.maxX, bbox.maxY);
  if (!min || !max) return null;
  return {
    minX: Math.min(min.x, max.x),
    minY: Math.min(min.y, max.y),
    maxX: Math.max(min.x, max.x),
    maxY: Math.max(min.y, max.y),
  };
};

type Args = {
  bufferBBox: TileBBox;
  tileBBox: TileBBox;
  onMouseLeave?: () => void;
};

export const useTransposedFeaturePreviewCardView = ({ bufferBBox, tileBBox, onMouseLeave }: Args) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [lastPoint, setLastPoint] = useState<Point | null>(null);

  const view = useMemo(() => toMercatorBBox(bufferBBox), [bufferBBox]);
  const tileView = useMemo(() => toMercatorBBox(tileBBox), [tileBBox]);
  const tileTopLeft = view && tileView
    ? (() => {
      const [lon, lat] = [tileBBox.minX, tileBBox.maxY];
      const projected = lonLatToMercator(lon, lat);
      if (!projected || !view) return null;
      const spanX = view.maxX - view.minX;
      const spanY = view.maxY - view.minY;
      const x = 16 + ((projected.x - view.minX) / spanX) * Math.max(1, WIDTH - 32);
      const y = 16 + ((view.maxY - projected.y) / spanY) * Math.max(1, HEIGHT - 32);
      return { x, y };
    })()
    : null;
  const tileBottomRight = view && tileView
    ? (() => {
      const [lon, lat] = [tileBBox.maxX, tileBBox.minY];
      const projected = lonLatToMercator(lon, lat);
      if (!projected || !view) return null;
      const spanX = view.maxX - view.minX;
      const spanY = view.maxY - view.minY;
      const x = 16 + ((projected.x - view.minX) / spanX) * Math.max(1, WIDTH - 32);
      const y = 16 + ((view.maxY - projected.y) / spanY) * Math.max(1, HEIGHT - 32);
      return { x, y };
    })()
    : null;
  const tileRect = tileTopLeft && tileBottomRight
    ? {
      x: tileTopLeft.x,
      y: tileTopLeft.y,
      width: tileBottomRight.x - tileTopLeft.x,
      height: tileBottomRight.y - tileTopLeft.y,
    }
    : null;

  const resetView = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const handleWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (rect.width <= 0 || rect.height <= 0) return;
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const pointerSvgX = (pointerX / rect.width) * WIDTH;
    const pointerSvgY = (pointerY / rect.height) * HEIGHT;
    const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;
    setScale((prev) => {
      const next = Math.min(8, Math.max(0.5, prev * zoomFactor));
      if (next === prev) return prev;
      const ratio = prev / next;
      setOffset((prevOffset) => ({
        x: (prevOffset.x + pointerSvgX) * ratio - pointerSvgX,
        y: (prevOffset.y + pointerSvgY) * ratio - pointerSvgY,
      }));
      return next;
    });
  }, []);

  const handlePointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    setLastPoint({ x: event.clientX, y: event.clientY });
  }, []);

  const handlePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!dragging || !lastPoint) return;
    const dx = event.clientX - lastPoint.x;
    const dy = event.clientY - lastPoint.y;
    setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    setLastPoint({ x: event.clientX, y: event.clientY });
  }, [dragging, lastPoint]);

  const handlePointerUp = useCallback((event?: PointerEvent<HTMLDivElement>) => {
    if (event) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
    setLastPoint(null);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setDragging(false);
    setLastPoint(null);
    resetView();
    onMouseLeave?.();
  }, [onMouseLeave, resetView]);

  const handlePointerLeave = useCallback((event: PointerEvent<HTMLDivElement>) => {
    handlePointerUp(event);
    resetView();
    onMouseLeave?.();
  }, [handlePointerUp, onMouseLeave, resetView]);

  return {
    containerRef,
    handleMouseLeave,
    handlePointerDown,
    handlePointerLeave,
    handlePointerMove,
    handlePointerUp,
    handleWheel,
    height: HEIGHT,
    offset,
    scale,
    tileRect,
    view,
    width: WIDTH,
  };
};
