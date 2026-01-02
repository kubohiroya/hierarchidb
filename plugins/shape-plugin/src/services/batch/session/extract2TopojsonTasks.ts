import type { NodeId } from '@hierarchidb/common-types';
import type { FeatureCollection } from 'geojson';
import type { Extract1Task, Extract2Task } from '../../../common/types/index.js';
import { BatchTaskStage } from '../../../common/types/index.js';
import type { ShapeExtract1TaskInputData, ShapeExtract2TaskInputData } from '@hierarchidb/plugin-service-api';
import type { OriginMetadata } from './SessionTypes.js';
import type { SessionArtifactStore } from '../SessionArtifactStore.js';
import { splitGroupByKey, sumBy } from './extract2Topojson/groupUtils.js';
import { buildCandidates, type Extract2TopojsonCandidate } from './extract2Topojson/buildCandidates.js';

export type Extract2TopojsonBuildResult = {
  tasks: Extract2Task[];
  inputsByTaskId: Map<string, ShapeExtract2TaskInputData>;
};

type Candidate = Extract2TopojsonCandidate;

const sumFeatures = (items: Candidate[]) => sumBy(items, (item) => item.features.length);

export async function buildExtract2TasksWithTopoJSON(params: {
  nodeId: NodeId;
  extract1Tasks: Extract1Task[];
  extract1InputsByTaskId: Map<string, ShapeExtract1TaskInputData>;
  originMetadataByBuffer: Map<string, OriginMetadata>;
  store: SessionArtifactStore;
  decodeFeatureCollection: (buffer: ArrayBuffer) => Promise<FeatureCollection | null>;
  encodeFeatureCollection: (collection: FeatureCollection) => Promise<ArrayBuffer>;
  buildProcessingTaskId: (stage: 'extract2', details: { countryCode?: string; adminLevel?: number; featureGroupId?: string }) => string;
  maxFeaturesPerGroup?: number;
  originKeyPropertyName?: string;
}): Promise<Extract2TopojsonBuildResult> {
  const {
    nodeId,
    extract1Tasks,
    extract1InputsByTaskId,
    store,
    decodeFeatureCollection,
    encodeFeatureCollection,
    buildProcessingTaskId,
    maxFeaturesPerGroup = 2000,
    originKeyPropertyName,
  } = params;

  const { candidates, missingMetadata, missingBuffer } = await buildCandidates({
    nodeId,
    extract1Tasks,
    extract1InputsByTaskId,
    store,
    decodeFeatureCollection,
    originKeyPropertyName,
  });

  if (candidates.length === 0) {
    return { tasks: [], inputsByTaskId: new Map() };
  }

  const continentGroups = splitGroupByKey(
    candidates,
    (entry) => `${entry.dataSource ?? 'unknown'}|${entry.adminLevel ?? 'NA'}|${entry.continent}`,
  );

  const finalGroups: Array<{ key: string; items: Candidate[] }> = [];

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

  for (let index = 0; index < finalGroups.length; index += 1) {
    const group = finalGroups[index];
    const groupFeatures = group?.items.flatMap((item) => item.features);
    if (!groupFeatures || groupFeatures.length === 0) continue;

    const groupCollection: FeatureCollection = {
      type: 'FeatureCollection',
      features: groupFeatures,
    };

    const groupBufferId = `${String(nodeId)}-extract1-group-${index}`;
    const data = await encodeFeatureCollection(groupCollection);

    newBuffers.push({
      id: groupBufferId,
      nodeId,
      stage: 'extract1',
      data,
      featureCount: groupFeatures.length,
      extractionRatio: 1,
      tolerance: 0,
      timestamp: Date.now(),
    });

    const primary = group?.items[0];
    if (!primary) continue;

    const featureGroupId = `continent-group:${group.key}`;
    const taskId = buildProcessingTaskId('extract2', {
      countryCode: primary.countryCode,
      adminLevel: primary.adminLevel,
      featureGroupId,
    });

    tasks.push({
      taskId,
      nodeId,
      taskType: 'extract2',
      stage: BatchTaskStage.WAIT,
      type: 'extract2',
      status: 'waiting',
      index,
      progress: 0,
      inputBufferId: groupBufferId,
      continent: primary.continent,
      adminLevel: primary.adminLevel,
      countryCode: primary.countryCode,
      adminCode: primary.adminCode,
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
      dataSource: primary.dataSource,
      countryCode: primary.countryCode,
      adminLevel: primary.adminLevel,
      countryName: primary.countryName,
    });
  }

  if (newBuffers.length > 0) {
    await store.putExtractedBuffers(newBuffers);
  }

  console.debug(`[Session ${String(nodeId)}] Extract2 topojson build summary`, {
    extract1Tasks: extract1Tasks.length,
    candidates: candidates.length,
    groups: finalGroups.length,
    tasks: tasks.length,
    skippedMissingMetadata: missingMetadata,
    skippedMissingBuffer: missingBuffer,
  });

  return { tasks, inputsByTaskId };
}
