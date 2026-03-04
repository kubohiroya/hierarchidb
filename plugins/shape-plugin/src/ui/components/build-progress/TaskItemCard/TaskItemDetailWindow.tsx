import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  IconButton,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import LayersIcon from '@mui/icons-material/Layers';
import { useAtomValue } from 'jotai';
import type { Feature, FeatureCollection } from 'geojson';
import { feature as topojsonFeature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import { geojson as geojsonApi } from 'flatgeobuf';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { NodeId } from '@hierarchidb/core-types';
import type { ShapeSourceCache } from '@hierarchidb/shape-api';
import { shapeQueryAPIImpl } from '~/services/build/ShapeBuildAPIClient';
import {
  buildRawDataDataSourceCacheKey,
  readRawDataDataSourceBuffer,
} from '~/services/utils/chunkStore';
import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressAtoms';
import { buildStagesAtom } from '~/ui/atoms/shapeBuildProgressAtoms';
import type { TaskOutcomeSummary } from '~/ui/components/build-progress/TaskItem/TaskItem';
import type { TaskDetailPayload, TaskDetailSelection } from './TaskItemDetailTypes';
import type { ShapeBuildConfig } from '~/common/types/BuildTaskResult';
import { TileEmitTaskItemDetailWindow } from '~/ui/components/build-progress/tile-emit/TileEmitTaskItemDetailWindow';
import { FloatingWindow, useFloatingWindow } from '@hierarchidb/ui-floating-window';
import {
  isGeometryLikeStageId,
  isTileEmitLikeStageId,
  normalizeUiStageId,
} from '~/ui/components/build-progress/stageIdAliases';

export type { TaskDetailSelection };

type PreviewData = {
  original: FeatureCollection | null;
  result: FeatureCollection | null;
  previousOriginal: FeatureCollection | null;
  originalBytes: number;
  resultBytes: number;
};

type CollectionLoadResult = {
  collection: FeatureCollection | null;
  rawBytes: number;
};

type SourceStageMaxima = {
  featureMax: number;
  polygonMax: number;
};

type CollectionMetrics = {
  featureCount: number;
  polygonCount: number;
  vertexCount: number;
  maxPolygonVertexCount: number;
};

type OverlaySpec = {
  collection: FeatureCollection;
  color: string;
  weight: number;
  opacity: number;
  fillOpacity: number;
};

const resolveNodeIdFromTask = (task: ShapeBuildTaskSummary): NodeId | null => {
  if (task.nodeId) return task.nodeId;
  if (typeof task.taskId !== 'string' || !task.taskId.includes(':')) return null;
  const prefix = task.taskId.split(':')[0];
  return prefix ? prefix as NodeId : null;
};

const VERTEX_LIMIT = 6553;
const numberFormatter = new Intl.NumberFormat('en-US');

const toFlagEmoji = (countryCode: string | null): string | null => {
  if (!countryCode) return null;
  const normalized = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return null;
  const base = 0x1f1e6;
  const first = normalized.charCodeAt(0) - 65 + base;
  const second = normalized.charCodeAt(1) - 65 + base;
  return String.fromCodePoint(first, second);
};

const extractCountryCodeFromTitle = (title: string): string | null => {
  const match = title.match(/\(([A-Za-z]{2})\)/);
  if (!match) return null;
  return match[1] ?? null;
};

const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'N/A';
  return numberFormatter.format(Math.round(value));
};

const formatPercent = (ratio: number | null): string => {
  if (ratio === null || !Number.isFinite(ratio)) return 'N/A';
  return `${Math.round(ratio * 1000) / 10}%`;
};

const resolveRatio = (output: number | null | undefined, input: number | null | undefined): number | null => {
  if (output === null || output === undefined || input === null || input === undefined || input <= 0) return null;
  return Math.max(0, Math.min(1, output / input));
};

const asRecord = (value: unknown): Record<string, unknown> | null => (
  typeof value === 'object' && value !== null ? value as Record<string, unknown> : null
);

const readString = (value: unknown): string | null => (
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
);

const readNumber = (value: unknown): number | null => (
  typeof value === 'number' && Number.isFinite(value) ? value : null
);

const formatKb = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 kB';
  return `${numberFormatter.format(Math.max(0, Math.round(bytes / 1024)))} kB`;
};

const readSourceStageMaxima = (value: unknown): SourceStageMaxima | null => {
  const candidate = asRecord(value);
  const featureMax = readNumber(candidate?.featureMax);
  const polygonMax = readNumber(candidate?.polygonMax);
  if (featureMax === null || polygonMax === null) return null;
  if (featureMax <= 0 || polygonMax <= 0) return null;
  return {
    featureMax: Math.max(0, Math.round(featureMax)),
    polygonMax: Math.max(0, Math.round(polygonMax)),
  };
};

const normalizeFeatureCollection = async (decoded: unknown): Promise<FeatureCollection | null> => {
  if (!decoded || typeof decoded !== 'object') return null;
  const collection = decoded as FeatureCollection;
  if (collection.type === 'FeatureCollection') {
    return {
      ...collection,
      features: Array.isArray(collection.features) ? collection.features : [],
    };
  }
  const asyncIterable = decoded as AsyncIterable<Feature>;
  if (typeof asyncIterable[Symbol.asyncIterator] === 'function') {
    const features: Feature[] = [];
    for await (const feature of asyncIterable) {
      features.push(feature);
    }
    return { type: 'FeatureCollection', features };
  }
  return null;
};

const decompressGzip = async (buffer: ArrayBuffer): Promise<ArrayBuffer> => {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('DecompressionStream is not available.');
  }
  const stream = new DecompressionStream('gzip');
  const writer = stream.writable.getWriter();
  await writer.write(new Uint8Array(buffer));
  await writer.close();
  return await new Response(stream.readable).arrayBuffer();
};

