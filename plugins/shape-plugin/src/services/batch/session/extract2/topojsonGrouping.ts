import type { NodeId } from '@hierarchidb/common-types';
import type { Feature, FeatureCollection } from 'geojson';
import { bbox as turfBbox } from '@turf/turf';
import type { Extract1Task, Extract2Task } from '../../../../common/types/index.js';
import { BatchTaskStage } from '../../../../common/types/index.js';
import type { ShapeExtract1TaskInputData, ShapeExtract2TaskInputData } from '@hierarchidb/plugin-service-api';
import { HDB_ORIGIN_KEY } from '../../utils/featureIds.js';
import { normalizeTaskIdSegment } from '../ids/processingIds.js';
import { lat2tileY, lon2tileX, tileBBox } from '../../../utils/tiles-util.js';

type Candidate = {
  task: Extract1Task;
  continent: string;
  countryName: string;
  countryCode?: string;
  adminCode?: string;
  adminLevel?: number;
  originKey?: string;
  originLabel?: string;
  sourceUrl?: string;
  features: Feature[];
};

type GroupLevel = 'world' | 'continent' | 'country';

type FeatureEntry = {
  feature: Feature;
  bbox: [number, number, number, number];
  input?: ShapeExtract1TaskInputData;
  task: Extract1Task;
};

type GroupRecord = {
  key: string;
  level: GroupLevel;
  items: FeatureEntry[];
  bbox: [number, number, number, number];
};

function applyFeatureMetadata(
  collection: FeatureCollection,
  meta: {
    continent?: string;
    countryName?: string;
    countryCode?: string;
    adminCode?: string;
    originKey?: string;
  },
): FeatureCollection {
  for (const feature of collection.features) {
    if (!feature) continue;
    feature.properties ??= {} as Record<string, unknown>;
    const properties = feature.properties;

    if (meta.continent && typeof properties.continent !== 'string') {
      properties.continent = meta.continent;
    }
    if (meta.countryName && typeof properties.countryName !== 'string') {
      properties.countryName = meta.countryName;
    }
    if (meta.countryCode && typeof properties.countryCode !== 'string') {
      properties.countryCode = meta.countryCode;
    }
    if (meta.adminCode && typeof properties.adminCode !== 'string') {
      properties.adminCode = meta.adminCode;
    }
    if (meta.originKey && typeof properties[HDB_ORIGIN_KEY] !== 'string') {
      properties[HDB_ORIGIN_KEY] = meta.originKey;
    }
  }
  return collection;
}

const unionBBox = (current: [number, number, number, number] | null, next: [number, number, number, number]) => {
  if (!current) return [...next] as [number, number, number, number];
  return [
    Math.min(current[0], next[0]),
    Math.min(current[1], next[1]),
    Math.max(current[2], next[2]),
    Math.max(current[3], next[3]),
  ] as [number, number, number, number];
};

const bboxIntersects = (a: [number, number, number, number], b: [number, number, number, number]): boolean => (
  a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1]
);

const clampBBox = (bbox: [number, number, number, number]): [number, number, number, number] => {
  const minLon = Math.max(-180, Math.min(180, bbox[0]));
  const maxLon = Math.max(-180, Math.min(180, bbox[2]));
  const minLat = Math.max(-85.05112878, Math.min(85.05112878, bbox[1]));
  const maxLat = Math.max(-85.05112878, Math.min(85.05112878, bbox[3]));
  return [minLon, minLat, maxLon, maxLat];
};

const expandBBoxForZoom = (
  bbox: [number, number, number, number],
  zoom: number,
  expandFactor: number,
  expandMargin: number,
): [number, number, number, number] => {
  const centerLon = (bbox[0] + bbox[2]) / 2;
  const centerLat = (bbox[1] + bbox[3]) / 2;
  const tileX = lon2tileX(centerLon, zoom);
  const tileY = lat2tileY(centerLat, zoom);
  const tileBounds = tileBBox(zoom, tileX, tileY);
  const tileWidth = tileBounds[2] - tileBounds[0];
  const tileHeight = tileBounds[3] - tileBounds[1];
  const expandTiles = Math.max(0, expandFactor) + Math.max(0, expandMargin);
  const expandLon = tileWidth * expandTiles;
  const expandLat = tileHeight * expandTiles;
  return clampBBox([
    bbox[0] - expandLon,
    bbox[1] - expandLat,
    bbox[2] + expandLon,
    bbox[3] + expandLat,
  ]);
};

