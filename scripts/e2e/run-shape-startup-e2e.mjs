import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const DEFAULT_AUTH_SEED_FILE = 'e2e/.auth/auth.json';
const PLAYWRIGHT_TARGET = 'e2e/shape/shape-build-startup-first-task.spec.ts';

const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');
const decodeBase64Utf8 = (value) => Buffer.from(value, 'base64').toString('utf8').trim();

const resolveAuthSeed = (seedFilePath) => {
  if (!existsSync(seedFilePath)) {
    return null;
  }
  const raw = readFileSync(seedFilePath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Invalid auth seed JSON: ${seedFilePath}`);
  }
  const accessTokenFromRaw = normalizeString(parsed.accessToken);
  const accessTokenFromB64 = normalizeString(parsed.accessTokenB64);
  const accessToken = accessTokenFromRaw || (accessTokenFromB64 ? decodeBase64Utf8(accessTokenFromB64) : '');
  if (!accessToken) {
    throw new Error(`auth seed file must include non-empty "accessToken" or "accessTokenB64": ${seedFilePath}`);
  }
  const idToken = normalizeString(parsed.idToken);
  const userinfoRawFromJson = (() => {
    if (typeof parsed.userinfo === 'string') return parsed.userinfo;
    if (parsed.userinfo && typeof parsed.userinfo === 'object' && !Array.isArray(parsed.userinfo)) {
      return JSON.stringify(parsed.userinfo);
    }
    return '';
  })();
  const userinfoB64 = normalizeString(parsed.userinfoB64);
  const userinfoRaw = userinfoRawFromJson || (userinfoB64 ? decodeBase64Utf8(userinfoB64) : '');
  const tokenExpiresAt = Number.isFinite(Number(parsed.tokenExpiresAt))
    ? String(Number(parsed.tokenExpiresAt))
    : '';

  return {
    accessToken,
    idToken,
    userinfoRaw,
    userinfoB64: userinfoB64 || '',
    tokenExpiresAt,
  };
};

const loadAuthSeedFromEnvOrFile = () => {
  const envToken = normalizeString(process.env.E2E_AUTH_ACCESS_TOKEN);
  if (envToken) {
    return {
      accessToken: envToken,
      idToken: normalizeString(process.env.E2E_AUTH_ID_TOKEN),
      userinfoRaw: normalizeString(process.env.E2E_AUTH_USERINFO),
      userinfoB64: normalizeString(process.env.E2E_AUTH_USERINFO_B64),
      tokenExpiresAt: normalizeString(process.env.E2E_AUTH_TOKEN_EXPIRES_AT),
      source: 'env',
    };
  }

  const seedFile = normalizeString(process.env.E2E_AUTH_SEED_FILE) || DEFAULT_AUTH_SEED_FILE;
  const seedFilePath = resolve(process.cwd(), seedFile);
  const loaded = resolveAuthSeed(seedFilePath);
  if (!loaded) {
    throw new Error(
      `Missing E2E auth seed. Set E2E_AUTH_ACCESS_TOKEN or create ${seedFilePath}`
    );
  }
  return { ...loaded, source: seedFilePath };
};

const main = () => {
  const forwardedArgs = process.argv.slice(2);
  const authSeed = loadAuthSeedFromEnvOrFile();
  const env = { ...process.env };
  env.HIERARCHIDB_E2E = env.HIERARCHIDB_E2E || '1';
  env.PLAYWRIGHT_SKIP_WEBSERVER = env.PLAYWRIGHT_SKIP_WEBSERVER || '1';
  env.E2E_AUTH_ACCESS_TOKEN = authSeed.accessToken;
  if (authSeed.idToken) env.E2E_AUTH_ID_TOKEN = authSeed.idToken;
  if (authSeed.userinfoRaw) env.E2E_AUTH_USERINFO = authSeed.userinfoRaw;
  if (authSeed.userinfoB64) env.E2E_AUTH_USERINFO_B64 = authSeed.userinfoB64;
  if (authSeed.tokenExpiresAt) env.E2E_AUTH_TOKEN_EXPIRES_AT = authSeed.tokenExpiresAt;

  console.log(`[e2e:shape-startup] auth seed source: ${authSeed.source}`);

  const args = [
    'exec',
    'playwright',
    'test',
    PLAYWRIGHT_TARGET,
    '--project=chromium',
    ...forwardedArgs,
  ];
  const result = spawnSync('pnpm', args, {
    stdio: 'inherit',
    env,
  });
  process.exit(result.status ?? 1);
};

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[e2e:shape-startup] ${message}`);
  process.exit(1);
}
