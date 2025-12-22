import type { Feature, FeatureCollection } from 'geojson';
import { bbox as turfBbox } from '@turf/turf';
import type {
  DownloadStageBuildContext,
  DownloadStageOutput,
  DownloadStagePostprocessContext,
  DownloadStagePostprocessResult,
  DownloadStageStrategy,
} from './DownloadStageStrategy.js';
import type { CountryMetadata, DownloadTask, UrlMetadata } from '../../../common/types/index.js';
import { getEphemeralShapeDB } from '../../database/EphemeralShapeDB.js';
import { decodeFlatGeoJson, encodeFlatGeoJson } from './flatgeobuf.js';
import { metadataLoader } from '../../metadata/MetadataLoader.js';

type CountryLookup = Map<string, CountryMetadata>;

export class NaturalEarthDownloadStrategy implements DownloadStageStrategy {
  async buildDownloadTasks(context: DownloadStageBuildContext): Promise<DownloadTask[]> {
    const adminLevels = new Map<number, UrlMetadata>();
    for (const metadata of context.urlMetadata) {
      const level = metadata.adminLevel;
      if (!adminLevels.has(level)) {
        adminLevels.set(level, metadata);
      }
    }
    return Array.from(adminLevels.entries()).map(([adminLevel, metadata], index) => ({
      taskId: `${context.sessionId}-download-${index}`,
      sessionId: context.sessionId,
      taskType: 'download',
      stage: 'wait',
      type: 'download',
      status: 'waiting',
      index,
      progress: 0,
      url: metadata.url,
      config: {
        dataSource: 'naturalearth',
        country: metadata.countryCode ?? 'UNKNOWN',
        adminLevel,
        url: metadata.url,
        timeoutMs: context.options.timeoutMs ?? 0,
        retryDelay: context.options.retryDelay ?? 0,
        retryAttempts: context.options.retryAttempts ?? 0,
        expectedFormat: 'geojson',
        validateSSL: true,
      },
    }));
  }

  async postprocessDownloadOutputs(
    context: DownloadStagePostprocessContext,
  ): Promise<DownloadStagePostprocessResult> {
    const db = getEphemeralShapeDB();
    const outputs: DownloadStageOutput[] = [];
    const selectedCountries = this.collectSelectedCountries(context.urlMetadata);
    const countryMetadata = await metadataLoader.getCountriesMetadata('naturalearth', selectedCountries);
    const lookup = this.buildCountryLookup(countryMetadata);

    for (const task of context.downloadTasks) {
      const inputBufferId = `${context.sessionId}-download-${task.index ?? 0}`;
      const raw = await db.rawBuffers.get(inputBufferId);
      if (!raw) continue;

      const geojson = await decodeFlatGeoJson(raw.data);
      const buckets = this.partitionFeaturesByCountry(geojson, lookup);
      const adminLevel = task.config?.adminLevel ?? 0;
      const sourceUrl = task.config?.url;

      for (const [countryCode, features] of buckets.entries()) {
        if (!features.length) continue;
        const country = lookup.get(countryCode.toUpperCase());
        const countryName = country?.countryName;
        const collection: FeatureCollection = { type: 'FeatureCollection', features };
        const data = await encodeFlatGeoJson(collection);
        const bounds = turfBbox(collection);
        const outputBufferId = this.buildOutputBufferId(context.sessionId, countryCode, adminLevel);
        await db.rawBuffers.put({
          id: outputBufferId,
          sessionId: String(context.sessionId),
          nodeId: raw.nodeId,
          data,
          featureCount: features.length,
          bbox: [bounds[0], bounds[1], bounds[2], bounds[3]],
          downloadTime: Date.now(),
          size: data.byteLength,
          timestamp: Date.now(),
        });
        outputs.push({
          inputBufferId: outputBufferId,
          countryCode,
          countryName,
          adminLevel,
          dataSource: 'naturalearth',
          sourceUrl,
        });
      }
    }

    return { outputs };
  }

  private collectSelectedCountries(urlMetadata: UrlMetadata[]): string[] {
    const codes = new Set<string>();
    urlMetadata.forEach((metadata) => {
      if (metadata.countryCode) {
        codes.add(metadata.countryCode);
      }
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

  private buildOutputBufferId(sessionId: string, countryCode: string, adminLevel: number): string {
    const normalizedCountry = countryCode.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `${sessionId}-download-${normalizedCountry}-adm${adminLevel}`;
  }
}
