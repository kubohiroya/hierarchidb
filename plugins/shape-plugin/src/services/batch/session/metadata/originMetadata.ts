import type { DataSourceName } from '../../../../common/types/index.js';
import type { DownloadStageOutput } from '../../strategies/DownloadStageStrategy.js';
import type { OriginMetadata } from '../SessionTypes.js';

export type OriginMetadataIndex = {
  entries: OriginMetadata[];
  byKey: Map<string, OriginMetadata>;
  byBuffer: Map<string, OriginMetadata>;
};

export function buildOriginMetadata(params: {
  output: DownloadStageOutput;
  resolveDataSource: () => DataSourceName;
}): OriginMetadata {
  const { output, resolveDataSource } = params;

  const dataSource = output.dataSource ?? resolveDataSource();
  const countryCode = output.countryCode?.trim().toUpperCase();
  const adminLevel = output.adminLevel;
  const groupId = output.featureGroupId ?? output.featureLabel ?? output.inputBufferId;
  const levelLabel = adminLevel != null ? `ADM${adminLevel}` : undefined;
  const originLabel = output.featureLabel
    ?? output.featureGroupId
    ?? [output.countryName ?? countryCode ?? 'Unknown', levelLabel].filter(Boolean).join(' ');

  const originKeyParts = [
    dataSource ?? 'unknown',
    countryCode ?? 'unknown',
    levelLabel ?? 'ADM?',
    groupId,
  ];

  return {
    originKey: originKeyParts.join('|'),
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
  outputs: DownloadStageOutput[];
  resolveDataSource: () => DataSourceName;
}): OriginMetadataIndex {
  const { outputs, resolveDataSource } = params;
  const entries = outputs.map((output) => buildOriginMetadata({ output, resolveDataSource }));
  const byKey = new Map(entries.map((entry) => [entry.originKey, entry] as const));
  const byBuffer = new Map(entries.map((entry) => [entry.inputBufferId, entry] as const));
  return { entries, byKey, byBuffer };
}

