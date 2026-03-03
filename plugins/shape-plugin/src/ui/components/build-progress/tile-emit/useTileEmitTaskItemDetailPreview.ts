import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Feature, Geometry } from 'geojson';
import type { NodeId } from '@hierarchidb/core-types';
import { DEFAULT_BUILD_CONFIG } from '@hierarchidb/shape-api';
import { shapeQueryAPIImpl } from '~/services/build/ShapeBuildAPIClient';
import { ephemeralDB } from '@hierarchidb/gis-sdk';
import { buildBands, decodeGeometryCache } from '~/services/vt/shapePipelineShared';
import { unpackTileId } from '@hierarchidb/vt-orchestrator';
import type { TaskDetailSelection } from '~/ui/components/build-progress/TaskItemCard/TaskItemDetailTypes';
import type { ShapeBuildConfig } from '~/common/types/BuildTaskResult';
import type { TileBBox } from './TileEmitGeometryPreviewMap';

type TileEmitTaskTileInfo = {
  bandIndex: number;
  zBase: number;
  tileId: number;
  tile: { z: number; x: number; y: number };
};

type FeaturePreviewEntry = {
  id: string;
  label: string;
  countryCode?: string | null;
  geojsonBytes: number;
};

export type TileEmitPreviewData = {
  tileInfo: TileEmitTaskTileInfo | null;
  tileBBox: TileBBox | null;
  bufferBBox: TileBBox | null;
  features: Feature<Geometry>[];
  entries: FeaturePreviewEntry[];
  inputBytes: number;
  parentTileBytes: number | null;
  totalTileBytes: number | null;
  tileCount: number | null;
};

const resolveTileBuffer = (config: { buffer?: number; bufferSize?: number }): number => {
  if (Number.isFinite(config.buffer) && (config.buffer as number) >= 0) {
    return config.buffer as number;
  }
  if (Number.isFinite(config.bufferSize) && (config.bufferSize as number) >= 0) {
    return config.bufferSize as number;
  }
  return 64;
};

export const resolveIndexMaxPoints = (value: number | null | undefined): number => (
  Number.isFinite(value) && (value as number) > 0 ? (value as number) : 100000
);

const parseTileEmitTaskId = (taskId: string | undefined): TileEmitTaskTileInfo | null => {
  if (!taskId) return null;
  const parts = taskId.split(':');
  if (parts.length < 5) return null;
  const [nodeIdPart, stage, bandIndexRaw, zBaseRaw, tileIdRaw] = parts;
  if (!nodeIdPart || stage !== 'tileEmit') return null;
  const bandIndex = Number.parseInt(bandIndexRaw ?? '', 10);
  const zBase = Number.parseInt(zBaseRaw ?? '', 10);
  const tileId = Number.parseInt(tileIdRaw ?? '', 10);
  if (!Number.isFinite(bandIndex) || !Number.isFinite(zBase) || !Number.isFinite(tileId)) return null;
  const tile = unpackTileId(tileId, zBase);
  return {
    bandIndex,
    zBase,
    tileId,
    tile,
  };
};

const tileToBBox = (z: number, x: number, y: number): TileBBox => {
  const n = 2 ** z;
  const lon1 = x / n * 360 - 180;
  const lon2 = (x + 1) / n * 360 - 180;
  const lat1 = (180 / Math.PI) * Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n)));
  const lat2 = (180 / Math.PI) * Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n)));
  return { minX: lon1, minY: lat2, maxX: lon2, maxY: lat1 };
};

const expandTileBBox = (bbox: TileBBox, buffer: number, extent: number): TileBBox => {
  if (!Number.isFinite(buffer) || buffer <= 0) return bbox;
  if (!Number.isFinite(extent) || extent <= 0) return bbox;
  const lonSpan = bbox.maxX - bbox.minX;
  const latSpan = bbox.maxY - bbox.minY;
  if (!Number.isFinite(lonSpan) || !Number.isFinite(latSpan)) return bbox;
  const factor = buffer / extent;
  const lonMargin = lonSpan * factor;
  const latMargin = latSpan * factor;
  return {
    minX: bbox.minX - lonMargin,
    minY: bbox.minY - latMargin,
    maxX: bbox.maxX + lonMargin,
    maxY: bbox.maxY + latMargin,
  };
};

const bboxIntersects = (a: TileBBox, b: TileBBox): boolean => (
  a.minX <= b.maxX
  && a.maxX >= b.minX
  && a.minY <= b.maxY
  && a.maxY >= b.minY
);

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

