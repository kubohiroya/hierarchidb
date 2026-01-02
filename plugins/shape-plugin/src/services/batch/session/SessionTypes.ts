import type { DataSourceName } from '../../../common/types/index.js';

export type WorkerPoolStatistics = Record<string, number>;

export type GeometryStatsSummary = {
  vertexCount: number;
  polygonCount: number;
  bbox?: [number, number, number, number];
};

export type OriginMetadata = {
  originKey: string;
  originLabel: string;
  inputBufferId: string;
  dataSource: DataSourceName;
  sourceUrl?: string;
  countryName?: string;
  countryCode?: string;
  continent?: string;
  adminLevel?: number;
  featureGroupId?: string;
  featureLabel?: string;
  featureIndex?: number;
  featureCount?: number;
};

export interface WorkerPoolHandle {
  shutdown(): Promise<void>;
  getPoolStatistics(): WorkerPoolStatistics;
}
