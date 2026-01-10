import type { NodeId } from '@hierarchidb/common-types';

export type DomainType = 'shape';

export type Stage1Buffer = {
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

export type TransformBuffer = {
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

export type TileIndexRow = {
  nodeId: NodeId;
  bandId: number;
  zBase: number;
  tileId: number;
  bufferId: string;
};

export type Band3Reservation = {
  nodeId: NodeId;
  tileId: number;
  createdAt: number;
};

export type Stage1BufferPayload = Omit<Stage1Buffer, 'id' | 'nodeId' | 'domainType' | 'timestamp'> & {
  timestamp?: number;
};

export type TransformBufferPayload = Omit<TransformBuffer, 'id' | 'nodeId' | 'domainType' | 'bandId' | 'timestamp'> & {
  timestamp?: number;
};
