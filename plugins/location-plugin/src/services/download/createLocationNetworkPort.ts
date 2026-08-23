import { FetchNetworkPort, getCorsProxyBaseURL } from '@hierarchidb/download';

export type CreateLocationNetworkPortOptions = {
  concurrent: number;
  sessionId: string;
  sessionStartedAt?: number;
};

export const createLocationNetworkPort = ({
  concurrent,
  sessionId,
  sessionStartedAt,
}: CreateLocationNetworkPortOptions): FetchNetworkPort => {
  if (!Number.isInteger(concurrent) || concurrent <= 0) {
    throw new Error(
      `[location network port] concurrent must be a positive integer, received ${String(concurrent)}`
    );
  }
  return new FetchNetworkPort({
    perHostConcurrency: concurrent,
    corsProxyBaseURL: getCorsProxyBaseURL() || undefined,
    auth: {
      scope: 'location',
      sessionId,
      sessionStartedAt,
    },
  });
};
