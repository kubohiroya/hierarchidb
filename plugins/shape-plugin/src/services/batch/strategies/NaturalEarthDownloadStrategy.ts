import type { Feature, FeatureCollection } from 'geojson';
import type {
  DownloadStageBuildContext,
  DownloadStageOutput,
  DownloadStagePostprocessContext,
  DownloadStagePostprocessResult,
  DownloadStageStrategy,
  DownloadTaskPayloadBuildContext,
} from './DownloadStageStrategy.js';
import type { CountryMetadata, DownloadTask, DownloadTaskPayload } from '../../../common/types/index.js';
import { decodeFlatGeoJson, encodeFlatGeoJson } from './flatgeobuf.js';
import { metadataLoader } from '../../metadata/MetadataLoader.js';
import { buildDownloadTaskId, generateDownloadTaskPayloadsFromSelection } from '../../utils/utils.js';
import { buildDownloadCacheKey, readDownloadBuffer, storeDownloadBufferForNode } from '../../utils/chunkStore.js';

type CountryLookup = Map<string, CountryMetadata>;

export class NaturalEarthDownloadStrategy implements DownloadStageStrategy {
  buildDownloadTaskPayloads(context: DownloadTaskPayloadBuildContext) {
    return generateDownloadTaskPayloadsFromSelection(
      'naturalearth',
      context.selectedArrayByCountries,
      context.countryMetadata,
    );
  }

  async buildDownloadTasks(context: DownloadStageBuildContext) {
    const adminLevels = new Map<number, DownloadTaskPayload>();
    for (const metadata of context.downloadTaskPayloads) {
      const level = metadata.adminLevel;
      if (!adminLevels.has(level)) {
        adminLevels.set(level, metadata);
      }
    }
    const inputsByTaskId = new Map<string, DownloadTaskPayload>();
    const tasks: DownloadTask[] = Array.from(adminLevels.entries()).map(([adminLevel, metadata], index) => {
      const taskId = buildDownloadTaskId(String(context.nodeId), metadata);
      const payload: DownloadTaskPayload = {
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
        taskType: 'download',
        stage: 'wait',
        type: 'download',
        status: 'waiting',
        index,
        progress: 0,
        url: metadata.url,
      };
    });
    return { tasks, inputsByTaskId };
  }

  async postprocessDownloadOutputs(
    context: DownloadStagePostprocessContext,
  ): Promise<DownloadStagePostprocessResult> {
    const outputs: DownloadStageOutput[] = [];
    const selectedCountries = this.collectSelectedCountries(context.downloadTaskPayloads);
    const countryMetadata = await metadataLoader.getCountriesMetadata('naturalearth', selectedCountries, context.nodeId);
    const lookup = this.buildCountryLookup(countryMetadata);

    for (const task of context.downloadTasks) {
      const input = context.downloadInputsById.get(task.taskId);
      if (!input) {
        throw new Error(`[NaturalEarthDownloadStrategy] Missing input for task ${task.taskId}`);
      }
      const adminLevel = input.adminLevel;
      const sourceUrl = input.url;
      const datasetCacheKey = buildDownloadCacheKey({
        dataSource: 'naturalearth',
        adminLevel,
        url: sourceUrl,
      });
      const rawBuffer = await readDownloadBuffer(context.nodeId, datasetCacheKey);
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
        const outputBufferId = buildDownloadCacheKey({
          dataSource: 'naturalearth',
          countryCode,
          adminLevel,
          url: sourceUrl,
        });
        await storeDownloadBufferForNode({
          nodeId: context.nodeId,
          cacheKey: outputBufferId,
          buffer: data,
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

  private collectSelectedCountries(payloads: DownloadTaskPayload[]): string[] {
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
