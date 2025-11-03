export interface CORSOptions {
  allowedOrigins: string[];
  allowedMethods?: string[];
  allowedHeaders?: string[];
  allowCredentials?: boolean;
}

export function getCORSHeaders(
  requestOrigin: string | undefined,
  options: CORSOptions
): Record<string, string> {
  const {
    allowedOrigins,
    allowedMethods = ['GET', 'POST', 'OPTIONS'],
    allowedHeaders = ['Content-Type', 'Authorization'],
    allowCredentials = true,
  } = options;

  let allowOrigin = '*';
  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    allowOrigin = requestOrigin;
  } else if (allowedOrigins.includes('*')) {
    allowOrigin = '*';
  }

  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': allowedMethods.join(', '),
    'Access-Control-Allow-Headers': allowedHeaders.join(', '),
    Vary: 'Origin',
  };

  if (allowCredentials && allowOrigin !== '*') {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

export function parseAllowedOrigins(originsString: string): string[] {
  return originsString
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