const resolveGroupLevel = (zoomMax: number): GroupLevel => {
  if (zoomMax <= 0) return 'world';
  if (zoomMax <= 4) return 'continent';
  return 'country';
};

const buildZoomLevels = (minZoom: number, maxZoom: number): number[] => (
  Array.from({ length: Math.max(0, maxZoom - minZoom + 1) }, (_, index) => minZoom + index)
);

const splitZoomRange = (range: { minZoom: number; maxZoom: number; label: string }) => {
  const segments: Array<{ minZoom: number; maxZoom: number; label: string; zoomLevels: number[] }> = [];
  const lower = Math.min(range.minZoom, range.maxZoom);
  const upper = Math.max(range.minZoom, range.maxZoom);

  if (lower <= 0 && upper >= 0) {
    segments.push({ minZoom: 0, maxZoom: 0, label: 'z0-0', zoomLevels: [0] });
  }
  if (upper >= 1 && lower <= 4) {
    const segMin = Math.max(1, lower);
    const segMax = Math.min(4, upper);
    if (segMin <= segMax) {
      segments.push({ minZoom: segMin, maxZoom: segMax, label: `z${segMin}-${segMax}`, zoomLevels: buildZoomLevels(segMin, segMax) });
    }
  }
  if (upper >= 5) {
    const segMin = Math.max(5, lower);
    const segMax = upper;
    if (segMin <= segMax) {
      segments.push({ minZoom: segMin, maxZoom: segMax, label: `z${segMin}-${segMax}`, zoomLevels: buildZoomLevels(segMin, segMax) });
    }
  }

  return segments.length > 0
    ? segments
    : [{ minZoom: lower, maxZoom: upper, label: range.label, zoomLevels: buildZoomLevels(lower, upper) }];
};

const buildGroupBufferId = (nodeId: NodeId, level: GroupLevel, key: string, rangeLabel: string): string => (
  `${String(nodeId)}-extract1-topo-${normalizeTaskIdSegment(level)}-${normalizeTaskIdSegment(key)}-${normalizeTaskIdSegment(rangeLabel)}`
);

const buildGroupRecords = (level: GroupLevel, entries: FeatureEntry[]): GroupRecord[] => {
  if (level === 'world') {
    const worldBBox = entries.reduce<[number, number, number, number] | null>(
      (acc, entry) => unionBBox(acc, entry.bbox),
      null,
    );
    if (!worldBBox) return [];
    return [{
      key: 'world',
      level: 'world',
      items: entries,
      bbox: worldBBox,
    }];
  }

  const groupMap = new Map<string, GroupRecord>();
  for (const entry of entries) {
    const input = entry.input;
    const rawKey = level === 'continent'
      ? (input?.continent ?? 'UNKNOWN')
      : (input?.countryCode ?? input?.countryName ?? 'UNKNOWN');
    const normalizedKey = normalizeTaskIdSegment(rawKey);
    const existing = groupMap.get(normalizedKey);
    if (existing) {
      existing.items.push(entry);
      existing.bbox = unionBBox(existing.bbox, entry.bbox);
    } else {
      groupMap.set(normalizedKey, {
        key: rawKey,
        level,
        items: [entry],
        bbox: entry.bbox,
      });
    }
  }
  return Array.from(groupMap.values());
};

