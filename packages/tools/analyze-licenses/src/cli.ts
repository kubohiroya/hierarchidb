import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);

type LicenseCheckerInit = (
  opts: Record<string, any>,
  cb: (err: Error | null, packages: Record<string, any>) => void,
) => void;

interface LicenseInfo {
  path?: string;
  licenses?: string | string[];
  [key: string]: unknown;
}

async function main() {
  const cwd = process.cwd();
  const start = cwd; // analyze workspace root by default

  // license-checker is CJS; load via createRequire
  let checker: { init: LicenseCheckerInit };
  try {
    checker = require('license-checker');
  } catch (err) {
    console.error('[licenses] Failed to load license-checker. Ensure it is installed.');
    console.error(String(err));
    process.exit(2);
  }

  const opts: Record<string, any> = {
    start,
    production: true,
    json: true,
    direct: true,
    // excludePackages expects a semicolon-separated string; provide none and filter manually
    // excludePackages: '',
  };

  await new Promise<void>((resolve) => {
    checker.init(opts, (err: Error | null, packages: Record<string, any>) => {
      if (err) {
        console.error('[licenses] Analysis failed:', err.message);
        // Do not block the build on analysis failure; exit code 1 will break prebuild.
        // Exit 3 to signal analysis tool error specifically.
        process.exit(3);
      }

      const entries = Object.entries(packages).filter(([_name, info]) => {
        // Ignore workspace paths (node_modules/.pnpm links still have paths)
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

      // Always exit 0 to keep prebuild non-blocking but informative.
      resolve();
    });
  });
}

main().catch((e) => {
  console.error('[licenses] Unexpected error:', e);
  process.exit(3);
});
