#!/usr/bin/env node

const args = process.argv.slice(2);
const config = parseArgs(args);
const token = resolveToken(config);

if (!config.proxy || !token) {
  printUsage();
  process.exit(1);
}

const targetUrl = config.url || 'https://www.geoboundaries.org/api/current/gbOpen/ALL/ALL/';
const origin = config.origin || 'http://localhost:4200';

const proxyUrl = new URL(config.proxy);
proxyUrl.searchParams.set('url', targetUrl);

if (config.preflight === '1') {
  await runPreflight(proxyUrl, origin);
}

try {
  const response = await fetch(proxyUrl.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Origin: origin,
    },
  });

  console.log('[cors-proxy] request', {
    proxyUrl: proxyUrl.toString(),
    targetUrl,
    origin,
    status: response.status,
  });

  const text = await safeReadText(response);
  console.log('[cors-proxy] response headers:', headersToObject(response.headers));
  if (!response.ok) {
    console.error('[cors-proxy] response body:', text.slice(0, 1000));
    process.exit(2);
  }

  console.log('[cors-proxy] success');
  console.log(text.slice(0, 500));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[cors-proxy] fetch failed:', message);
  if (error && typeof error === 'object' && 'cause' in error) {
    console.error('[cors-proxy] fetch cause:', String(error.cause));
  }
  process.exit(3);
}

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const [key, value] = arg.slice(2).split('=');
    if (!key) continue;
    out[key] = value ?? '';
  }
  return out;
}

function resolveToken(config) {
  if (config.token && config.token.length > 0) return config.token;
  if (!config.json || config.json.length === 0) return '';
  try {
    const payload = JSON.parse(config.json);
    const token = payload?.access_token;
    if (typeof token === 'string' && token.length > 0) return token;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[cors-proxy] failed to parse --json:', message);
  }
  return '';
}

function printUsage() {
  console.error('Usage:');
  console.error('  node tests/proxy-smoke.mjs --proxy=https://...workers.dev --token=<TOKEN> --url=https://target --origin=http://localhost:4200');
  console.error('  node tests/proxy-smoke.mjs --proxy=https://...workers.dev --json={"access_token":"..."} --url=https://target --origin=http://localhost:4200');
  console.error('  node tests/proxy-smoke.mjs --proxy=https://...workers.dev --token=<TOKEN> --preflight=1');
}

async function runPreflight(proxyUrl, origin) {
  try {
    const response = await fetch(proxyUrl.toString(), {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization',
      },
    });
    console.log('[cors-proxy] preflight', {
      status: response.status,
      headers: headersToObject(response.headers),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[cors-proxy] preflight failed:', message);
  }
}

async function safeReadText(response) {
  try {
    return await response.text();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[cors-proxy] failed to read response body:', message);
    return '';
  }
}

function headersToObject(headers) {
  const out = {};
  headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}
