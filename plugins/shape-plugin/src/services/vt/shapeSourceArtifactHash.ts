import { NobleSha3HashPort } from '@hierarchidb/chunk-store';
import type { EphemeralFetchCacheRecord, EphemeralDB } from '@hierarchidb/gis-sdk';

const FETCH_ARTIFACT_HASH_ALGORITHM = 'sha3-256' as const;
const sourceArtifactHasher = new NobleSha3HashPort();

export const hashSourceArtifact = (data: ArrayBuffer): string => (
  sourceArtifactHasher.digest(data, FETCH_ARTIFACT_HASH_ALGORITHM)
);

export const resolveSourceArtifactHashFromRecord = async (
  sourceCacheStore: Pick<EphemeralDB['sourceCache'], 'update'>,
  record: Pick<EphemeralFetchCacheRecord, 'id' | 'data' | 'contentHash'>,
): Promise<string> => {
  const contentHash = typeof record.contentHash === 'string' && record.contentHash.length > 0
    ? record.contentHash
    : hashSourceArtifact(record.data);
  if (record.contentHash !== contentHash) {
    await sourceCacheStore.update(record.id, { contentHash });
  }
  return contentHash;
};

export const resolveSourceArtifactHashById = async (
  ephemeralStore: EphemeralDB,
  sourceCacheId: string,
): Promise<string | null> => {
  const record = await ephemeralStore.sourceCache.get(sourceCacheId);
  if (!record) {
    return null;
  }
  return resolveSourceArtifactHashFromRecord(ephemeralStore.sourceCache, record);
};
