import type { TaskDisplayPayload } from '@hierarchidb/build-api';

type MetadataRecord = Record<string, unknown> | undefined;

const readMetadataValueByPath = (metadata: MetadataRecord, path: string): unknown => {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const segments = path.split('.');
  let current: unknown = metadata;
  for (const segment of segments) {
    if (!current || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
};

const readMetadataMessage = (metadata: MetadataRecord, paths: string[]): string | null => {
  for (const path of paths) {
    const rawValue = readMetadataValueByPath(metadata, path);
    if (typeof rawValue !== 'string') continue;
    const trimmed = rawValue.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return null;
};

export const resolveTaskMetadataMessage = (metadata: MetadataRecord): string | null =>
  readMetadataMessage(metadata, [
    'message',
    'statusMessage',
    'errorMessage',
    'detail.message',
    'result.message',
    'summary.message',
    'completionMessage',
  ]);

export const isSkippedMessage = (message?: string | null): boolean => {
  if (!message) return false;
  const normalized = message.trim().toLowerCase();
  if (normalized === 'skipped') return true;
  return normalized.includes('skipped:');
};

export const isTaskSkipped = (display?: TaskDisplayPayload, message?: string | null): boolean => {
  if (display?.kind === 'skip') return true;
  return isSkippedMessage(message);
};

export const isTaskPhaseDisplay = (display?: TaskDisplayPayload): boolean =>
  display?.kind === 'phase';

export const isTaskPhaseMessage = (message?: string | null): boolean => {
  if (!message) return false;
  const normalized = message.trim().toLowerCase();
  if (!normalized) return false;
  const withoutPrefix = normalized.startsWith('phase=')
    ? normalized.slice('phase='.length)
    : normalized;
  return /^[a-z0-9]+(?:[._-][a-z0-9]+)*(?::[a-z0-9]+(?:[._-][a-z0-9]+)*)+$/.test(withoutPrefix);
};
