import type { VtOutputTileStats, VtInputTileStats } from './vtStageTaskOutputHelpers.js';

export type VtTileInputTotals = {
  inputBytes: number;
  featureCount: number;
  polygonCount: number;
  lineStringCount: number;
  vertexCount: number;
};

export type VtTileOutputTotals = {
  featureCount: number;
  polygonCount: number;
  lineStringCount: number;
  vertexCount: number;
};

export type VtEncodeStats = {
  tileCount: number;
  bytes: number;
  duration: number;
};

export type VtStoreStats = {
  tileCount: number;
  bytes: number;
  duration: number;
};

export type VtTileOutputAggregates = {
  totalInputStats: VtTileInputTotals;
  totalOutputStats: VtTileOutputTotals;
  encodeStats: VtEncodeStats;
  storeStats: VtStoreStats;
};

export const createVtOutputTotals = (): VtTileOutputAggregates => ({
  totalInputStats: {
    inputBytes: 0,
    featureCount: 0,
    polygonCount: 0,
    lineStringCount: 0,
    vertexCount: 0,
  },
  totalOutputStats: {
    featureCount: 0,
    polygonCount: 0,
    lineStringCount: 0,
    vertexCount: 0,
  },
  encodeStats: {
    tileCount: 0,
    bytes: 0,
    duration: 0,
  },
  storeStats: {
    tileCount: 0,
    bytes: 0,
    duration: 0,
  },
});

export const recordInputTileStats = (
  aggregate: VtTileOutputAggregates,
  inputStats: VtInputTileStats,
): void => {
  aggregate.totalInputStats.inputBytes += inputStats.inputBytes;
  aggregate.totalInputStats.featureCount += inputStats.featureCount;
  aggregate.totalInputStats.polygonCount += inputStats.polygonCount;
  aggregate.totalInputStats.lineStringCount += inputStats.lineStringCount;
  aggregate.totalInputStats.vertexCount += inputStats.vertexCount;
};

export const recordOutputTileStats = (
  aggregate: VtTileOutputAggregates,
  outputStats: VtOutputTileStats,
): void => {
  aggregate.totalOutputStats.featureCount += outputStats.featureCount;
  aggregate.totalOutputStats.polygonCount += outputStats.polygonCount;
  aggregate.totalOutputStats.lineStringCount += outputStats.lineStringCount;
  aggregate.totalOutputStats.vertexCount += outputStats.vertexCount;
};

export const recordEncodeStats = (
  aggregate: VtTileOutputAggregates,
  tileCount: number,
  bytes: number,
  duration: number,
): void => {
  aggregate.encodeStats.tileCount += tileCount;
  aggregate.encodeStats.bytes += bytes;
  aggregate.encodeStats.duration += duration;
};

export const recordStoreStats = (
  aggregate: VtTileOutputAggregates,
  tileCount: number,
  bytes: number,
  duration: number,
): void => {
  aggregate.storeStats.tileCount += tileCount;
  aggregate.storeStats.bytes += bytes;
  aggregate.storeStats.duration += duration;
};

