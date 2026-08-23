import type { NodeId } from '@hierarchidb/core-types';

export interface LocationSourceArtifactRecord {
  nodeId: NodeId;
  inputHash: string;
  contentHash: string;
  pointCount: number;
  selectionSignature: string;
  sourceKind: 'network';
  dataSource: string;
  parserVersion: string;
  authScope: 'location';
  requestTargets: readonly string[];
  completedAt: number;
}

export const validateLocationSourceArtifactRecord = (
  record: LocationSourceArtifactRecord
): void => {
  if (typeof record.inputHash !== 'string' || !/^locsrc:[0-9a-f]{16}$/u.test(record.inputHash)) {
    throw new Error('location-source-artifact-input-hash-invalid');
  }
  if (
    typeof record.contentHash !== 'string' ||
    !/^locpoints:[0-9a-f]{16}$/u.test(record.contentHash)
  ) {
    throw new Error('location-source-artifact-content-hash-invalid');
  }
  if (!Number.isInteger(record.pointCount) || record.pointCount < 0) {
    throw new Error('location-source-artifact-point-count-invalid');
  }
  if (record.sourceKind !== 'network') {
    throw new Error('location-source-artifact-source-kind-invalid');
  }
  if (record.authScope !== 'location') {
    throw new Error('location-source-artifact-auth-scope-invalid');
  }
  if (typeof record.parserVersion !== 'string' || record.parserVersion.length === 0) {
    throw new Error('location-source-artifact-parser-version-invalid');
  }
  if (!Array.isArray(record.requestTargets) || record.requestTargets.length === 0) {
    throw new Error('location-source-artifact-request-targets-invalid');
  }
  if (!Number.isFinite(record.completedAt) || record.completedAt < 0) {
    throw new Error('location-source-artifact-completed-at-invalid');
  }
};
