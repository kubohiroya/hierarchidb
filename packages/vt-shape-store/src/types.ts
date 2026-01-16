import type { NodeId } from '@hierarchidb/common-types';

export type DomainType = 'shape';

export type FetchCacheRecord = {
  id: string;
  nodeId: NodeId;
  domainType: DomainType;
  sourceKey: string;
  countryCode?: string;
  adminLevel?: number;
  data: ArrayBuffer;
  featureCount: number;
  vertexCount: number;
  polygonCount: number;
  timestamp: number;
};

export type TransformCacheRecord = {
  id: string;
  nodeId: NodeId;
  bandId: number;
  domainType: DomainType;
  sourceKey: string;
  countryCode?: string;
  adminLevel?: number;
  data: ArrayBuffer;
  featureCount: number;
  vertexCount: number;
  polygonCount: number;
  timestamp: number;
};

export type FetchCachePayload = Omit<FetchCacheRecord, 'id' | 'nodeId' | 'domainType' | 'timestamp'> & {
  timestamp?: number;
};

export type TransformCachePayload = Omit<TransformCacheRecord, 'id' | 'nodeId' | 'domainType' | 'bandId' | 'timestamp'> & {
  timestamp?: number;
};
