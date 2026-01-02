import type { DataSourceName } from '../../../../common/types/index.js';
import type { DownloadStageOutput } from '../../strategies/DownloadStageStrategy.js';
import type { OriginMetadata } from '../SessionTypes.js';

export type OriginMetadataIndex = {
  entries: OriginMetadata[];
  byKey: Map<string, OriginMetadata>;
  byBuffer: Map<string, OriginMetadata>;
};

export type OriginKeyPartsInput = {
  dataSource: DataSourceName;
  countryCode?: string;
  adminLevel?: number;
  groupId?: string;
};

export function buildOriginKeyParts(input: OriginKeyPartsInput): string[] {
  const countryCode = input.countryCode?.trim().toUpperCase();
  const levelLabel = input.adminLevel != null ? `ADM${input.adminLevel}` : 'ADM?';
  const groupId = input.groupId;
  return [input.dataSource, countryCode ?? 'unknown', levelLabel, groupId ?? 'unknown'];
}

export function buildOriginKey(input: OriginKeyPartsInput): string {
  return buildOriginKeyParts(input).join('|');
}

export function buildOriginLabel(params: {
  countryName?: string;
  countryCode?: string;
  adminLevel?: number;
  featureLabel?: string;
  featureGroupId?: string;
}): string {
  const countryCode = params.countryCode?.trim().toUpperCase();
  const levelLabel = params.adminLevel != null ? `ADM${params.adminLevel}` : undefined;
  return (
    params.featureLabel
    ?? params.featureGroupId
    ?? [params.countryName ?? countryCode ?? 'Unknown', levelLabel].filter(Boolean).join(' ')
  );
}

export function buildOriginMetadata(params: {
  output: DownloadStageOutput;
  resolveDataSource: () => DataSourceName;
}): OriginMetadata {
  const { output, resolveDataSource } = params;

  const dataSource = output.dataSource ?? resolveDataSource();
  const countryCode = output.countryCode?.trim().toUpperCase();
  const adminLevel = output.adminLevel;
  const groupId = output.featureGroupId ?? output.featureLabel ?? output.inputBufferId;

  const originLabel = buildOriginLabel({
    countryName: output.countryName,
    countryCode,
    adminLevel,
    featureLabel: output.featureLabel,
    featureGroupId: output.featureGroupId,
  });

  return {
    originKey: buildOriginKey({
      dataSource,
      countryCode,
      adminLevel,
      groupId,
    }),
    originLabel,
    inputBufferId: output.inputBufferId,
    dataSource,
    sourceUrl: output.sourceUrl,
    countryName: output.countryName,
    countryCode,
    continent: output.continent,
    adminLevel,
    featureGroupId: output.featureGroupId,
    featureLabel: output.featureLabel,
    featureIndex: output.featureIndex,
    featureCount: output.featureCount,
  };
}

export function indexOriginMetadata(params: {
  nodeId?: unknown; // kept for backward compatibility; unused
  outputs: DownloadStageOutput[];
  resolveDataSource: () => DataSourceName;
}): OriginMetadataIndex {
  const { outputs, resolveDataSource } = params;
  const entries = outputs.map((output) => buildOriginMetadata({ output, resolveDataSource }));
  const byKey = new Map(entries.map((entry) => [entry.originKey, entry] as const));
  const byBuffer = new Map(entries.map((entry) => [entry.inputBufferId, entry] as const));
  return { entries, byKey, byBuffer };
}
