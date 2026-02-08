export const isSkippedMessage = (message?: string | null): boolean => {
  if (!message) return false;
  const normalized = message.trim().toLowerCase();
  if (normalized === 'skipped') return true;
  return normalized.includes('skipped:');
};
