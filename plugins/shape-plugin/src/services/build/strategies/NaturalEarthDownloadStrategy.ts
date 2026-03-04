import type { Feature, FeatureCollection } from 'geojson';
import type {
  SourceStageBuildContext,
  SourceStageOutput,
  SourceStagePostprocessContext,
  SourceStagePostprocessResult,
  SourceStageStrategy,
  SourcePayloadBuildContext,
} from './SourceStageStrategy.ts';
import type { CountryMetadata, SourceTask, SourceTaskPayload } from '~/common/types/index';
import { decodeFlatGeoJson, encodeFlatGeoJson } from './flatgeobuf.js';
import { metadataLoader } from '~/services/metadata/MetadataLoader';
import { buildSourceTaskId, generateDownloadTaskPayloadsFromSelection } from '~/services/utils/shapeBuildUtils';
import { buildRawDataDataSourceCacheKey, readRawDataDataSourceBuffer, storeRawDataDataSourceBufferForNode } from '~/services/utils/chunkStore';

type CountryLookup = Map<string, CountryMetadata>;

export class NaturalEarthDownloadStrategy implements SourceStageStrategy {
  buildSourceTaskPayloads(context: SourcePayloadBuildContext) {
    return generateDownloadTaskPayloadsFromSelection(
      'naturalearth',
      context.selectedArrayByCountries,
      context.countryMetadata,
    );
  }

  async buildSourceTasks(context: SourceStageBuildContext) {
    const adminLevels = new Map<number, SourceTaskPayload>();
    for (const metadata of context.sourceTaskPayloads) {
      const level = metadata.adminLevel;
      if (!adminLevels.has(level)) {
        adminLevels.set(level, metadata);
      }
    }
    const inputsByTaskId = new Map<string, SourceTaskPayload>();
    const tasks: SourceTask[] = Array.from(adminLevels.entries()).map(([adminLevel, metadata], index) => {
      const taskId = buildSourceTaskId(String(context.nodeId), metadata);
      const payload: SourceTaskPayload = {
        url: metadata.url,
        countryCode: metadata.countryCode,
        countryName: metadata.countryName,
        adminLevel,
        dataSource: 'naturalearth',
      };
      inputsByTaskId.set(taskId, payload);
      return {
        taskId,
        nodeId: context.nodeId,
        stage: 'wait',
        type: 'source',
        status: 'queued',
        index,
        progress: 0,
        url: metadata.url,
      };
    });
    return { tasks, inputsByTaskId };
  }

  async buildPostprocessOutputs(
    context: SourceStagePostprocessContext,
  ): Promise<SourceStagePostprocessResult> {
    const outputs: SourceStageOutput[] = [];
    const selectedCountries = this.collectSelectedCountries(context.sourceTaskPayloads);
    const countryMetadata = await metadataLoader.getCountriesMetadata('naturalearth', selectedCountries, context.nodeId);
    const lookup = this.buildCountryLookup(countryMetadata);

    for (const task of context.sourceTasks) {
      const input = context.sourceTaskInputsById.get(task.taskId);
      if (!input) {
        throw new Error(`[NaturalEarthDownloadStrategy] Missing input for task ${task.taskId}`);
      }
      const adminLevel = input.adminLevel;
      const sourceUrl = input.url;
      const datasetCacheKey = buildRawDataDataSourceCacheKey({
        dataSource: 'naturalearth',
        adminLevel,
        url: sourceUrl,
      });
      const rawBuffer = await readRawDataDataSourceBuffer(context.nodeId, datasetCacheKey);
      if (!rawBuffer) continue;

      const geojson = await decodeFlatGeoJson(rawBuffer);
      const buckets = this.partitionFeaturesByCountry(geojson, lookup);

      for (const [countryCode, features] of buckets.entries()) {
        if (!features.length) continue;
        const country = lookup.get(countryCode.toUpperCase());
        const countryName = country?.countryName;
        const continent = country?.continent;
        const collection: FeatureCollection = { type: 'FeatureCollection', features };
        const data = await encodeFlatGeoJson(collection);
        const outputBufferId = buildRawDataDataSourceCacheKey({
          dataSource: 'naturalearth',
          countryCode,
          adminLevel,
          url: sourceUrl,
        });
        await storeRawDataDataSourceBufferForNode({
          nodeId: context.nodeId,
          cacheKey: outputBufferId,
          buffer: data,
          contentType: 'application/flatgeobuf',
        });
        outputs.push({
          inputBufferId: outputBufferId,
          countryCode,
          countryName,
          continent,
          adminLevel,
          dataSource: 'naturalearth',
          sourceUrl,
        });
      }
    }

    return { outputs };
  }

  private collectSelectedCountries(payloads: SourceTaskPayload[]): string[] {
    const codes = new Set<string>();
    payloads.forEach((metadata) => {
      codes.add(metadata.countryCode);
    });
    return Array.from(codes.values());
  }

  private buildCountryLookup(metadata: CountryMetadata[]): CountryLookup {
    const lookup = new Map<string, CountryMetadata>();
    metadata.forEach((country) => {
      if (country.countryCode) {
        lookup.set(country.countryCode.toUpperCase(), country);
      }
      if (country.iso2) {
        lookup.set(country.iso2.toUpperCase(), country);
      }
      if (country.iso3) {
        lookup.set(country.iso3.toUpperCase(), country);
      }
    });
    return lookup;
  }

  private partitionFeaturesByCountry(
    collection: FeatureCollection,
    lookup: CountryLookup,
  ): Map<string, Feature[]> {
    const buckets = new Map<string, Feature[]>();
    for (const feature of collection.features ?? []) {
      const properties = feature.properties ?? {};
      const iso2 = this.readProperty(properties, ['ISO_A2', 'ISO_3166_1', 'iso_a2']);
      const iso3 = this.readProperty(properties, ['ISO_A3', 'ADM0_A3', 'adm0_a3', 'iso_a3']);
      const target = iso2 ?? iso3;
      if (!target) continue;
      const country = lookup.get(target.toUpperCase());
      if (!country) continue;
      const bucketKey = country.countryCode.toUpperCase();
      const bucket = buckets.get(bucketKey) ?? [];
      bucket.push(feature);
      buckets.set(bucketKey, bucket);
    }
    return buckets;
  }

  private readProperty(properties: Record<string, unknown>, keys: string[]): string | undefined {
    for (const key of keys) {
      const value = properties[key];
      if (typeof value === 'string' && value.trim()) {
        return value;
      }
    }
    return undefined;
  }

}
