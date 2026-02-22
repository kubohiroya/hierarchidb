import type { TaskDisplayPayload } from '../../../../../packages/build-api';

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

export const isTaskPhaseDisplay = (display?: TaskDisplayPayload): boolean => (
  display?.kind === 'phase'
);

export const isTaskPhaseMessage = (message?: string | null): boolean => {
  if (!message) return false;
  const normalized = message.trim().toLowerCase();
  if (!normalized) return false;
  const withoutPrefix = normalized.startsWith('phase=') ? normalized.slice('phase='.length) : normalized;
  return /^[a-z0-9]+(?:[._-][a-z0-9]+)*(?::[a-z0-9]+(?:[._-][a-z0-9]+)*)+$/.test(withoutPrefix);
};
