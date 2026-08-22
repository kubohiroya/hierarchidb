import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'path';
import process from 'process';

type PackageInfo = Record<string, unknown>;

interface LicenseInfo {
  path?: string;
  licenses?: string | string[];
  [key: string]: unknown;
}

async function main() {
  const executionCwd = process.cwd();
  const initCwdRaw = process.env.INIT_CWD;
  const initCwd =
    typeof initCwdRaw === 'string' && initCwdRaw.length > 0 ? path.resolve(initCwdRaw) : undefined;
  const cliStartArgIndex = process.argv.indexOf('--start');
  const cliStartArg = cliStartArgIndex >= 0 ? process.argv[cliStartArgIndex + 1] : undefined;
  const start = cliStartArg ? path.resolve(cliStartArg) : (initCwd ?? executionCwd);

  const require = createRequire(import.meta.url);
  const checkerBin = require.resolve('license-checker/bin/license-checker');
  const args = [checkerBin, '--production', '--json', '--direct', '--start', start];

  const packages: Record<string, PackageInfo> = (await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: executionCwd,
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    let stdout = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`[licenses] license-checker exited with code ${code}`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout) as Record<string, PackageInfo>;
        resolve(parsed);
      } catch (error) {
        reject(error);
      }
    });
  }).catch((error) => {
    console.error(
      '[licenses] Failed to analyze dependencies:',
      error instanceof Error ? error.message : String(error)
    );
    process.exit(3);
  })) as Record<string, PackageInfo>;

  // Normalize entries: convert string values into objects
  const normalizedEntries = Object.entries(packages).map(([key, value]) => {
    if (typeof value === 'string') {
      return [key, { version: value } as PackageInfo] as const;
    }
    return [key, value] as const;
  });

  const entries = normalizedEntries.filter(([_name, info]) => {
    const candidate = info as LicenseInfo;
    const p = candidate.path;
    return !p || !p.includes(path.sep + 'packages' + path.sep);
  });

  let missing = 0;
  for (const [pkgKey, info] of entries) {
    const candidate = info as LicenseInfo;
    const licenses = candidate.licenses;
    const primary = Array.isArray(licenses) ? licenses.join(', ') : licenses;
    if (!primary || primary === 'UNLICENSED' || primary === 'UNKNOWN') {
      missing++;
      console.warn(`[licenses] Missing/unknown license: ${pkgKey}`);
    }
  }

  console.log(`[licenses] Scanned ${entries.length} third-party packages.`);
  if (missing > 0) {
    console.warn(`[licenses] ${missing} package(s) missing/unknown license.`);
  }
}

main().catch((e) => {
  console.error('[licenses] Unexpected error:', e);
  process.exit(3);
});