const decodeTopoJsonCollection = async (buffer: ArrayBuffer): Promise<FeatureCollection | null> => {
  const text = new TextDecoder('utf-8').decode(buffer);
  const parsed = JSON.parse(text) as Topology;
  const objects = parsed.objects ? Object.values(parsed.objects) : [];
  const firstObject = objects[0];
  if (!firstObject) return { type: 'FeatureCollection', features: [] };
  const geojson = topojsonFeature(parsed, firstObject as Parameters<typeof topojsonFeature>[1]);
  if ('features' in geojson) {
    return {
      ...geojson,
      features: Array.isArray(geojson.features) ? geojson.features : [],
    };
  }
  return { type: 'FeatureCollection', features: [geojson] };
};

const decodeSourceCacheCollection = async (
  cache: ShapeSourceCache,
  format: 'flatgeobuf' | 'topojson',
  compression: 'none' | 'gzip',
): Promise<FeatureCollection | null> => {
  if (format === 'topojson') {
    const source = compression === 'gzip' ? await decompressGzip(cache.data) : cache.data;
    return decodeTopoJsonCollection(source);
  }
  const decoded = geojsonApi.deserialize(new Uint8Array(cache.data));
  return normalizeFeatureCollection(decoded);
};

const decodeGeometryCacheCollection = async (buffer: ArrayBuffer): Promise<FeatureCollection | null> => {
  const decoded = geojsonApi.deserialize(new Uint8Array(buffer));
  return normalizeFeatureCollection(decoded);
};

const measureCollectionBytes = (collection: FeatureCollection | null): number => {
  if (!collection) return 0;
  return new TextEncoder().encode(JSON.stringify(collection)).byteLength;
};

const decodeJsonSourceCollection = async (buffer: ArrayBuffer): Promise<FeatureCollection | null> => {
  const text = new TextDecoder('utf-8').decode(buffer);
  const parsed = JSON.parse(text) as unknown;
  const record = asRecord(parsed);
  if (!record) return null;
  if (record.type === 'Topology') {
    return decodeTopoJsonCollection(buffer);
  }
  if (record.type === 'FeatureCollection') {
    const collection = parsed as FeatureCollection;
    return {
      ...collection,
      features: Array.isArray(collection.features) ? collection.features : [],
    };
  }
  if (record.type === 'Feature') {
    return {
      type: 'FeatureCollection',
      features: [parsed as Feature],
    };
  }
  return null;
};

const loadSourceCollectionFromCache = async (
  nodeId: NodeId,
  preview: Record<string, unknown> | null,
): Promise<CollectionLoadResult | null> => {
  const rawSourceCacheKeys = Array.from(new Set([
    readString(preview?.rawSourceCacheKey),
    readString(preview?.sourceUrl),
    (() => {
      const sourceUrl = readString(preview?.sourceUrl);
      if (!sourceUrl) return null;
      return buildRawDataDataSourceCacheKey({
        dataSource: readString(preview?.dataSource) ?? undefined,
        countryCode: readString(preview?.sourceCountryCode) ?? undefined,
        adminLevel: readNumber(preview?.adminLevel) ?? undefined,
        url: sourceUrl,
      });
    })(),
  ].filter((value): value is string => Boolean(value))));
  if (rawSourceCacheKeys.length === 0) {
    return null;
  }
  let rawBuffer: ArrayBuffer | null = null;
  for (const cacheKey of rawSourceCacheKeys) {
    rawBuffer = await readRawDataDataSourceBuffer(nodeId, cacheKey);
    if (rawBuffer) break;
  }
  if (!rawBuffer) {
    return null;
  }
  const collection = await decodeJsonSourceCollection(rawBuffer);
  if (!collection) {
    throw new Error('[shape-plugin] raw source buffer decoding failed: expected JSON/Topology payload');
  }
  return {
    collection,
    rawBytes: rawBuffer.byteLength,
  };
};

const resolveCacheId = (
  preview: Record<string, unknown> | null,
  task: ShapeBuildTaskSummary,
  key: 'sourceCacheId' | 'geometryCacheId',
): string | null => {
  const taskRecord = task as unknown as Record<string, unknown>;
  const previewId = readString(preview?.[key]);
  if (previewId) return previewId;
  const outputId = readString(asRecord(taskRecord.outputData)?.[key]);
  if (outputId) return outputId;
  const inputId = readString(asRecord(taskRecord.inputData)?.[key]);
  if (inputId) return inputId;
  return null;
};

