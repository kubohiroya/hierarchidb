export type CorsProxyStartupContext = 'app' | 'worker';

export const resolveRequiredCorsProxyBaseURL = (
  value: unknown,
  context: CorsProxyStartupContext
): string => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    throw new Error(`VITE_CORS_PROXY_BASE_URL is required for ${context} startup.`);
  }
  return normalized;
};
