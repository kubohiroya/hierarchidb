let corsProxyBaseURL: string | undefined;

export const setCorsProxyBaseURL = (value?: string): void => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  corsProxyBaseURL = normalized.length > 0 ? normalized : undefined;
};

export const getCorsProxyBaseURL = (): string | undefined => corsProxyBaseURL;
