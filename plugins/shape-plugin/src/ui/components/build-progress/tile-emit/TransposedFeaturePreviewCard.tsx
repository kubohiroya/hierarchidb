import type { Feature, Geometry, Position } from 'geojson';
import { Box, Paper, Stack } from '@mui/material';
import { useTransposedFeaturePreviewCardView } from './useTransposedFeaturePreviewCardView.js';

export type TileBBox = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type TransposedFeaturePreviewCardProps = {
  tileBBox: TileBBox;
  bufferBBox: TileBBox;
  features: Feature<Geometry>[];
  selectedFeatureIds?: Set<string>;
  onMouseLeave?: () => void;
};

type Point = { x: number; y: number };

const MARGIN = 16;

type MercatorBBox = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

const lonLatToMercator = (lon: number, lat: number): Point | null => {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  const maxLat = 85.05112878;
  const clampedLat = Math.max(-maxLat, Math.min(maxLat, lat));
  const rad = Math.PI / 180;
  const x = lon * 20037508.34 / 180;
  const y = Math.log(Math.tan((90 + clampedLat) * rad / 2)) * 20037508.34 / Math.PI;
  return { x, y };
};

const projectPoint = (coord: Position, view: MercatorBBox, width: number, height: number): Point | null => {
  const [lon, lat] = coord;
  if (typeof lon !== 'number' || typeof lat !== 'number') return null;
  const projected = lonLatToMercator(lon, lat);
  if (!projected) return null;
  const spanX = view.maxX - view.minX;
  const spanY = view.maxY - view.minY;
  if (!Number.isFinite(spanX) || !Number.isFinite(spanY) || spanX === 0 || spanY === 0) return null;
  const innerWidth = Math.max(1, width - MARGIN * 2);
  const innerHeight = Math.max(1, height - MARGIN * 2);
  const x = MARGIN + ((projected.x - view.minX) / spanX) * innerWidth;
  const y = MARGIN + ((view.maxY - projected.y) / spanY) * innerHeight;
  return { x, y };
};

const toPath = (
  coords: Position[] | Position[][] | Position[][][],
  view: MercatorBBox,
  width: number,
  height: number,
): string => {
  const parts: string[] = [];
  const pushPath = (ring: Position[]) => {
    ring.forEach((coord, index) => {
      const pt = projectPoint(coord, view, width, height);
      if (!pt) return;
      parts.push(`${index === 0 ? 'M' : 'L'}${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`);
    });
    parts.push('Z');
  };
  if (!Array.isArray(coords)) return '';
  if (coords.length === 0) return '';
  if (typeof coords[0]?.[0] === 'number') {
    pushPath(coords as Position[]);
    return parts.join(' ');
  }
  if (typeof coords[0]?.[0]?.[0] === 'number') {
    (coords as Position[][]).forEach(pushPath);
    return parts.join(' ');
  }
  (coords as Position[][][]).forEach((poly) => poly.forEach(pushPath));
  return parts.join(' ');
};

const resolveFeatureId = (feature: Feature): string | null => {
  const props = feature.properties as Record<string, unknown> | undefined;
  const metadataFeatureId = props?.__hdbFeatureId;
  if (typeof metadataFeatureId === 'string' && metadataFeatureId.trim().length > 0) {
    return metadataFeatureId;
  }
  if (typeof feature.id === 'string' && feature.id.trim().length > 0) return feature.id;
  if (typeof feature.id === 'number' && Number.isFinite(feature.id)) return String(feature.id);
  return null;
};

export const TransposedFeaturePreviewCard = ({
  tileBBox,
  bufferBBox,
  features,
  selectedFeatureIds,
  onMouseLeave,
}: TransposedFeaturePreviewCardProps) => {
  const {
    containerRef,
    view,
    width,
    height,
    tileRect,
    scale,
    offset,
    handleWheel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave,
    handleMouseLeave,
  } = useTransposedFeaturePreviewCardView({
    tileBBox,
    bufferBBox,
    onMouseLeave,
  });

  return (
    <Paper variant="outlined" sx={{ p: 1.25 }}>
      <Stack spacing={1}>
        <Box
          ref={containerRef}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onMouseLeave={handleMouseLeave}
          sx={{
            width: '100%',
            aspectRatio: '1 / 1',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: 'grey.50',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
            touchAction: 'none',
          }}
        >
          <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
            <g transform={`translate(${offset.x} ${offset.y}) scale(${scale})`}>
              <rect
                x={MARGIN}
                y={MARGIN}
                width={width - MARGIN * 2}
                height={height - MARGIN * 2}
                fill="none"
                stroke="#999"
                strokeWidth="1"
                strokeDasharray="4 3"
              />
              {tileRect ? (
                <rect
                  x={tileRect.x}
                  y={tileRect.y}
                  width={tileRect.width}
                  height={tileRect.height}
                  fill="none"
                  stroke="#111"
                  strokeWidth="1.5"
                />
              ) : null}
              {view ? features.map((feature, index) => {
                const id = resolveFeatureId(feature);
                const isSelected = id ? selectedFeatureIds?.has(id) : false;
                const color = isSelected ? '#ef6c00' : '#1976d2';
                const opacity = isSelected ? 0.7 : 0.25;
                if (!feature.geometry) return null;
                if (feature.geometry.type === 'Point') {
                  const pt = projectPoint(feature.geometry.coordinates as Position, view, width, height);
                  if (!pt) return null;
                  return (
                    <circle
                      key={`${id ?? 'pt'}-${index}`}
                      cx={pt.x}
                      cy={pt.y}
                      r={2.5}
                      fill={color}
                      opacity={opacity}
                    />
                  );
                }
                if (feature.geometry.type === 'MultiPoint') {
                  const coords = feature.geometry.coordinates as Position[];
                  return coords.map((coord, subIndex) => {
                    const pt = projectPoint(coord, view, width, height);
                    if (!pt) return null;
                    return (
                      <circle
                        key={`${id ?? 'mp'}-${index}-${subIndex}`}
                        cx={pt.x}
                        cy={pt.y}
                        r={2.5}
                        fill={color}
                        opacity={opacity}
                      />
                    );
                  });
                }
                const path = toPath(feature.geometry.coordinates as Position[] | Position[][] | Position[][][], view, width, height);
                if (!path) return null;
                return (
                  <path
                    key={`${id ?? 'path'}-${index}`}
                    d={path}
                    fill={feature.geometry.type.includes('Polygon') ? color : 'none'}
                    stroke={color}
                    strokeWidth={feature.geometry.type.includes('Polygon') ? 0.5 : 1}
                    opacity={opacity}
                  />
                );
              }) : null}
            </g>
          </svg>
        </Box>
      </Stack>
    </Paper>
  );
};
