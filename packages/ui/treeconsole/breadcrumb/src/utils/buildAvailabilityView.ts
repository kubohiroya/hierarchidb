import type { BuildAvailability, BuildAvailabilityDetail } from '@hierarchidb/build-api';

export type BuildAvailabilityView = {
  summary: string;
  tooltip: string;
  diagnosticsLabel?: string;
};

const statusSummary: Record<BuildAvailability['status'], string> = {
  'not-buildable': 'Build unavailable',
  'build-not-required': 'Build not required',
  'build-required': 'Build ready',
  'build-blocked-by-active-session': 'Build blocked',
};

const reasonSummary: Record<BuildAvailability['reason'], string> = {
  'no-build-candidate': 'No build target',
  'no-build-required-target': 'Up to date',
  'build-required-target': 'Build required',
  'active-build-session': 'Build already running',
  'stale-artifact': 'Stale artifact',
  'dependency-rebuilding': 'Dependency rebuild running',
  'plugin-prerequisite-failed': 'Plugin prerequisite failed',
  'dependency-error': 'Dependency error',
  'orphaned-dependency-edge': 'Orphaned dependency',
  'schema-error': 'Schema error',
  'unsupported-plugin-participant': 'Unsupported participant',
};

const shouldExposeDiagnostics = (detail: BuildAvailabilityDetail): boolean =>
  detail.severity === 'error' ||
  detail.kind === 'orphaned-dependency-edge' ||
  detail.kind === 'dependency-error' ||
  detail.kind === 'schema-error' ||
  detail.kind === 'unsupported-plugin-participant' ||
  detail.kind === 'plugin-prerequisite-failed';

const detailMessage = (detail: BuildAvailabilityDetail): string => {
  const target = detail.nodeId ?? detail.targetNodeId;
  const suffix = target ? ` (${target})` : '';
  return `${detail.message}${suffix}`;
};

export const formatBuildAvailabilityView = (
  availability: BuildAvailability | null | undefined
): BuildAvailabilityView | undefined => {
  if (availability === null || availability === undefined) return undefined;

  const summary = reasonSummary[availability.reason] ?? statusSummary[availability.status];
  const detailLines = availability.details.map(detailMessage);
  const tooltip =
    detailLines.length > 0
      ? [statusSummary[availability.status], ...detailLines].join('\n')
      : statusSummary[availability.status];
  const diagnosticsLabel = availability.details.some(shouldExposeDiagnostics)
    ? 'Build diagnostics'
    : undefined;

  return {
    summary,
    tooltip,
    diagnosticsLabel,
  };
};