export async function buildExtract2TasksWithTopoJSON(params: {
  nodeId: NodeId;
  extract1Tasks: Extract1Task[];
  extract1InputsByTaskId: Map<string, ShapeExtract1TaskInputData>;
  zoomRanges: Array<{ minZoom: number; maxZoom: number; zoomLevels: number[]; label: string }>;
  vectorTileBuffer: number;
  vectorTileExtent: number;
  scaleTolerance: (zoomMax: number) => number;
  tileExpandFactor?: number;
  tileExpandMargin?: number;
  buildTaskId: (stage: 'extract2', details: { countryCode?: string; adminLevel?: number; featureGroupId?: string; zoomRangeLabel?: string }) => string;
  resolveTaskContinent: (input?: ShapeExtract1TaskInputData) => string | undefined;
  resolveTaskCountryName: (input?: ShapeExtract1TaskInputData) => string | undefined;
  resolveTaskCountryCode: (task: Extract1Task, input?: ShapeExtract1TaskInputData) => string | undefined;
  resolveTaskAdminCode: (input?: ShapeExtract1TaskInputData) => string | undefined;
  getExtractedBuffer: (bufferId: string) => Promise<{ data: ArrayBuffer } | null>;
  decodeFeatureCollection: (buffer: ArrayBuffer) => Promise<FeatureCollection | null>;
  encodeFeatureCollection: (collection: FeatureCollection) => Promise<ArrayBuffer>;
  putExtractedBuffers: (buffers: Array<{ id: string; nodeId: NodeId; stage: 'extract1'; data: ArrayBuffer; featureCount: number; extractionRatio: number; tolerance: number; timestamp: number }>) => Promise<void>;
  consoleWarn: (message: string, data?: unknown) => void;
  consoleDebug: (message: string, data?: unknown) => void;
}): Promise<{ tasks: Extract2Task[]; inputsByTaskId: Map<string, ShapeExtract2TaskInputData> }> {
  const candidates: Candidate[] = [];
  const featureEntries: FeatureEntry[] = [];

  let missingMetadata = 0;
  let missingBuffer = 0;

  for (const task of params.extract1Tasks) {
    const input = params.extract1InputsByTaskId.get(task.taskId);
    const continent = params.resolveTaskContinent(input);
    const countryName = params.resolveTaskCountryName(input);
    if (!continent || !countryName) {
      missingMetadata += 1;
      params.consoleWarn('Missing continent/countryName; skipping extract2 task', {
        taskId: task.taskId,
        continent,
        countryCode: task.countryCode,
        adminLevel: task.adminLevel,
      });
      continue;
    }

    const inputBufferId = `${String(params.nodeId)}-extract1-${task.index ?? 0}`;
    const buffer = await params.getExtractedBuffer(inputBufferId);
    if (!buffer) {
      missingBuffer += 1;
      params.consoleWarn('Extract1 buffer missing; skipping extract2 task', {
        taskId: task.taskId,
        inputBufferId,
      });
      continue;
    }

    const collection = await params.decodeFeatureCollection(buffer.data);
    if (!collection || collection.features.length === 0) {
      continue;
    }

    const originKey = input?.originKey;
    const countryCode = params.resolveTaskCountryCode(task, input);
    const adminCode = params.resolveTaskAdminCode(input);

    applyFeatureMetadata(collection, {
      continent,
      countryName,
      countryCode,
      adminCode,
      originKey,
    });

    candidates.push({
      task,
      continent,
      countryName,
      countryCode,
      adminCode,
      adminLevel: task.adminLevel,
      originKey,
      originLabel: input?.originLabel,
      sourceUrl: input?.sourceUrl,
      features: collection.features,
    });

    for (const feature of collection.features) {
      if (!feature) continue;
      if (!feature.geometry) continue;
      const bounds = turfBbox(feature);
      if (!bounds || bounds.length !== 4) continue;
      featureEntries.push({
        feature,
        bbox: [bounds[0], bounds[1], bounds[2], bounds[3]],
        input,
        task,
      });
    }
  }

  if (candidates.length === 0) {
    return { tasks: [], inputsByTaskId: new Map() };
  }

  const groupsByLevel = new Map<GroupLevel, GroupRecord[]>();
  groupsByLevel.set('world', buildGroupRecords('world', featureEntries));
  groupsByLevel.set('continent', buildGroupRecords('continent', featureEntries));
  groupsByLevel.set('country', buildGroupRecords('country', featureEntries));

  const tasks: Extract2Task[] = [];
  const inputsByTaskId = new Map<string, ShapeExtract2TaskInputData>();
  const newBuffers: Array<{
    id: string;
    nodeId: NodeId;
    stage: 'extract1';
    data: ArrayBuffer;
    featureCount: number;
    extractionRatio: number;
    tolerance: number;
    timestamp: number;
  }> = [];

  const expandFactor = params.tileExpandFactor ?? 1;
  const expandMargin = params.tileExpandMargin ?? 0;
  let nextTaskIndex = 0;

  const effectiveRanges = params.zoomRanges.flatMap((range) => splitZoomRange(range));

  for (const range of effectiveRanges) {
    const level = resolveGroupLevel(range.maxZoom);
    const groups = groupsByLevel.get(level) ?? [];
    for (const group of groups) {
      if (!group) continue;
      const expandedBBox = expandBBoxForZoom(group.bbox, range.maxZoom, expandFactor, expandMargin);
      const neighborGroups = groups.filter((candidate) => bboxIntersects(candidate.bbox, expandedBBox));
      const features: Feature[] = [];
      for (const neighbor of neighborGroups) {
        for (const entry of neighbor.items) {
          if (bboxIntersects(entry.bbox, expandedBBox)) {
            features.push(entry.feature);
          }
        }
      }
      if (features.length === 0) continue;

      const groupCollection: FeatureCollection = { type: 'FeatureCollection', features };
      const groupBufferId = buildGroupBufferId(params.nodeId, level, group.key, range.label);
      const data = await params.encodeFeatureCollection(groupCollection);

      newBuffers.push({
        id: groupBufferId,
        nodeId: params.nodeId,
        stage: 'extract1',
        data,
        featureCount: features.length,
        extractionRatio: 1,
        tolerance: 0,
        timestamp: Date.now(),
      });

      const primaryCandidate = candidates.find((candidate) => (
        level === 'world'
        || (level === 'continent' && normalizeTaskIdSegment(candidate.continent) === normalizeTaskIdSegment(group.key))
        || (level === 'country' && normalizeTaskIdSegment(candidate.countryCode ?? candidate.countryName ?? '') === normalizeTaskIdSegment(group.key))
      ));
      const featureGroupId = level === 'world'
        ? 'world-group'
        : level === 'continent'
          ? `continent-group:${group.key}`
          : `country-group:${group.key}`;
      const zoomRangeLabel = range.label;
      const taskId = params.buildTaskId('extract2', {
        countryCode: primaryCandidate?.countryCode,
        adminLevel: primaryCandidate?.adminLevel,
        featureGroupId,
        zoomRangeLabel,
      });
      const tolerance = params.scaleTolerance(range.maxZoom);

      tasks.push({
        taskId,
        nodeId: params.nodeId,
        taskType: 'extract2',
        stage: BatchTaskStage.WAIT,
        type: 'extract2',
        status: 'waiting',
        index: nextTaskIndex,
        progress: 0,
        inputBufferId: groupBufferId,
        continent: primaryCandidate?.continent,
        adminLevel: primaryCandidate?.adminLevel,
      });

      inputsByTaskId.set(taskId, {
        inputBufferId: groupBufferId,
        sourceTaskId: primaryCandidate?.task.taskId,
        sourceUrl: primaryCandidate?.sourceUrl,
        featureGroupId,
        adminCode: primaryCandidate?.adminCode,
        originKey: primaryCandidate?.originKey,
        originLabel: primaryCandidate?.originLabel,
        continent: primaryCandidate?.continent,
        dataSource: primaryCandidate
          ? params.extract1InputsByTaskId.get(primaryCandidate.task.taskId)?.dataSource
          : undefined,
        countryCode: primaryCandidate?.countryCode,
        adminLevel: primaryCandidate?.adminLevel,
        countryName: primaryCandidate?.countryName,
        zoomLevels: range.zoomLevels,
        zoomRange: [range.minZoom, range.maxZoom],
        zoomRangeLabel,
        tolerance,
        vectorTileBuffer: params.vectorTileBuffer,
        vectorTileExtent: params.vectorTileExtent,
        vectorTileMaxZoom: range.maxZoom,
      });

      nextTaskIndex += 1;
    }
  }

  if (newBuffers.length > 0) {
    await params.putExtractedBuffers(newBuffers);
  }

  params.consoleDebug('Extract2 topojson build summary', {
    extract1Tasks: params.extract1Tasks.length,
    candidates: candidates.length,
    groups: {
      world: groupsByLevel.get('world')?.length ?? 0,
      continent: groupsByLevel.get('continent')?.length ?? 0,
      country: groupsByLevel.get('country')?.length ?? 0,
    },
    tasks: tasks.length,
    skippedMissingMetadata: missingMetadata,
    skippedMissingBuffer: missingBuffer,
  });

  return { tasks, inputsByTaskId };
}