const loadPreviewData = async (detail: TaskDetailPayload): Promise<PreviewData> => {
  const preview = asRecord(detail.task.metadata?.preview);
  const nodeId = resolveNodeIdFromTask(detail.task);
  const taskStage = normalizeUiStageId(detail.task.stage);
  if (!nodeId) {
    return {
      original: null,
      result: null,
      previousOriginal: null,
      originalBytes: 0,
      resultBytes: 0,
    };
  }
  if (taskStage === 'source') {
    const sourceCacheId = resolveCacheId(preview, detail.task, 'sourceCacheId');
    const sourceCacheFormat = readString(preview?.sourceCacheFormat) === 'topojson' ? 'topojson' : 'flatgeobuf';
    const sourceCacheCompression = readString(preview?.sourceCacheCompression) === 'gzip' ? 'gzip' : 'none';
    const [sourceCollectionResult, sourceCache] = await Promise.all([
      loadSourceCollectionFromCache(nodeId, preview),
      sourceCacheId ? shapeQueryAPIImpl.getSourceCache(nodeId, sourceCacheId) : Promise.resolve(null),
    ]);
    const resultCollection = sourceCache
      ? await decodeSourceCacheCollection(sourceCache, sourceCacheFormat, sourceCacheCompression)
      : null;
    const sourceCollection = sourceCollectionResult?.collection ?? resultCollection;
    const sourceRawBytes = sourceCollectionResult?.rawBytes
      ?? ((sourceCache?.size && sourceCache.size > 0)
        ? sourceCache.size
        : measureCollectionBytes(sourceCollection));
    if (sourceCache && !resultCollection) {
      throw new Error('[shape-plugin] source cache decoding failed for Source stage preview');
    }
    return {
      original: sourceCollection,
      result: resultCollection,
      previousOriginal: null,
      originalBytes: sourceRawBytes,
      resultBytes: (sourceCache?.size && sourceCache.size > 0)
        ? sourceCache.size
        : measureCollectionBytes(resultCollection),
    };
  }

  if (isGeometryLikeStageId(taskStage)) {
    const sourceCacheId = resolveCacheId(preview, detail.task, 'sourceCacheId');
    const sourceCacheFormat = readString(preview?.sourceCacheFormat) === 'topojson' ? 'topojson' : 'flatgeobuf';
    const sourceCacheCompression = readString(preview?.sourceCacheCompression) === 'gzip' ? 'gzip' : 'none';
    const geometryCacheId = resolveCacheId(preview, detail.task, 'geometryCacheId');

    const [sourceCollectionResult, sourceCache, geometryCache] = await Promise.all([
      loadSourceCollectionFromCache(nodeId, preview),
      sourceCacheId ? shapeQueryAPIImpl.getSourceCache(nodeId, sourceCacheId) : Promise.resolve(null),
      geometryCacheId ? shapeQueryAPIImpl.getGeometryCache(geometryCacheId) : Promise.resolve(null),
    ]);
    const sourceCollection = sourceCollectionResult?.collection ?? null;

    const originalCollection = sourceCache
      ? await decodeSourceCacheCollection(sourceCache, sourceCacheFormat, sourceCacheCompression)
      : null;
    const resultCollection = geometryCache
      ? await decodeGeometryCacheCollection(geometryCache.data)
      : null;
    if (sourceCache && !originalCollection) {
      throw new Error('[shape-plugin] source cache decoding failed for Geometry stage preview');
    }
    if (geometryCache && !resultCollection) {
      throw new Error('[shape-plugin] geometry cache decoding failed for Geometry stage preview');
    }

    return {
      original: originalCollection,
      result: resultCollection,
      previousOriginal: sourceCollection ?? originalCollection,
      originalBytes: (sourceCache?.size && sourceCache.size > 0)
        ? sourceCache.size
        : (sourceCollectionResult?.rawBytes ?? measureCollectionBytes(originalCollection)),
      resultBytes: (geometryCache?.data.byteLength && geometryCache.data.byteLength > 0)
        ? geometryCache.data.byteLength
        : measureCollectionBytes(resultCollection),
    };
  }

  return {
    original: null,
    result: null,
    previousOriginal: null,
    originalBytes: 0,
    resultBytes: 0,
  };
};

const renderVolumeRow = (
  label: string,
  output: number | null | undefined,
  input: number | null | undefined,
  colorToken: string,
  withVertexLimitLine: boolean,
): React.ReactNode => {
  const ratio = resolveRatio(output, input);
  const vertexLimitRatio = (
    withVertexLimitLine && input !== null && input !== undefined && input > 0
  )
    ? Math.max(0, Math.min(1, VERTEX_LIMIT / input))
    : null;

  const text = `${formatNumber(output)} / ${formatNumber(input)} (${formatPercent(ratio)})`;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography variant="caption" sx={{ width: 56, color: 'text.secondary' }}>
        {label}
      </Typography>
      <Box sx={{ position: 'relative', flex: 1, height: 20, bgcolor: 'grey.300', borderRadius: 0.75, overflow: 'hidden' }}>
        {ratio !== null ? (
          <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${ratio * 100}%`, bgcolor: colorToken }} />
        ) : null}
        {vertexLimitRatio !== null ? (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${vertexLimitRatio * 100}%`,
              width: '2px',
              background: (theme) => `linear-gradient(to right, ${theme.palette.warning.main} 0 1px, ${theme.palette.common.black} 1px 2px)`,
            }}
          />
        ) : null}
        <Typography
          variant="caption"
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'common.white',
            mixBlendMode: 'difference',
            px: 0.5,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {text}
        </Typography>
      </Box>
    </Box>
  );
};

const renderVertexLimitReferencedRow = (
  label: string,
  output: number | null | undefined,
  input: number | null | undefined,
  colorToken: string,
  limit = VERTEX_LIMIT,
): React.ReactNode => {
  const safeInput = typeof input === 'number' && Number.isFinite(input) && input >= 0 ? input : null;
  const safeOutput = typeof output === 'number' && Number.isFinite(output) && output >= 0 ? output : null;
  const ratio = resolveRatio(safeOutput, safeInput);
  const inputScale = safeInput !== null ? 1 : null;
  const outputScale = ratio;
  const showLimitMarker = safeInput !== null && safeInput > limit;
  const limitScale = showLimitMarker ? Math.max(0, Math.min(1, limit / safeInput)) : null;
  const text = `${formatNumber(output)} / ${formatNumber(input)} (${formatPercent(ratio)})`;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography variant="caption" sx={{ width: 56, color: 'text.secondary' }}>
        {label}
      </Typography>
      <Box sx={{ position: 'relative', flex: 1, height: 20, bgcolor: 'grey.300', borderRadius: 0.75, overflow: 'hidden' }}>
        {inputScale !== null ? (
          <Box
            sx={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${inputScale * 100}%`,
              bgcolor: 'grey.500',
              opacity: 0.7,
            }}
          />
        ) : null}
        {outputScale !== null ? (
          <Box
            sx={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${outputScale * 100}%`,
              bgcolor: colorToken,
            }}
          />
        ) : null}
        {limitScale !== null ? (
          <Box
            data-testid="max-vertices-limit-marker"
            sx={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `calc(${limitScale * 100}% - 2px)`,
              width: '4px',
              background: (theme) => `linear-gradient(to right, ${theme.palette.warning.main} 0 2px, ${theme.palette.common.black} 2px 4px)`,
            }}
          />
        ) : null}
        <Typography
          variant="caption"
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'common.white',
            mixBlendMode: 'difference',
            px: 0.5,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {text}
        </Typography>
      </Box>
    </Box>
  );
};

