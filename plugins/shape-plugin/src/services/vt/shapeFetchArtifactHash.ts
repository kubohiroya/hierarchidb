import { NobleSha3HashPort } from '@hierarchidb/chunk-store';
import type { EphemeralFetchCacheRecord, EphemeralDB } from '@hierarchidb/gis-sdk';

const FETCH_ARTIFACT_HASH_ALGORITHM = 'sha3-256' as const;
const fetchArtifactHasher = new NobleSha3HashPort();

export const hashFetchArtifact = (data: ArrayBuffer): string => (
  fetchArtifactHasher.digest(data, FETCH_ARTIFACT_HASH_ALGORITHM)
);

export const resolveFetchArtifactHashFromRecord = async (
  fetchCacheStore: Pick<EphemeralDB['fetchCache'], 'update'>,
  record: Pick<EphemeralFetchCacheRecord, 'id' | 'data' | 'contentHash'>,
): Promise<string> => {
  const contentHash = typeof record.contentHash === 'string' && record.contentHash.length > 0
    ? record.contentHash
    : hashFetchArtifact(record.data);
  if (record.contentHash !== contentHash) {
    await fetchCacheStore.update(record.id, { contentHash });
  }
  return contentHash;
};

export const resolveFetchArtifactHashById = async (
  ephemeralStore: EphemeralDB,
  fetchCacheId: string,
): Promise<string | null> => {
  const record = await ephemeralStore.fetchCache.get(fetchCacheId);
  if (!record) {
    return null;
  }
  return resolveFetchArtifactHashFromRecord(ephemeralStore.fetchCache, record);
};
