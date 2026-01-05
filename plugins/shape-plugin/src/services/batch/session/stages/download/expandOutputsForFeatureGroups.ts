import type { NodeId } from '@hierarchidb/common-types';
import type { Feature, FeatureCollection } from 'geojson';
import type { DownloadStageOutput } from '../../../strategies/DownloadStageStrategy.js';
import type { SessionArtifactStore } from '../../../SessionArtifactStore.js';
import { storeDownloadBufferForNode } from '../../../../utils/chunkStore.js';

export type FeatureLabelResolver = (feature: Feature, index: number, fallbackPrefix: string) => string;

export async function expandOutputsForFeatureGroups(params: {
  nodeId: NodeId;
  outputs: DownloadStageOutput[];
  artifactStore: Pick<SessionArtifactStore, 'getRawBuffer'>;
  decodeFeatureCollection: (buffer: ArrayBuffer) => Promise<FeatureCollection | null>;
  encodeFeatureCollection: (collection: FeatureCollection) => Promise<ArrayBuffer>;
  resolveFeatureLabel: FeatureLabelResolver;
  resolveContinentFromFeature: (feature?: Feature | null) => string | undefined;
}): Promise<DownloadStageOutput[]> {
  const {
    nodeId,
    outputs,
    artifactStore,
    decodeFeatureCollection,
    encodeFeatureCollection,
    resolveFeatureLabel,
    resolveContinentFromFeature,
  } = params;

  const expanded: DownloadStageOutput[] = [];

  for (const output of outputs) {
    const raw = await artifactStore.getRawBuffer(output.inputBufferId);
    if (!raw) {
      expanded.push(output);
      continue;
    }
    const collection = await decodeFeatureCollection(raw.data);
    if (!collection || collection.features.length === 0) {
      expanded.push(output);
      continue;
    }

    const resolvedContinent = output.continent ?? resolveContinentFromFeature(collection.features[0]);
    const fallbackPrefix = output.adminLevel != null ? `ADM${output.adminLevel}` : 'feature';

    for (let index = 0; index < collection.features.length; index++) {
      const feature = collection.features[index];
      if (!feature) continue;

      const featureLabel = resolveFeatureLabel(feature, index, fallbackPrefix);
      const featureGroupId = String(
        (feature.properties as Record<string, unknown> | undefined)?.id ?? feature.id ?? index,
      );

      const featureCollection: FeatureCollection = { type: 'FeatureCollection', features: [feature] };
      const bufferId = `${output.inputBufferId}-feature-${index}`;
      const data = await encodeFeatureCollection(featureCollection);
      //const bbox = turfBbox(featureCollection);
      await storeDownloadBufferForNode({
        nodeId,
        cacheKey: bufferId,
        buffer: data,
      });

      expanded.push({
        ...output,
        continent: resolvedContinent,
        inputBufferId: bufferId,
        featureGroupId,
        featureLabel,
        featureIndex: index,
        featureCount: collection.features.length,
      });
    }
  }

  console.debug(`[Session ${String(nodeId)}] Expanded outputs for feature groups`, {
    inputOutputs: outputs.length,
    expandedOutputs: expanded.length,
    createdBuffers: expanded.length - outputs.length,
  });

  return expanded;
}
