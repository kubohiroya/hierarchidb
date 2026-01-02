import type { NodeId } from '@hierarchidb/common-types';
import type { Feature, FeatureCollection } from 'geojson';
import type { Extract1Task, Extract2Task } from '../../../../common/types/index.js';
import { BatchTaskStage } from '../../../../common/types/index.js';
import type { ShapeExtract1TaskInputData, ShapeExtract2TaskInputData } from '@hierarchidb/plugin-service-api';
import { HDB_ORIGIN_KEY } from '../../utils/featureIds.js';

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

function splitGroupByKey<T>(
  items: T[],
  resolveKey: (item: T) => string,
): Array<{ key: string; items: T[] }> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = resolveKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)?.push(item);
  }
  return Array.from(groups.entries()).map(([key, groupItems]) => ({ key, items: groupItems }));
}

export async function buildExtract2TasksWithTopoJSON(params: {
  nodeId: NodeId;
  extract1Tasks: Extract1Task[];
  extract1InputsByTaskId: Map<string, ShapeExtract1TaskInputData>;
  buildTaskId: (stage: 'extract2', details: { countryCode?: string; adminLevel?: number; featureGroupId?: string }) => string;
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
  const maxFeaturesPerGroup = 2000;
  const candidates: Candidate[] = [];

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
  }

  if (candidates.length === 0) {
    return { tasks: [], inputsByTaskId: new Map() };
  }

  const continentGroups = splitGroupByKey(
    candidates,
    (entry) => `${params.extract1InputsByTaskId.get(entry.task.taskId)?.dataSource ?? 'unknown'}|${entry.adminLevel ?? 'NA'}|${entry.continent}`,
  );

  const sumFeatures = (items: Candidate[]) => items.reduce((total, item) => total + item.features.length, 0);

  const finalGroups: { key: string; items: Candidate[] }[] = [];
  for (const group of continentGroups) {
    if (sumFeatures(group.items) <= maxFeaturesPerGroup) {
      finalGroups.push(group);
      continue;
    }
    const countryGroups = splitGroupByKey(group.items, (entry) => `${group.key}|${entry.countryCode ?? 'UNKNOWN'}`);
    for (const countryGroup of countryGroups) {
      if (sumFeatures(countryGroup.items) <= maxFeaturesPerGroup) {
        finalGroups.push(countryGroup);
        continue;
      }
      const adminGroups = splitGroupByKey(countryGroup.items, (entry) => `${countryGroup.key}|${entry.adminCode ?? 'UNKNOWN'}`);
      finalGroups.push(...adminGroups);
    }
  }

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

  const groupsToProcess: { key: string; items: Candidate[] }[] = finalGroups;
  for (let index = 0; index < groupsToProcess.length; index += 1) {
    const group = groupsToProcess[index];
    if (!group) continue;
    if (group.items.length === 0) continue;
    const groupFeatures = group.items.flatMap((item) => item.features);
    if (groupFeatures.length === 0) continue;

    const groupCollection: FeatureCollection = { type: 'FeatureCollection', features: groupFeatures };
    const groupBufferId = `${String(params.nodeId)}-extract1-group-${index}`;
    const data = await params.encodeFeatureCollection(groupCollection);

    newBuffers.push({
      id: groupBufferId,
      nodeId: params.nodeId,
      stage: 'extract1',
      data,
      featureCount: groupFeatures.length,
      extractionRatio: 1,
      tolerance: 0,
      timestamp: Date.now(),
    });

    const primary = group.items[0];
    if (!primary) continue;
    const featureGroupId = `continent-group:${group.key}`;
    const taskId = params.buildTaskId('extract2', {
      countryCode: primary.countryCode,
      adminLevel: primary.adminLevel,
      featureGroupId,
    });

    tasks.push({
      taskId,
      nodeId: params.nodeId,
      taskType: 'extract2',
      stage: BatchTaskStage.WAIT,
      type: 'extract2',
      status: 'waiting',
      index,
      progress: 0,
      inputBufferId: groupBufferId,
      continent: primary.continent,
      adminLevel: primary.adminLevel,
    });

    inputsByTaskId.set(taskId, {
      inputBufferId: groupBufferId,
      sourceTaskId: primary.task.taskId,
      sourceUrl: primary.sourceUrl,
      featureGroupId,
      adminCode: primary.adminCode,
      originKey: primary.originKey,
      originLabel: primary.originLabel,
      continent: primary.continent,
      dataSource: params.extract1InputsByTaskId.get(primary.task.taskId)?.dataSource,
      countryCode: primary.countryCode,
      adminLevel: primary.adminLevel,
      countryName: primary.countryName,
    });
  }

  if (newBuffers.length > 0) {
    await params.putExtractedBuffers(newBuffers);
  }

  params.consoleDebug('Extract2 topojson build summary', {
    extract1Tasks: params.extract1Tasks.length,
    candidates: candidates.length,
    groups: finalGroups.length,
    tasks: tasks.length,
    skippedMissingMetadata: missingMetadata,
    skippedMissingBuffer: missingBuffer,
  });

  return { tasks, inputsByTaskId };
}
