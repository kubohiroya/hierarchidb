import type { NodeId } from '@hierarchidb/common-types';

export function normalizeTaskIdSegment(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return normalized.replace(/^-+|-+$/g, '') || 'unknown';
}

export function buildProcessingTaskId(
  nodeId: NodeId,
  stage: 'extract1' | 'extract2',
  details: {
    countryCode?: string;
    adminLevel?: number;
    featureLabel?: string;
    featureGroupId?: string;
  },
): string {
  const countrySegment = normalizeTaskIdSegment(details.countryCode ?? 'UNK');
  const adminSegment = Number.isFinite(details.adminLevel)
    ? `adm${details.adminLevel}`
    : 'adm-unknown';

  const featureSegments = [details.featureLabel, details.featureGroupId]
    .flatMap((value) => {
      if (typeof value === 'number') return [String(value)];
      if (typeof value === 'string') return [value];
      return [];
    })
    .map((value) => normalizeTaskIdSegment(value))
    .filter(Boolean);

  const featureSegment = Array.from(new Set(featureSegments)).join('-') || 'all';
  return `${String(nodeId)}+${countrySegment}+${adminSegment}+${featureSegment}+${stage}`;
}

export function buildFeatureId(
  base: string,
  index: number,
  countryCode?: string,
  adminLevel?: number,
  adminCode?: string,
): string {
  const baseId = base.trim().length > 0 ? base.trim() : (adminCode ?? `feature-${index}`);
  const prefixParts = [
    countryCode,
    adminLevel != null ? `ADM${adminLevel}` : undefined,
    adminCode,
  ].filter(Boolean);

  const prefix = prefixParts.join('-');
  const composed = prefix ? `${prefix}:${baseId}` : baseId;
  return `${composed}:${index}`;
}
