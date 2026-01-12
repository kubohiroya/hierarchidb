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

export type TransformByBandCacheRecord = {
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

export type TransformByZoomCacheRecord = {
  nodeId: NodeId;
  bandId: number;
  zBase: number;
  tileId: number;
  bufferId: string;
};

export type TransformByZoomReservation = {
  nodeId: NodeId;
  tileId: number;
  createdAt: number;
};

export type FetchCachePayload = Omit<FetchCacheRecord, 'id' | 'nodeId' | 'domainType' | 'timestamp'> & {
  timestamp?: number;
};

export type TransformByBandCachePayload = Omit<TransformByBandCacheRecord, 'id' | 'nodeId' | 'domainType' | 'bandId' | 'timestamp'> & {
  timestamp?: number;
};