const renderCountTextRow = (
  label: string,
  value: number | null | undefined,
): React.ReactNode => (
  <Typography variant="caption" color="text.secondary">
    {`${label}: ${formatNumber(value)}`}
  </Typography>
);

const renderStackedRatioRow = (
  label: string,
  output: number | null | undefined,
  input: number | null | undefined,
  colorToken: string,
  maxScale?: number | null,
  hideBarWhenNoScale = false,
): React.ReactNode => {
  void maxScale;
  void hideBarWhenNoScale;
  const ratio = resolveRatio(output, input);
  const text = `${formatNumber(output)} / ${formatNumber(input)} (${formatPercent(ratio)})`;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography variant="caption" sx={{ width: 56, color: 'text.secondary' }}>
        {label}
      </Typography>
      <Box sx={{ position: 'relative', flex: 1, height: 20, bgcolor: 'grey.300', borderRadius: 0.75, overflow: 'hidden' }}>
        {ratio !== null ? (
          <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${ratio * 100}%`, bgcolor: colorToken }} />
        ) : null}
        <Typography
          variant="caption"
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'common.white',
            mixBlendMode: 'difference',
            px: 0.5,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {text}
        </Typography>
      </Box>
    </Box>
  );
};

const lonToTileX = (lon: number, zoom: number): number => {
  const scale = 2 ** zoom;
  return Math.floor(((lon + 180) / 360) * scale);
};

const latToTileY = (lat: number, zoom: number): number => {
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const rad = (clamped * Math.PI) / 180;
  const scale = 2 ** zoom;
  const mercator = Math.log(Math.tan(rad) + (1 / Math.cos(rad)));
  return Math.floor((1 - (mercator / Math.PI)) * 0.5 * scale);
};

const tileXToLon = (x: number, zoom: number): number => ((x / (2 ** zoom)) * 360) - 180;

const tileYToLat = (y: number, zoom: number): number => {
  const n = Math.PI - ((2 * Math.PI * y) / (2 ** zoom));
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
};

const resolveSubTileGuideConfig = (adminLevel: number | null): {
  divisions: number;
  color: string;
  opacity: number;
} | null => {
  if (adminLevel === 1) {
    return { divisions: 2, color: '#8f8f8f', opacity: 0.75 };
  }
  if (adminLevel === 2) {
    return { divisions: 4, color: '#b5b5b5', opacity: 0.7 };
  }
  if (adminLevel === 3) {
    return { divisions: 8, color: '#d3d3d3', opacity: 0.65 };
  }
  return null;
};

const GeometryPreviewMap = ({
  overlays,
  originalBytes,
  resultBytes,
  resultColor,
  adminLevel,
}: {
  overlays: OverlaySpec[];
  originalBytes: number;
  resultBytes: number;
  resultColor: string;
  adminLevel: number | null;
}): React.ReactElement => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const geometryLayersRef = useRef<L.LayerGroup | null>(null);
  const tileLayersRef = useRef<L.LayerGroup | null>(null);
  const resetBoundsRef = useRef<L.LatLngBounds | null>(null);
  const refreshTileGrid = useCallback(() => {
    const map = mapRef.current;
    const tileLayers = tileLayersRef.current;
    if (!map || !tileLayers) return;
    tileLayers.clearLayers();
    const subTileGuide = resolveSubTileGuideConfig(adminLevel);
    const zoom = Math.max(0, Math.min(22, Math.floor(map.getZoom())));
    const bounds = map.getBounds();
    const west = bounds.getWest();
    const east = bounds.getEast();
    const north = bounds.getNorth();
    const south = bounds.getSouth();
    const scale = 2 ** zoom;
    const minX = Math.max(0, Math.min(scale - 1, lonToTileX(west, zoom)));
    const maxX = Math.max(0, Math.min(scale - 1, lonToTileX(east, zoom)));
    const minY = Math.max(0, Math.min(scale - 1, latToTileY(north, zoom)));
    const maxY = Math.max(0, Math.min(scale - 1, latToTileY(south, zoom)));

    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        const westLon = tileXToLon(x, zoom);
        const eastLon = tileXToLon(x + 1, zoom);
        const northLat = tileYToLat(y, zoom);
        const southLat = tileYToLat(y + 1, zoom);
        L.rectangle([[southLat, westLon], [northLat, eastLon]], {
          color: '#1976d2',
          weight: 1,
          opacity: 0.45,
          fillOpacity: 0,
          interactive: false,
        }).addTo(tileLayers);
        if (subTileGuide) {
          const { divisions, color, opacity } = subTileGuide;
          const lonStep = (eastLon - westLon) / divisions;
          const latStep = (northLat - southLat) / divisions;
          for (let i = 1; i < divisions; i += 1) {
            const lon = westLon + (lonStep * i);
            L.polyline([[southLat, lon], [northLat, lon]], {
              color,
              opacity,
              weight: 1,
              dashArray: '2,4',
              interactive: false,
            }).addTo(tileLayers);
            const lat = southLat + (latStep * i);
            L.polyline([[lat, westLon], [lat, eastLon]], {
              color,
              opacity,
              weight: 1,
              dashArray: '2,4',
              interactive: false,
            }).addTo(tileLayers);
          }
        }
        L.marker([northLat, westLon], {
          interactive: false,
          icon: L.divIcon({
            className: 'shape-preview-tile-label',
            html: `<span>${x}/${y}/${zoom}</span>`,
            iconSize: [44, 14],
            iconAnchor: [0, 0],
          }),
        }).addTo(tileLayers);
      }
    }
  }, [adminLevel]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      preferCanvas: false,
      doubleClickZoom: true,
      boxZoom: false,
    });
    L.control.zoom({ position: 'topright' }).addTo(map);
    map.setView([0, 0], 1);
    const geometryLayers = L.layerGroup().addTo(map);
    const tileLayers = L.layerGroup().addTo(map);
    mapRef.current = map;
    geometryLayersRef.current = geometryLayers;
    tileLayersRef.current = tileLayers;
    map.on('zoomend moveend', refreshTileGrid);

    return () => {
      map.off('zoomend moveend', refreshTileGrid);
      map.remove();
      mapRef.current = null;
      geometryLayersRef.current = null;
      tileLayersRef.current = null;
      resetBoundsRef.current = null;
    };
  }, [refreshTileGrid]);

  useEffect(() => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!map || !container || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      map.invalidateSize(false);
      refreshTileGrid();
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, [refreshTileGrid]);

  useEffect(() => {
    const map = mapRef.current;
    const geometryLayers = geometryLayersRef.current;
    if (!map || !geometryLayers) return;
    map.invalidateSize(false);
    geometryLayers.clearLayers();

    let combinedBounds: L.LatLngBounds | null = null;
    overlays.forEach((overlay) => {
      const layer = L.geoJSON(overlay.collection, {
        style: {
          color: overlay.color,
          weight: overlay.weight,
          opacity: overlay.opacity,
          fillOpacity: overlay.fillOpacity,
        },
      });
      layer.addTo(geometryLayers);
      const bounds = layer.getBounds();
      if (bounds.isValid()) {
        combinedBounds = combinedBounds ? combinedBounds.extend(bounds) : bounds;
      }
    });

    if (combinedBounds) {
      resetBoundsRef.current = combinedBounds;
      map.fitBounds(combinedBounds, { padding: [8, 8], animate: false });
      refreshTileGrid();
    }
  }, [overlays, refreshTileGrid]);

  const handleMouseLeave = () => {
    const map = mapRef.current;
    const bounds = resetBoundsRef.current;
    if (!map || !bounds || !bounds.isValid()) return;
    map.fitBounds(bounds, { padding: [8, 8], animate: false });
  };

  const ratio = originalBytes > 0 ? resultBytes / originalBytes : null;
  const ratioLabel = ratio !== null ? `${Math.round(ratio * 1000) / 10}%` : 'N/A';
  const ratioBarWidth = ratio !== null ? `${Math.max(0, Math.min(1, ratio)) * 100}%` : '0%';
  const sizeRatioText = `${formatKb(resultBytes)} / ${formatKb(originalBytes)} (${ratioLabel})`;

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        overflow: 'hidden',
        bgcolor: 'grey.100',
      }}
      onMouseLeave={handleMouseLeave}
    >
      <Box
        ref={containerRef}
        sx={{
          width: '100%',
          height: '100%',
          '& .leaflet-container': {
            width: '100%',
            height: '100%',
            background: 'transparent',
          },
          '& .shape-preview-tile-label': {
            color: 'rgba(0,0,0,0.7)',
            fontSize: '10px',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            textShadow: '0 0 2px rgba(255,255,255,0.85)',
          },
          '& .leaflet-control-zoom': {
            transform: 'scale(0.85)',
            transformOrigin: 'top right',
            marginTop: '4px',
            marginRight: '4px',
          },
          '& .leaflet-control-zoom a': {
            width: 20,
            height: 20,
            lineHeight: '20px',
            fontSize: '14px',
          },
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          right: 8,
          bottom: 6,
          backgroundColor: 'rgba(255, 255, 255, 0.85)',
          px: 0.75,
          py: 0.5,
          borderRadius: 0.5,
          pointerEvents: 'none',
          width: 180,
        }}
      >
        {ratio !== null ? (
          <Box sx={{ position: 'relative', width: '100%', height: 16, bgcolor: 'grey.300', borderRadius: 0.5, overflow: 'hidden' }}>
            <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: ratioBarWidth, bgcolor: resultColor }} />
            <Typography
              variant="caption"
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'common.white',
                mixBlendMode: 'difference',
                px: 0.5,
                fontSize: '10px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {sizeRatioText}
            </Typography>
          </Box>
        ) : (
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '10px' }}>
            {sizeRatioText}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

const toDownloadLayerCollection = (
  collection: FeatureCollection | null,
  layer: 'source' | 'original' | 'result',
): Feature[] => {
  if (!collection) return [];
  return collection.features.map((feature) => ({
    ...feature,
    properties: {
      ...(asRecord(feature.properties) ?? {}),
      __previewLayer: layer,
    },
  }));
};

const buildPreviewDownloadCollection = (preview: PreviewData | null): FeatureCollection | null => {
  if (!preview) return null;
  const features = [
    ...toDownloadLayerCollection(preview.previousOriginal, 'source'),
    ...toDownloadLayerCollection(preview.original, 'original'),
    ...toDownloadLayerCollection(preview.result, 'result'),
  ];
  if (features.length === 0) return null;
  return {
    type: 'FeatureCollection',
    features,
  };
};

const countPolygonVertices = (coordinates: unknown): number => {
  if (!Array.isArray(coordinates)) return 0;
  return coordinates.reduce((polygonSum, polygon) => {
    if (!Array.isArray(polygon)) return polygonSum;
    const ringVertices = polygon.reduce((ringSum, ring) => {
      if (!Array.isArray(ring)) return ringSum;
      return ringSum + ring.length;
    }, 0);
    return polygonSum + ringVertices;
  }, 0);
};

const toCollectionMetrics = (collection: FeatureCollection | null): CollectionMetrics => {
  if (!collection?.features?.length) {
    return { featureCount: 0, polygonCount: 0, vertexCount: 0, maxPolygonVertexCount: 0 };
  }
  let polygonCount = 0;
  let vertexCount = 0;
  let maxPolygonVertexCount = 0;

  const processGeometry = (geometry: Feature['geometry'] | null | undefined): void => {
    if (!geometry) return;
    if (geometry.type === 'Polygon') {
      const currentVertexCount = countPolygonVertices([geometry.coordinates]);
      polygonCount += 1;
      vertexCount += currentVertexCount;
      if (currentVertexCount > maxPolygonVertexCount) {
        maxPolygonVertexCount = currentVertexCount;
      }
      return;
    }
    if (geometry.type === 'MultiPolygon') {
      (geometry.coordinates as unknown[]).forEach((polygonCoords) => {
        const currentVertexCount = countPolygonVertices([polygonCoords]);
        polygonCount += 1;
        vertexCount += currentVertexCount;
        if (currentVertexCount > maxPolygonVertexCount) {
          maxPolygonVertexCount = currentVertexCount;
        }
      });
      return;
    }
    if (geometry.type === 'GeometryCollection') {
      (geometry.geometries ?? []).forEach((child) => processGeometry(child));
    }
  };

  collection.features.forEach((feature) => {
    processGeometry(feature.geometry);
  });
  return {
    featureCount: collection.features.length,
    polygonCount,
    vertexCount,
    maxPolygonVertexCount,
  };
};

type TaskDetailContentProps = {
  title: string;
  summary: TaskOutcomeSummary;
  previewAdminLevel: number | null;
  detailColor: string;
  chartColor: string;
  countryFlag: string | null;
  preview: PreviewData | null;
  previewLoading: boolean;
  previewErrorMessage: string | null;
  overlays: OverlaySpec[];
  sizeAccentColor: string;
  sourceStageMaxima: SourceStageMaxima | null;
  previewBoxHeight: number;
  withDownloadButton: boolean;
  onDownload?: () => void;
};

const TaskDetailContent = ({
  title,
  summary,
  previewAdminLevel,
  detailColor,
  chartColor,
  countryFlag,
  preview,
  previewLoading,
  previewErrorMessage,
  overlays,
  sizeAccentColor,
  sourceStageMaxima,
  previewBoxHeight,
  withDownloadButton,
  onDownload,
}: TaskDetailContentProps): React.ReactElement => {
  const sourceFilteredMetrics = toCollectionMetrics(preview?.original ?? null);
  const geometryMetrics = toCollectionMetrics(preview?.result ?? null);
  const hasPreviewGeometryMetrics = sourceFilteredMetrics.featureCount > 0 && geometryMetrics.featureCount > 0;
  const transformFeatureOutput = summary.sourceMetrics?.features.output
    ?? summary.fetchDetails?.features.output
    ?? summary.metrics?.features.output
    ?? null;
  const transformPolygonOutput = summary.sourceMetrics?.polygons.output
    ?? summary.fetchDetails?.polygons.output
    ?? summary.metrics?.polygons.output
    ?? null;
  const transformVertexInput = hasPreviewGeometryMetrics
    ? sourceFilteredMetrics.vertexCount
    : (summary.metrics?.vertices.input ?? null);
  const transformVertexOutput = hasPreviewGeometryMetrics
    ? geometryMetrics.vertexCount
    : (summary.metrics?.vertices.output ?? null);
  const maxPolygonVertexInput = hasPreviewGeometryMetrics
    ? sourceFilteredMetrics.maxPolygonVertexCount
    : (summary.maxPolygonVertices?.input ?? null);
  const maxPolygonVertexOutput = hasPreviewGeometryMetrics
    ? geometryMetrics.maxPolygonVertexCount
    : (summary.maxPolygonVertices?.output ?? null);
  const sizeMetricInput = summary.visualization === 'fetchMetrics'
    ? (summary.fetchDetails?.polygons.input ?? summary.fetchDetails?.features.input ?? null)
    : (summary.sourceMetrics?.polygons.input ?? summary.sourceMetrics?.features.input ?? null);
  const sizeMetricOutput = summary.visualization === 'fetchMetrics'
    ? (summary.fetchDetails?.polygons.output ?? summary.fetchDetails?.features.output ?? null)
    : (summary.sourceMetrics?.polygons.output ?? summary.sourceMetrics?.features.output ?? null);
  let previewOriginalBytes = preview?.originalBytes ?? 0;
  const previewResultBytes = preview?.resultBytes ?? 0;
  const canEstimateOriginalSize = (
    previewResultBytes > 0
    && previewOriginalBytes <= previewResultBytes
    && typeof sizeMetricInput === 'number'
    && Number.isFinite(sizeMetricInput)
    && typeof sizeMetricOutput === 'number'
    && Number.isFinite(sizeMetricOutput)
    && sizeMetricInput > sizeMetricOutput
    && sizeMetricOutput > 0
  );
  if (canEstimateOriginalSize) {
    previewOriginalBytes = Math.max(previewOriginalBytes, Math.round(previewResultBytes * (sizeMetricInput / sizeMetricOutput)));
  }

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: '100%',
        height: '100%',
        p: 1.25,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        boxShadow: 8,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Typography variant="caption" color={detailColor} sx={{ fontWeight: 600 }}>
          <Box
            component="span"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.75,
              fontSize: 16,
              fontWeight: 700,
              color: summary.kind === 'failed' ? 'error.light' : 'info.light',
              lineHeight: 1.25,
            }}
          >
            {countryFlag ? <span>{countryFlag}</span> : null}
            <span>{title}</span>
          </Box>
        </Typography>
        {withDownloadButton ? (
          <IconButton
            size="small"
            aria-label="Download preview geojson"
            onClick={onDownload}
          >
            <DownloadIcon fontSize="small" />
          </IconButton>
        ) : null}
      </Box>

      <Box sx={{ mt: 0.75 }}>
        {summary.visualization === 'transformMetrics' ? (
          <Stack spacing={0.5}>
            <Typography variant="caption" color="text.secondary">
              Effective tolerance: {summary.effectiveTolerance ?? 'N/A'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Retry attempts: {summary.retryAttempt ?? 'N/A'} / {summary.retryMax ?? 'N/A'}
            </Typography>
            {renderCountTextRow('Features', transformFeatureOutput)}
            {renderCountTextRow('Polygons', transformPolygonOutput)}
            {renderVolumeRow(
              'Vertices',
              transformVertexOutput,
              transformVertexInput,
              chartColor,
              false,
            )}
            {renderVertexLimitReferencedRow(
              'Max Vertices',
              maxPolygonVertexOutput,
              maxPolygonVertexInput,
              chartColor,
            )}
          </Stack>
        ) : null}
        {summary.visualization === 'fetchMetrics' ? (
          <Stack spacing={0.5}>
            <Typography variant="caption" color={detailColor} sx={{ fontWeight: 600 }}>
              URL: {summary.fetchDetails?.url ?? 'N/A'}
            </Typography>
            {renderStackedRatioRow(
              'Features',
              summary.fetchDetails?.features.output,
              summary.fetchDetails?.features.input,
              chartColor,
              sourceStageMaxima?.featureMax ?? null,
              true,
            )}
            {renderStackedRatioRow(
              'Polygons',
              summary.fetchDetails?.polygons.output,
              summary.fetchDetails?.polygons.input,
              chartColor,
              sourceStageMaxima?.polygonMax ?? null,
              true,
            )}
          </Stack>
        ) : null}
        {(summary.visualization !== 'fetchMetrics' && summary.visualization !== 'transformMetrics') ? (
          <Stack spacing={0.25}>
            <Typography variant="caption" color="text.secondary">{summary.summaryLine ?? '-'}</Typography>
            {(summary.detailLines ?? [])
              .filter((line) => {
                if (summary.kind !== 'failed') return true;
                const normalized = line.trim().replace(/^Failure:\s*/i, '');
                const summaryNormalized = (summary.summaryLine ?? '').trim().replace(/^Failed:\s*/i, '');
                return normalized.length > 0 && normalized !== summaryNormalized;
              })
              .map((line, index) => (
                <Typography key={`${line}-${String(index)}`} variant="caption" color="text.secondary">{line}</Typography>
              ))}
          </Stack>
        ) : null}
      </Box>

      <Box sx={{ mt: 1, flex: 1, minHeight: previewBoxHeight, width: '100%', minWidth: 0 }}>
        {previewLoading || overlays.length === 0 ? (
          <Box
            sx={{
              width: '100%',
              height: '100%',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              bgcolor: 'grey.100',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography variant="caption" color="text.secondary">
              {previewLoading ? 'Loading preview...' : (previewErrorMessage ?? 'Preview unavailable')}
            </Typography>
          </Box>
        ) : (
          <GeometryPreviewMap
            overlays={overlays}
            originalBytes={previewOriginalBytes}
            resultBytes={previewResultBytes}
            resultColor={sizeAccentColor}
            adminLevel={previewAdminLevel}
          />
        )}
      </Box>
    </Box>
  );
};

type TaskItemDetailWindowProps = {
  open: boolean;
  detail: TaskDetailSelection | null;
  onClose: () => void;
  zIndex: number;
  stageId?: string;
  buildConfig?: ShapeBuildConfig;
  onRequestBringToFront?: () => void;
};

export const TaskItemDetailWindow = ({
  open,
  detail,
  onClose,
  zIndex,
  stageId,
  buildConfig,
  onRequestBringToFront,
}: TaskItemDetailWindowProps) => {
  const theme = useTheme();
  const stages = useAtomValue(buildStagesAtom);
  const activeDetail = detail;
  const effectiveStageId = normalizeUiStageId(activeDetail?.task.stage ?? stageId) ?? 'unknown';
  const stageIconMap = useMemo(
    () => new Map(stages.map((stage) => [stage.id, stage.icon])),
    [stages],
  );
  const summary = activeDetail?.summary;
  const title = activeDetail?.title ?? '';
  const previewAdminLevel = useMemo(() => {
    if (!activeDetail) return null;
    const summaryAdminLevel = summary?.adminLevel ?? summary?.fetchDetails?.adminLevel ?? null;
    if (summaryAdminLevel !== null && Number.isFinite(summaryAdminLevel)) {
      return Math.floor(summaryAdminLevel);
    }
    const taskMetadata = asRecord(activeDetail.task.metadata);
    const previewMetadata = asRecord(taskMetadata?.preview);
    const fromPreview = readNumber(previewMetadata?.adminLevel);
    if (fromPreview !== null) return Math.floor(fromPreview);
    const fromTask = readNumber(taskMetadata?.adminLevel);
    if (fromTask !== null) return Math.floor(fromTask);
    return null;
  }, [activeDetail, summary]);
  const countryFlag = toFlagEmoji(summary?.fetchDetails?.countryCode ?? extractCountryCodeFromTitle(title));
  const detailColor = summary?.kind === 'failed' ? 'error.main' : 'text.secondary';
  const chartColor = summary?.kind === 'failed' ? 'error.main' : 'primary.main';

  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewErrorMessage, setPreviewErrorMessage] = useState<string | null>(null);
  const [sourceStageMaxima, setSourceStageMaxima] = useState<SourceStageMaxima | null>(null);

  // Create stage-specific persist key for better state management
  const persistKey = useMemo(() => {
    const stageKey = effectiveStageId === 'source' ? 'source' : 'geometry';
    return `hierarchidb:ui:floating-window:shape:task-detail:${stageKey}`;
  }, [effectiveStageId]);

  const floatingWindow = useFloatingWindow({
    persistKey,
    initialPosition: { x: 8, y: 8 },
    initialSize: { width: 450, height: 450 },
  });
  const { windowState, handlers } = floatingWindow;
  const { show, hide, onStateChange, onClose: handleFloatingClose } = handlers;

  useEffect(() => {
    if (!open || !activeDetail) {
      setPreview(null);
      setPreviewLoading(false);
      setPreviewErrorMessage(null);
      return;
    }
    const canPreview = !isTileEmitLikeStageId(activeDetail.task.stage);
    if (!canPreview) {
      setPreview(null);
      setPreviewLoading(false);
      setPreviewErrorMessage(null);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);
    setPreviewErrorMessage(null);
    void loadPreviewData(activeDetail)
      .then((next) => {
        if (cancelled) return;
        setPreview(next);
      })
      .catch((error) => {
        if (cancelled) return;
        setPreview(null);
        const message = error instanceof Error ? error.message : String(error);
        setPreviewErrorMessage(message);
      })
      .finally(() => {
        if (cancelled) return;
        setPreviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeDetail, open]);

  useEffect(() => {
    if (!open || !activeDetail) {
      setSourceStageMaxima(null);
      return;
    }
    const nodeId = activeDetail.task.nodeId ?? resolveNodeIdFromTask(activeDetail.task);
    if (!nodeId) {
      setSourceStageMaxima(null);
      return;
    }
    let cancelled = false;
    void shapeQueryAPIImpl.getBuildSessionRecord(nodeId)
      .then((session) => {
        if (cancelled) return;
        setSourceStageMaxima(readSourceStageMaxima(session?.sourceStageMaxima));
      })
      .catch(() => {
        if (cancelled) return;
        setSourceStageMaxima(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeDetail, open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, open]);

  useEffect(() => {
    if (open) {
      show();
      return;
    }
    hide();
  }, [hide, open, show]);

  useEffect(() => {
    if (open) return;
    setPreview(null);
    setPreviewLoading(false);
    setPreviewErrorMessage(null);
    setSourceStageMaxima(null);
  }, [open]);

  const resultColor = useMemo(() => {
    if (!summary) return theme.palette.info.main;
    if (summary.kind === 'failed') return theme.palette.error.main;
    if (summary.kind === 'skipped') return theme.palette.warning.main;
    return theme.palette.success.main;
  }, [summary, theme.palette.error.main, theme.palette.info.main, theme.palette.success.main, theme.palette.warning.main]);

  const overlays = useMemo<OverlaySpec[]>(() => {
    if (!open || !preview) return [];
    const next: OverlaySpec[] = [];
    if (preview.previousOriginal) {
      next.push({
        collection: preview.previousOriginal,
        color: theme.palette.grey[500],
        weight: 1,
        opacity: 0.5,
        fillOpacity: 0.05,
      });
    }
    if (preview.original) {
      next.push({
        collection: preview.original,
        color: theme.palette.grey[500],
        weight: 1.2,
        opacity: 0.8,
        fillOpacity: 0.06,
      });
    }
    if (preview.result) {
      next.push({
        collection: preview.result,
        color: resultColor,
        weight: 2,
        opacity: 1,
        fillOpacity: 0.3,
      });
    }
    return next;
  }, [open, preview, resultColor, theme.palette.grey]);

  const handleDownload = () => {
    if (!activeDetail) return;
    const collection = buildPreviewDownloadCollection(preview);
    if (!collection) return;
    const serialized = JSON.stringify(collection);
    const blob = new Blob([serialized], { type: 'application/geo+json' });
    const taskId = activeDetail.task.taskId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `shape-preview-${activeDetail.task.stage}-${taskId}.geojson`;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const isVtTask = isTileEmitLikeStageId(activeDetail?.task.stage);
  const content = isVtTask && activeDetail ? (
    <TileEmitTaskItemDetailWindow detail={activeDetail} buildConfig={buildConfig} />
  ) : (summary ? TaskDetailContent({
    title,
    summary,
    previewAdminLevel,
    detailColor,
    chartColor,
    countryFlag,
    preview,
    previewLoading,
    previewErrorMessage,
    overlays,
    sizeAccentColor: theme.palette.success.main,
    sourceStageMaxima,
    previewBoxHeight: Math.max(140, Math.floor(windowState.size.height * 0.45)),
    withDownloadButton: true,
    onDownload: handleDownload,
  }) : (
    <Box
      sx={{
        width: 320,
        p: 1.5,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
      }}
    >
      <Typography variant="caption" color="text.secondary">
        Hover a task status chip to preview source and result geometry.
      </Typography>
    </Box>
  ));

  const handleWindowClose = useCallback(() => {
    handleFloatingClose();
    onClose();
  }, [handleFloatingClose, onClose]);

  if (!open || !windowState.isVisible) return null;
  const stageLabel = effectiveStageId === 'source'
    ? 'Source'
    : (effectiveStageId === 'geometry' ? 'Geometry' : (effectiveStageId === 'tileEmit' ? 'TileEmit' : effectiveStageId));
  const stageIcon = stageIconMap.get(effectiveStageId) ?? <LayersIcon fontSize="small" />;
  const buildTileEmitBandLabel = (taskId: string | undefined): string => {
    if (!taskId) return 'band ? z?';
    const parts = taskId.split(':');
    if (parts.length < 5) return 'band ? z?';
    const bandIndex = Number.parseInt(parts[2] ?? '', 10);
    const zBase = Number.parseInt(parts[3] ?? '', 10);
    if (!Number.isFinite(bandIndex) || !Number.isFinite(zBase)) return 'band ? z?';
    return `band ${bandIndex} z${zBase}/z${zBase + 1}/z${zBase + 2}`;
  };
  const windowTitle = isVtTask
    ? `TileEmit Geometry Preview: ${buildTileEmitBandLabel(activeDetail?.task.taskId)}`
    : (effectiveStageId === 'tileEmit' ? 'TileEmit Geometry Preview' : `Geometry Preview: ${stageLabel}`);

  return (
    <FloatingWindow
      title={windowTitle}
      titleIcon={stageIcon ? (
        <Box sx={{ color: 'inherit', display: 'inline-flex', alignItems: 'center' }}>
          {stageIcon}
        </Box>
      ) : undefined}
      initialState={{
        ...windowState,
        zIndex, // Apply zIndex from props without resetting position/size
      }}
      onStateChange={onStateChange}
      onClose={handleWindowClose}
      onRequestFocus={onRequestBringToFront}
      resizable
      minWidth={420}
      minHeight={280}
    >
      <Box sx={{ position: 'relative', flex: 1, minHeight: 0 }}>
        {content}
      </Box>
    </FloatingWindow>
  );
};
