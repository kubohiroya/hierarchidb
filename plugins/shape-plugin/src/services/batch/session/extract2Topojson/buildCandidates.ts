import type { NodeId } from '@hierarchidb/common-types';
import type { FeatureCollection, Feature } from 'geojson';
import type { Extract1Task } from '../../../../common/types/index.js';
import type { ShapeDataSourceName, ShapeExtract1TaskInputData } from '@hierarchidb/plugin-service-api';
import type { SessionArtifactStore } from '../../SessionArtifactStore.js';
import {
  getOriginKeyFromInput,
  resolveAdminCode,
  resolveContinent,
  resolveCountryCode,
  resolveCountryName,
} from './resolvers.js';
import { applyFeatureMetadata } from './applyFeatureMetadata.js';

export type Extract2TopojsonCandidate = {
  task: Extract1Task;
  continent: string;
  countryName: string;
  countryCode?: string;
  adminCode?: string;
  adminLevel?: number;
  originKey?: string;
  originLabel?: string;
  sourceUrl?: string;
  dataSource?: ShapeDataSourceName;
  features: Feature[];
};

export type BuildCandidatesResult = {
  candidates: Extract2TopojsonCandidate[];
  missingMetadata: number;
  missingBuffer: number;
};

export async function buildCandidates(params: {
  nodeId: NodeId;
  extract1Tasks: Extract1Task[];
  extract1InputsByTaskId: Map<string, ShapeExtract1TaskInputData>;
  store: SessionArtifactStore;
  decodeFeatureCollection: (buffer: ArrayBuffer) => Promise<FeatureCollection | null>;
  originKeyPropertyName?: string;
}): Promise<BuildCandidatesResult> {
  const {
    nodeId,
    extract1Tasks,
    extract1InputsByTaskId,
    store,
    decodeFeatureCollection,
    originKeyPropertyName,
  } = params;

  const candidates: Extract2TopojsonCandidate[] = [];
  let missingMetadata = 0;
  let missingBuffer = 0;

  for (const task of extract1Tasks) {
    const input = extract1InputsByTaskId.get(task.taskId);
    const continent = resolveContinent(input);
    const countryName = resolveCountryName(input);

    if (!continent || !countryName) {
      missingMetadata += 1;
      console.warn(`[Session ${String(nodeId)}] Missing continent/countryName; skipping extract2 task`, {
        taskId: task.taskId,
        continent,
        countryCode: task.countryCode,
        adminLevel: task.adminLevel,
      });
      continue;
    }

    const inputBufferId = `${String(nodeId)}-extract1-${task.index ?? 0}`;
    const buffer = await store.getExtractedBuffer(inputBufferId);
    if (!buffer) {
      missingBuffer += 1;
      console.warn(`[Session ${String(nodeId)}] Extract1 buffer missing; skipping extract2 task`, {
        taskId: task.taskId,
        inputBufferId,
      });
      continue;
    }

    const collection = await decodeFeatureCollection(buffer.data);
    if (!collection || collection.features.length === 0) {
      continue;
    }

    const originKey = getOriginKeyFromInput(input);
    const countryCode = resolveCountryCode(task, input);
    const adminCode = resolveAdminCode(input);

    applyFeatureMetadata(collection, {
      continent,
      countryName,
      countryCode,
      adminCode,
      originKey,
      originKeyPropertyName,
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
      dataSource: input?.dataSource,
      features: collection.features,
    });
  }

  return { candidates, missingMetadata, missingBuffer };
}

