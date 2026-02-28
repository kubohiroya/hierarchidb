import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  IconButton,
  Paper,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import CloseIcon from '@mui/icons-material/Close';
import LayersIcon from '@mui/icons-material/Layers';
import { useAtomValue } from 'jotai';
import type { Feature, FeatureCollection } from 'geojson';
import { feature as topojsonFeature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import { geojson as geojsonApi } from 'flatgeobuf';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { NodeId } from '@hierarchidb/core-types';
import type { ShapeFetchCache } from '@hierarchidb/shape-api';
import { shapeQueryAPIImpl } from '~/services/build/ShapeBuildAPIClient';
import type { DataSourceName } from '~/common/types';
import {
  buildRawDataDataSourceCacheKey,
  readRawDataDataSourceBuffer,
} from '~/services/utils/chunkStore';
import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressAtoms';
import { buildStagesAtom } from '~/ui/atoms/shapeBuildProgressAtoms';
import type { TaskOutcomeSummary } from '~/ui/components/build-progress/TaskItem/TaskItem';

type TaskDetailPayload = {
  title: string;
  summary: TaskOutcomeSummary;
  task: ShapeBuildTaskSummary;
};
export type TaskDetailSelection = TaskDetailPayload;

type PreviewData = {
  original: FeatureCollection | null;
  result: FeatureCollection | null;
  previousOriginal: FeatureCollection | null;
  originalBytes: number;
  resultBytes: number;
};

type FetchStageMaxima = {
  featureMax: number;
  polygonMax: number;
};

type OverlaySpec = {
  collection: FeatureCollection;
  color: string;
  weight: number;
  opacity: number;
  fillOpacity: number;
};

type SourcePreviewParams = {
  nodeId: NodeId;
  dataSource: DataSourceName;
  sourceUrl: string;
  sourceCountryCode: string;
  adminLevel: number;
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

const readShapeDataSourceName = (value: unknown): DataSourceName | null => {
  if (typeof value !== 'string') return null;
  if (value === 'naturalearth' || value === 'geoboundaries' || value === 'geoboundaries-topojson' || value === 'gadm') {
    return value;
  }
  return null;
};

const formatKb = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 kB';
  return `${numberFormatter.format(Math.max(0, Math.round(bytes / 1024)))} kB`;
};

const readFetchStageMaxima = (value: unknown): FetchStageMaxima | null => {
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

const decodeFetchCacheCollection = async (
  cache: ShapeFetchCache,
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

const decodeFetchCacheCollectionWithFallback = async (
  cache: ShapeFetchCache,
  format: 'flatgeobuf' | 'topojson',
  compression: 'none' | 'gzip',
): Promise<FeatureCollection | null> => {
  const preferred = await decodeFetchCacheCollection(cache, format, compression).catch(() => null);
  if (preferred) return preferred;
  const fallbackFormat = format === 'topojson' ? 'flatgeobuf' : 'topojson';
  return decodeFetchCacheCollection(cache, fallbackFormat, compression).catch(() => null);
};

const decodeTransformCacheCollection = async (buffer: ArrayBuffer): Promise<FeatureCollection | null> => {
  const decoded = geojsonApi.deserialize(new Uint8Array(buffer));
  return normalizeFeatureCollection(decoded);
};

const decodeTransformCacheCollectionWithFallback = async (buffer: ArrayBuffer): Promise<FeatureCollection | null> => {
  const preferred = await decodeTransformCacheCollection(buffer).catch(() => null);
  if (preferred) return preferred;
  return decodeTopoJsonCollection(buffer).catch(() => null);
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

const decodeRawSourceCollectionWithFallback = async (buffer: ArrayBuffer): Promise<FeatureCollection | null> => {
  const json = await decodeJsonSourceCollection(buffer).catch(() => null);
  if (json) return json;
  const fgb = await decodeTransformCacheCollection(buffer).catch(() => null);
  if (fgb) return fgb;
  return null;
};

const loadSourceCollectionFromCache = async (
  nodeId: NodeId,
  sourceParams: SourcePreviewParams | null,
  preview: Record<string, unknown> | null,
): Promise<FeatureCollection | null> => {
  const previewCacheKey = readString(preview?.rawSourceCacheKey);
  const fallbackCacheKey = sourceParams
    ? buildRawDataDataSourceCacheKey({
      dataSource: sourceParams.dataSource,
      countryCode: sourceParams.sourceCountryCode,
      adminLevel: sourceParams.adminLevel,
      url: sourceParams.sourceUrl,
    })
    : null;
  const cacheKey = previewCacheKey ?? fallbackCacheKey;
  if (!cacheKey) return null;
  const rawBuffer = await readRawDataDataSourceBuffer(nodeId, cacheKey);
  if (!rawBuffer) return null;
  return decodeRawSourceCollectionWithFallback(rawBuffer);
};

const resolveSourcePreviewParams = (nodeId: NodeId, preview: Record<string, unknown> | null): SourcePreviewParams | null => {
  if (!preview) return null;
  const dataSource = readShapeDataSourceName(preview.dataSource);
  const sourceUrl = readString(preview.sourceUrl);
  const sourceCountryCode = readString(preview.sourceCountryCode);
  const adminLevel = readNumber(preview.adminLevel);
  if (!dataSource || !sourceUrl || !sourceCountryCode || adminLevel === null) return null;
  return {
    nodeId,
    dataSource,
    sourceUrl,
    sourceCountryCode,
    adminLevel,
  };
};

const resolveCacheId = (
  preview: Record<string, unknown> | null,
  task: ShapeBuildTaskSummary,
  key: 'fetchCacheId' | 'transformCacheId',
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
  if (!nodeId) {
    return {
      original: null,
      result: null,
      previousOriginal: null,
      originalBytes: 0,
      resultBytes: 0,
    };
  }
  const sourceParams = resolveSourcePreviewParams(nodeId, preview);

  if (detail.task.stage === 'fetch') {
    const fetchCacheId = resolveCacheId(preview, detail.task, 'fetchCacheId');
    const fetchCacheFormat = readString(preview?.fetchCacheFormat) === 'topojson' ? 'topojson' : 'flatgeobuf';
    const fetchCacheCompression = readString(preview?.fetchCacheCompression) === 'gzip' ? 'gzip' : 'none';
    const [sourceCollection, fetchCache] = await Promise.all([
      loadSourceCollectionFromCache(nodeId, sourceParams, preview).catch(() => null),
      fetchCacheId ? shapeQueryAPIImpl.getFetchCache(nodeId, fetchCacheId) : Promise.resolve(null),
    ]);
    const resultCollection = fetchCache
      ? await decodeFetchCacheCollectionWithFallback(fetchCache, fetchCacheFormat, fetchCacheCompression)
      : null;
    return {
      original: sourceCollection,
      result: resultCollection,
      previousOriginal: null,
      originalBytes: measureCollectionBytes(sourceCollection),
      resultBytes: (fetchCache?.size && fetchCache.size > 0)
        ? fetchCache.size
        : measureCollectionBytes(resultCollection),
    };
  }

  if (detail.task.stage === 'transform') {
    const fetchCacheId = resolveCacheId(preview, detail.task, 'fetchCacheId');
    const fetchCacheFormat = readString(preview?.fetchCacheFormat) === 'topojson' ? 'topojson' : 'flatgeobuf';
    const fetchCacheCompression = readString(preview?.fetchCacheCompression) === 'gzip' ? 'gzip' : 'none';
    const transformCacheId = resolveCacheId(preview, detail.task, 'transformCacheId');

    const [sourceCollection, fetchCache, transformCache] = await Promise.all([
      loadSourceCollectionFromCache(nodeId, sourceParams, preview).catch(() => null),
      fetchCacheId ? shapeQueryAPIImpl.getFetchCache(nodeId, fetchCacheId) : Promise.resolve(null),
      transformCacheId ? shapeQueryAPIImpl.getTransformCache(transformCacheId) : Promise.resolve(null),
    ]);

    const originalCollection = fetchCache
      ? await decodeFetchCacheCollectionWithFallback(fetchCache, fetchCacheFormat, fetchCacheCompression)
      : null;
    const resultCollection = transformCache
      ? await decodeTransformCacheCollectionWithFallback(transformCache.data)
      : null;

    return {
      original: originalCollection,
      result: resultCollection,
      previousOriginal: sourceCollection,
      originalBytes: (fetchCache?.size && fetchCache.size > 0)
        ? fetchCache.size
        : measureCollectionBytes(originalCollection),
      resultBytes: (transformCache?.data.byteLength && transformCache.data.byteLength > 0)
        ? transformCache.data.byteLength
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

const renderTransformScaledRow = (
  label: string,
  output: number | null | undefined,
  input: number | null | undefined,
  fetchStageMax: number | null | undefined,
  colorToken: string,
): React.ReactNode => {
  const safeOutput = typeof output === 'number' && Number.isFinite(output) && output >= 0 ? output : null;
  const safeInput = typeof input === 'number' && Number.isFinite(input) && input > 0 ? input : null;
  const safeFetchMax = typeof fetchStageMax === 'number' && Number.isFinite(fetchStageMax) && fetchStageMax > 0
    ? fetchStageMax
    : null;
  const firstRatio = (safeOutput !== null && safeInput !== null) ? Math.max(0, Math.min(1, safeOutput / safeInput)) : null;
  const secondRatio = (safeInput !== null && safeFetchMax !== null) ? Math.max(0, Math.min(1, safeInput / safeFetchMax)) : null;
  const combinedRatio = (firstRatio !== null && secondRatio !== null)
    ? Math.max(0, Math.min(1, firstRatio * secondRatio))
    : null;
  const inputScale = (safeInput !== null && safeFetchMax !== null) ? Math.max(0, Math.min(1, safeInput / safeFetchMax)) : null;
  const outputScale = (safeOutput !== null && safeFetchMax !== null) ? Math.max(0, Math.min(1, safeOutput / safeFetchMax)) : null;
  const text = (
    safeOutput !== null && safeInput !== null && safeFetchMax !== null
      ? `${formatNumber(safeOutput)} / ${formatNumber(safeInput)} x ${formatNumber(safeInput)} / ${formatNumber(safeFetchMax)} (${formatPercent(combinedRatio)})`
      : `${formatNumber(output)} / ${formatNumber(input)} x ${formatNumber(input)} / ${formatNumber(fetchStageMax)} (N/A)`
  );

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

const GeometryPreviewMap = ({
  overlays,
  originalBytes,
  resultBytes,
  resultColor,
}: {
  overlays: OverlaySpec[];
  originalBytes: number;
  resultBytes: number;
  resultColor: string;
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
  }, []);

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

type TaskDetailContentProps = {
  title: string;
  summary: TaskOutcomeSummary;
  detailColor: string;
  chartColor: string;
  countryFlag: string | null;
  preview: PreviewData | null;
  previewLoading: boolean;
  overlays: OverlaySpec[];
  sizeAccentColor: string;
  fetchStageMaxima: FetchStageMaxima | null;
  previewBoxHeight: number;
  withDownloadButton: boolean;
  onDownload?: () => void;
};

const TaskDetailContent = ({
  title,
  summary,
  detailColor,
  chartColor,
  countryFlag,
  preview,
  previewLoading,
  overlays,
  sizeAccentColor,
  fetchStageMaxima,
  previewBoxHeight,
  withDownloadButton,
  onDownload,
}: TaskDetailContentProps): React.ReactElement => {
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
            {renderTransformScaledRow(
              'Features',
              summary.metrics?.features.output,
              summary.metrics?.features.input,
              fetchStageMaxima?.featureMax ?? null,
              chartColor,
            )}
            {renderTransformScaledRow(
              'Polygons',
              summary.metrics?.polygons.output,
              summary.metrics?.polygons.input,
              fetchStageMaxima?.polygonMax ?? null,
              chartColor,
            )}
            {renderVolumeRow(
              'Vertices',
              summary.metrics?.vertices.output,
              summary.metrics?.vertices.input,
              chartColor,
              true,
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
              fetchStageMaxima?.featureMax ?? null,
              true,
            )}
            {renderStackedRatioRow(
              'Polygons',
              summary.fetchDetails?.polygons.output,
              summary.fetchDetails?.polygons.input,
              chartColor,
              fetchStageMaxima?.polygonMax ?? null,
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
              <Typography key={`${line}-${index}`} variant="caption" color="text.secondary">{line}</Typography>
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
              {previewLoading ? 'Loading preview...' : 'Preview unavailable'}
            </Typography>
          </Box>
        ) : (
          <GeometryPreviewMap
            overlays={overlays}
            originalBytes={preview?.originalBytes ?? 0}
            resultBytes={preview?.resultBytes ?? 0}
            resultColor={sizeAccentColor}
          />
        )}
      </Box>
    </Box>
  );
};

type TaskItemDetailFloatingWindowProps = {
  open: boolean;
  detail: TaskDetailSelection | null;
  onClose: () => void;
  zIndex: number;
  stageId?: string;
  onRequestBringToFront?: () => void;
};

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export const TaskItemDetailFloatingWindow = ({
  open,
  detail,
  onClose,
  zIndex,
  stageId,
  onRequestBringToFront,
}: TaskItemDetailFloatingWindowProps) => {
  const theme = useTheme();
  const stages = useAtomValue(buildStagesAtom);
  const activeDetail = detail;
  const effectiveStageId = activeDetail?.task.stage ?? stageId ?? 'unknown';
  const stageIconMap = useMemo(
    () => new Map(stages.map((stage) => [stage.id, stage.icon])),
    [stages],
  );
  const summary = activeDetail?.summary;
  const title = activeDetail?.title ?? '';
  const countryFlag = toFlagEmoji(summary?.fetchDetails?.countryCode ?? extractCountryCodeFromTitle(title));
  const detailColor = summary?.kind === 'failed' ? 'error.main' : 'text.secondary';
  const chartColor = summary?.kind === 'failed' ? 'error.main' : 'primary.main';

  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [fetchStageMaxima, setFetchStageMaxima] = useState<FetchStageMaxima | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 8, y: 8 });
  const [windowSize, setWindowSize] = useState<{ width: number; height: number }>({ width: 580, height: 420 });
  const [resizeActive, setResizeActive] = useState(false);
  const dragStateRef = useRef<{ startClientX: number; startClientY: number; startX: number; startY: number } | null>(null);
  const resizeStateRef = useRef<{
    direction: ResizeDirection;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  useEffect(() => {
    if (!activeDetail) {
      setPreview(null);
      setPreviewLoading(false);
      return;
    }
    const canPreview = activeDetail.task.stage === 'fetch' || activeDetail.task.stage === 'transform';
    if (!canPreview) {
      setPreview(null);
      setPreviewLoading(false);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);
    void loadPreviewData(activeDetail)
      .then((next) => {
        if (cancelled) return;
        setPreview(next);
      })
      .catch(() => {
        if (cancelled) return;
        setPreview(null);
      })
      .finally(() => {
        if (cancelled) return;
        setPreviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeDetail]);

  useEffect(() => {
    if (!activeDetail) {
      setFetchStageMaxima(null);
      return;
    }
    const nodeId = activeDetail.task.nodeId ?? resolveNodeIdFromTask(activeDetail.task);
    if (!nodeId) {
      setFetchStageMaxima(null);
      return;
    }
    let cancelled = false;
    void shapeQueryAPIImpl.getBuildSessionRecord(nodeId)
      .then((session) => {
        if (cancelled) return;
        setFetchStageMaxima(readFetchStageMaxima(session?.fetchStageMaxima));
      })
      .catch(() => {
        if (cancelled) return;
        setFetchStageMaxima(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeDetail]);

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
    if (!open) return;
    const handleWindowMouseMove = (event: MouseEvent) => {
      const dragging = dragStateRef.current;
      const resizing = resizeStateRef.current;
      if (dragging) {
        const nextX = dragging.startX + (event.clientX - dragging.startClientX);
        const nextY = dragging.startY + (event.clientY - dragging.startClientY);
        setPosition({
          x: Math.max(0, Math.round(nextX)),
          y: Math.max(0, Math.round(nextY)),
        });
      }
      if (resizing) {
        const minWidth = 420;
        const minHeight = 280;
        const deltaX = event.clientX - resizing.startClientX;
        const deltaY = event.clientY - resizing.startClientY;
        let nextX = resizing.startX;
        let nextY = resizing.startY;
        let nextWidth = resizing.startWidth;
        let nextHeight = resizing.startHeight;

        if (resizing.direction.includes('e')) {
          nextWidth = Math.max(minWidth, Math.round(resizing.startWidth + deltaX));
        }
        if (resizing.direction.includes('s')) {
          nextHeight = Math.max(minHeight, Math.round(resizing.startHeight + deltaY));
        }
        if (resizing.direction.includes('w')) {
          const candidateWidth = Math.max(minWidth, Math.round(resizing.startWidth - deltaX));
          nextX = Math.max(0, Math.round(resizing.startX + (resizing.startWidth - candidateWidth)));
          nextWidth = candidateWidth;
        }
        if (resizing.direction.includes('n')) {
          const candidateHeight = Math.max(minHeight, Math.round(resizing.startHeight - deltaY));
          nextY = Math.max(0, Math.round(resizing.startY + (resizing.startHeight - candidateHeight)));
          nextHeight = candidateHeight;
        }

        setPosition({ x: nextX, y: nextY });
        setWindowSize({ width: nextWidth, height: nextHeight });
      }
    };
    const handleWindowMouseUp = () => {
      dragStateRef.current = null;
      resizeStateRef.current = null;
      setResizeActive(false);
    };
    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [open]);

  const resultColor = useMemo(() => {
    if (!summary) return theme.palette.info.main;
    if (summary.kind === 'failed') return theme.palette.error.main;
    if (summary.kind === 'skipped') return theme.palette.warning.main;
    return theme.palette.success.main;
  }, [summary, theme.palette.error.main, theme.palette.info.main, theme.palette.success.main, theme.palette.warning.main]);

  const overlays = useMemo<OverlaySpec[]>(() => {
    if (!preview) return [];
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
  }, [preview, resultColor, theme.palette.grey]);

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

  const content = summary ? TaskDetailContent({
    title,
    summary,
    detailColor,
    chartColor,
    countryFlag,
    preview,
    previewLoading,
    overlays,
    sizeAccentColor: theme.palette.success.main,
    fetchStageMaxima,
    previewBoxHeight: Math.max(140, Math.floor(windowSize.height * 0.45)),
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
  );

  if (!open) return null;
  const stageLabel = effectiveStageId === 'fetch'
    ? 'Fetch'
    : (effectiveStageId === 'transform' ? 'Transform' : (effectiveStageId === 'vt' ? 'VT' : effectiveStageId));
  const stageIcon = stageIconMap.get(effectiveStageId) ?? <LayersIcon fontSize="small" />;

  const handleTitleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragStateRef.current = {
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: position.x,
      startY: position.y,
    };
  };
  const handleResizeMouseDown = (event: React.MouseEvent<HTMLDivElement>, direction: ResizeDirection) => {
    event.preventDefault();
    event.stopPropagation();
    resizeStateRef.current = {
      direction,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: position.x,
      startY: position.y,
      startWidth: windowSize.width,
      startHeight: windowSize.height,
    };
    setResizeActive(true);
  };

  return (
    <Paper
      elevation={8}
      onMouseDown={() => onRequestBringToFront?.()}
      sx={{
        position: 'fixed',
        top: position.y,
        left: position.x,
        zIndex: (zTheme) => zTheme.zIndex.modal + zIndex,
        background: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        width: windowSize.width,
        minWidth: 420,
        minHeight: 280,
        height: windowSize.height,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box
        onMouseDown={handleTitleMouseDown}
        sx={{
          px: 1,
          py: 0.5,
          cursor: 'move',
          userSelect: 'none',
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: 'background.default',
        }}
      >
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', color: 'text.secondary' }}>
            {stageIcon}
          </Box>
          <Typography variant="caption" sx={{ fontWeight: 700 }}>
            {`Geometry Preview: ${stageLabel}`}
          </Typography>
        </Box>
        <IconButton size="small" aria-label="Close preview" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      <Box sx={{ position: 'relative', flex: 1, minHeight: 0 }}>
        {content}
      </Box>
      <Box onMouseDown={(event) => handleResizeMouseDown(event, 'e')} sx={{ position: 'absolute', top: 8, bottom: 8, right: -3, width: 8, cursor: 'ew-resize' }} />
      <Box onMouseDown={(event) => handleResizeMouseDown(event, 'w')} sx={{ position: 'absolute', top: 8, bottom: 8, left: -3, width: 8, cursor: 'ew-resize' }} />
      <Box onMouseDown={(event) => handleResizeMouseDown(event, 's')} sx={{ position: 'absolute', left: 8, right: 8, bottom: -3, height: 8, cursor: 'ns-resize' }} />
      <Box onMouseDown={(event) => handleResizeMouseDown(event, 'n')} sx={{ position: 'absolute', left: 8, right: 8, top: -3, height: 8, cursor: 'ns-resize' }} />
      <Box
        onMouseDown={(event) => handleResizeMouseDown(event, 'se')}
        sx={{
          position: 'absolute',
          right: -2,
          bottom: -2,
          width: 12,
          height: 12,
          cursor: 'nwse-resize',
          background: resizeActive ? 'action.selected' : 'transparent',
          borderTopLeftRadius: 2,
        }}
      />
      <Box onMouseDown={(event) => handleResizeMouseDown(event, 'sw')} sx={{ position: 'absolute', left: -2, bottom: -2, width: 12, height: 12, cursor: 'nesw-resize' }} />
      <Box onMouseDown={(event) => handleResizeMouseDown(event, 'ne')} sx={{ position: 'absolute', right: -2, top: -2, width: 12, height: 12, cursor: 'nesw-resize' }} />
      <Box onMouseDown={(event) => handleResizeMouseDown(event, 'nw')} sx={{ position: 'absolute', left: -2, top: -2, width: 12, height: 12, cursor: 'nwse-resize' }} />
    </Paper>
  );
};