const collectPositions = (coords: unknown, acc: Array<[number, number]> = []): Array<[number, number]> => {
  if (!Array.isArray(coords)) return acc;
  if (coords.length === 0) return acc;
  if (typeof coords[0] === 'number') {
    const [x, y] = coords as [number, number];
    if (Number.isFinite(x) && Number.isFinite(y)) acc.push([x, y]);
    return acc;
  }
  coords.forEach((entry) => collectPositions(entry, acc));
  return acc;
};

const computeFeatureBBox = (feature: Feature<Geometry>): TileBBox | null => {
  if (!feature.geometry) return null;
  const positions = collectPositions(feature.geometry.coordinates);
  if (positions.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  positions.forEach(([x, y]) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  });
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }
  return { minX, minY, maxX, maxY };
};

const resolveDisplayName = (metadata: Record<string, unknown> | null): string => {
  if (!metadata) return 'Unknown';
  const adminLevel = typeof metadata.adminLevel === 'number' ? Math.max(0, Math.floor(metadata.adminLevel)) : 0;
  const admin0 = (metadata.admin0Name ?? metadata.countryName ?? metadata.countryCode) as string | undefined;
  const admin1 = metadata.admin1Name as string | undefined;
  const admin2 = metadata.admin2Name as string | undefined;
  if (adminLevel <= 0) return admin0 ?? 'Unknown';
  if (adminLevel === 1) return [admin0, admin1].filter(Boolean).join(' / ') || 'Unknown';
  return [admin0, admin1, admin2].filter(Boolean).join(' / ') || 'Unknown';
};

const resolveCountryCode = (metadata: Record<string, unknown> | null): string | null => {
  const raw = metadata?.countryCode ?? metadata?.admin0Code;
  if (typeof raw !== 'string') return null;
  const normalized = raw.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
};

const sumGeojsonBytes = (features: FeaturePreviewEntry[]): number => (
  features.reduce((sum, entry) => sum + entry.geojsonBytes, 0)
);

const resolveParentInputSummaryBytes = (metadata: Record<string, unknown> | undefined): number | null => {
  if (!metadata || typeof metadata !== 'object') return null;
  const summary = (metadata as Record<string, unknown>).tileEmitParentInputSummary as Record<string, unknown> | undefined;
  const rawBytes = summary?.intersectingGeojsonByteSize;
  if (typeof rawBytes === 'number' && Number.isFinite(rawBytes)) {
    return Math.max(0, Math.round(rawBytes));
  }
  return null;
};

const toNodeId = (value: string | undefined | null): NodeId | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed as NodeId;
};

const resolveBandRange = (buildConfig: ShapeBuildConfig, bandIndex: number) => {
  const boundaries = buildConfig.geometryConfig?.zoomBandBoundaries;
  const bands = Array.isArray(boundaries) ? buildBands(boundaries) : [];
  return bands.find((band) => band.bandIndex === bandIndex) ?? null;
};

const tileWithinParent = (parent: { z: number; x: number; y: number }, tile: { z: number; x: number; y: number }): boolean => {
  if (tile.z < parent.z) return false;
  const scale = 1 << (tile.z - parent.z);
  const xStart = parent.x * scale;
  const xEnd = (parent.x + 1) * scale - 1;
  const yStart = parent.y * scale;
  const yEnd = (parent.y + 1) * scale - 1;
  return tile.x >= xStart && tile.x <= xEnd && tile.y >= yStart && tile.y <= yEnd;
};

type Args = {
  detail: TaskDetailSelection;
  buildConfig?: ShapeBuildConfig;
};

