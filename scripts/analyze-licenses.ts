#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Script to analyze and generate license information for all dependencies
 * Run with: npm run analyze:licenses
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const INTERNAL_PREFIX = '@hierarchidb/';

type LicenseField = string | string[] | undefined;

interface LicenseCheckerRaw {
  licenses?: string | string[];
  repository?: string;
  publisher?: string;
  email?: string;
  url?: string;
  }

interface FilteredEntry {
  licenses?: string | string[];
  repository?: string;
  publisher?: string;
  email?: string;
  url?: string;
}

function normalizeLicense(lic: LicenseField): string {
  if (Array.isArray(lic)) return lic.join(' | ');
  if (typeof lic === 'string' && lic.trim().length > 0) return lic;
  return 'UNKNOWN';
}

console.log('🔍 Analyzing project dependencies for license information...\n');

try {
  //  license-checker
  const output = execSync('npx license-checker --json --excludePrivatePackages', {
    encoding: 'utf-8',
    maxBuffer: 1024 * 1024 * 10, // 10MB buffer
  });

  const licenseData = JSON.parse(output) as Record<string, LicenseCheckerRaw>;

    const filteredData: Record<string, FilteredEntry> = {};
  for (const [packageName, info] of Object.entries(licenseData)) {
    if (!packageName.startsWith(INTERNAL_PREFIX)) {
      filteredData[packageName] = {
        licenses: info.licenses,
        repository: info.repository,
        publisher: info.publisher,
        email: info.email,
        url: info.url,
      };
    }
  }

    const outputPath = path.join(process.cwd(), 'app', 'public', 'licenses.json');

    const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(filteredData, null, 2));

    const licenseCounts: Record<string, number> = {};
  for (const info of Object.values(filteredData)) {
    const key = normalizeLicense(info.licenses);
    licenseCounts[key] = (licenseCounts[key] || 0) + 1;
  }

  console.log('📊 License Summary:');
  console.log('==========================================');

  const sortedLicenses = Object.entries(licenseCounts).sort(([, a], [, b]) => b - a);
  for (const [license, count] of sortedLicenses) {
    console.log(`  ${license}: ${count} packages`);
  }

  console.log('==========================================');
  console.log(`\n✅ License information saved to: ${outputPath}`);
  console.log(`📦 Total packages analyzed: ${Object.keys(filteredData).length}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('❌ Error analyzing licenses:', message);
  console.error('\nMake sure license-checker is available (local or global):');
  console.error('  npm i -D license-checker   # dev dependency');
  console.error('  # or');
  console.error('  npm i -g license-checker   # global');
  process.exit(1);
}
