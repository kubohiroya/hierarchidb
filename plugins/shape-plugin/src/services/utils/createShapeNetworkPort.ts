import {
  FetchNetworkPort,
  type FetchNetworkPortOptions,
  getCorsProxyBaseURL,
} from '@hierarchidb/download';

let sharedNet: FetchNetworkPort | null = null;
let sharedNetCorsProxyBaseURL: string | undefined;

// Auth is handled inside FetchNetworkPort via @hierarchidb/download smartFetch → AuthService.
export const createShapeNetworkPort = (options: FetchNetworkPortOptions = {}): FetchNetworkPort => {
  const corsProxyBaseURL = getCorsProxyBaseURL() || undefined;
  return new FetchNetworkPort({
    perHostConcurrency: 4,
    corsProxyBaseURL,
    auth: { scope: 'shape' },
    ...options,
  });
};

export const getShapeNetworkPort = (): FetchNetworkPort => {
  const corsProxyBaseURL = getCorsProxyBaseURL() || undefined;
  if (sharedNet && sharedNetCorsProxyBaseURL === corsProxyBaseURL) return sharedNet;
  sharedNet = createShapeNetworkPort();
  sharedNetCorsProxyBaseURL = corsProxyBaseURL;
  return sharedNet;
};