export const useTileEmitTaskItemDetailPreview = ({ detail, buildConfig }: Args) => {
  const [previewData, setPreviewData] = useState<TileEmitPreviewData>({
    tileInfo: null,
    tileBBox: null,
    bufferBBox: null,
    features: [],
    entries: [],
    inputBytes: 0,
    parentTileBytes: null,
    totalTileBytes: null,
    tileCount: null,
  });
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [hoveredFeatureId, setHoveredFeatureId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const resolvedBuildConfig = useMemo(() => (
    buildConfig ?? DEFAULT_BUILD_CONFIG
  ), [buildConfig]);
  const tileEmitConfig = resolvedBuildConfig.tileEmitConfig ?? DEFAULT_BUILD_CONFIG.tileEmitConfig;
  const tileBuffer = resolveTileBuffer(tileEmitConfig);
  const effectiveIndexMaxPoints = resolveIndexMaxPoints(tileEmitConfig.indexMaxPoints);

  useEffect(() => {
    if (detail.task.stage !== 'tileEmit') return;
    const nodeId = detail.task.nodeId ?? toNodeId(detail.task.taskId?.split(':')[0] ?? null);
    if (!nodeId) return;
    const tileInfo = parseTileEmitTaskId(detail.task.taskId);
    if (!tileInfo) return;
    let cancelled = false;
    setLoading(true);
    setSelectedFeatureId(null);
    setHoveredFeatureId(null);
    void (async () => {
      const tileBBox = tileToBBox(tileInfo.tile.z, tileInfo.tile.x, tileInfo.tile.y);
      const bufferBBox = expandTileBBox(tileBBox, tileBuffer, tileEmitConfig.extent);
      const relations = await ephemeralDB.tileEmitBufferRelations
        .where('[nodeId+bandIndex+tileId]')
        .equals([String(nodeId), tileInfo.bandIndex, String(tileInfo.tileId)])
        .toArray();
      const bufferIds = relations.map((relation) => relation.bufferId);
      const [featureMetadata, vtMetadata] = await Promise.all([
        shapeQueryAPIImpl.listFeatureMetadata(nodeId),
        shapeQueryAPIImpl.listTileEmitMetadata(nodeId),
      ]);
      const metadataById = new Map(featureMetadata.map((row) => [row.featureId, row]));
      const collections = await Promise.all(bufferIds.map((bufferId) => (
        shapeQueryAPIImpl.getGeometryCache(bufferId).then((record) => (
          record?.data ? decodeGeometryCache(record.data) : null
        ))
      )));
      const features: Feature<Geometry>[] = [];
      collections.forEach((collection) => {
        if (!collection) return;
        collection.features.forEach((feature) => {
          const bbox = computeFeatureBBox(feature as Feature<Geometry>);
          if (!bbox || !bboxIntersects(tileBBox, bbox)) return;
          features.push(feature as Feature<Geometry>);
        });
      });

      const entriesMap = new Map<string, FeaturePreviewEntry>();
      features.forEach((feature) => {
        const featureId = resolveFeatureId(feature);
        if (!featureId) return;
        const meta = metadataById.get(featureId) as Record<string, unknown> | undefined;
        const label = resolveDisplayName(meta ?? null);
        const countryCode = resolveCountryCode(meta ?? null);
        const geojsonBytes = typeof meta?.geojsonByteSize === 'number' && Number.isFinite(meta.geojsonByteSize)
          ? Math.max(0, Math.round(meta.geojsonByteSize))
          : 0;
        if (!entriesMap.has(featureId)) {
          entriesMap.set(featureId, {
            id: featureId,
            label,
            countryCode,
            geojsonBytes,
          });
        }
      });
      const entries = Array.from(entriesMap.values()).sort((a, b) => a.label.localeCompare(b.label));
      const inputBytes = resolveParentInputSummaryBytes(detail.task.metadata) ?? sumGeojsonBytes(entries);
      const bandRange = resolveBandRange(resolvedBuildConfig, tileInfo.bandIndex);
      const zMax = bandRange?.zMax ?? tileInfo.zBase;
      const parentTileCandidates = vtMetadata.filter((row) => (
        row.z === tileInfo.tile.z && row.x === tileInfo.tile.x && row.y === tileInfo.tile.y
      ));
      const parentTileBytes = parentTileCandidates.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))[0]?.size ?? null;
      let totalTileBytes = 0;
      let totalTileCount = 0;
      vtMetadata.forEach((row) => {
        if (row.z < tileInfo.tile.z || row.z > zMax) return;
        if (!tileWithinParent(tileInfo.tile, row)) return;
        totalTileCount += 1;
        totalTileBytes += row.size;
      });
      const aggregatedBytes = totalTileCount > 0 ? totalTileBytes : null;
      const aggregatedCount = totalTileCount > 0 ? totalTileCount : null;

      if (cancelled) return;
      setPreviewData({
        tileInfo,
        tileBBox,
        bufferBBox,
        features,
        entries,
        inputBytes,
        parentTileBytes,
        totalTileBytes: aggregatedBytes,
        tileCount: aggregatedCount,
      });
    })()
      .catch(() => {})
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [detail, resolvedBuildConfig, tileBuffer, tileEmitConfig.extent]);

  const handleResetSelection = useCallback(() => {
    setSelectedFeatureId(null);
    setHoveredFeatureId(null);
  }, []);

  return {
    effectiveIndexMaxPoints,
    handleResetSelection,
    hoveredFeatureId,
    loading,
    previewData,
    selectedFeatureId,
    setHoveredFeatureId,
    setSelectedFeatureId,
    tileBuffer,
    tileEmitConfig,
  };
};
