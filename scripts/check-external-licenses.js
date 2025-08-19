#!/usr/bin/env node

/**
 * Check licenses of external dependencies only (excluding @hierarchidb/* packages)
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

async function checkExternalLicenses() {
  try {
    // Run license-checker and get JSON output
    const { stdout } = await execAsync('npx license-checker --json', {
      cwd: join(rootDir, 'packages/app'),
    });

    const licenses = JSON.parse(stdout);

    // Filter out internal packages
    const externalLicenses = {};
    const internalPackages = [];

    for (const [pkg, info] of Object.entries(licenses)) {
      if (pkg.startsWith('@hierarchidb/')) {
        internalPackages.push(pkg);
      } else {
        externalLicenses[pkg] = info;
      }
    }

    // Generate summary
    const summary = {};
    for (const [pkg, info] of Object.entries(externalLicenses)) {
      const license = info.licenses || 'UNKNOWN';
      summary[license] = (summary[license] || 0) + 1;
    }

    // Create report
    const report = {
      timestamp: new Date().toISOString(),
      internalPackagesCount: internalPackages.length,
      externalPackagesCount: Object.keys(externalLicenses).length,
      licenseSummary: summary,
      internalPackages: internalPackages.sort(),
      externalLicenses: externalLicenses,
    };

    // Write main licenses.json (external dependencies only)
    await writeFile(join(rootDir, 'docs/licenses.json'), JSON.stringify(externalLicenses, null, 2));

    // Write detailed report with internal packages info
    await writeFile(
      join(rootDir, 'docs/licenses-full-report.json'),
      JSON.stringify(report, null, 2)
    );

    // Create summary text
    let summaryText = `License Summary
Generated: ${report.timestamp}

Internal Packages (@hierarchidb/*): ${report.internalPackagesCount} (all MIT licensed)
External Dependencies: ${report.externalPackagesCount}

External License Distribution:
`;

    for (const [license, count] of Object.entries(summary).sort((a, b) => b[1] - a[1])) {
      summaryText += `  ${license}: ${count}\n`;
    }

    await writeFile(join(rootDir, 'docs/licenses-summary.txt'), summaryText);

    // Create CSV report for external licenses
    let csvContent = 'Package,Version,License,Repository,Publisher,Email\n';
    for (const [pkg, info] of Object.entries(externalLicenses)) {
      const [name, version] =
        pkg.lastIndexOf('@') > 0
          ? [pkg.substring(0, pkg.lastIndexOf('@')), pkg.substring(pkg.lastIndexOf('@') + 1)]
          : [pkg, ''];
      csvContent += `"${name}","${version}","${info.licenses || ''}","${info.repository || ''}","${info.publisher || ''}","${info.email || ''}"\n`;
    }

    await writeFile(join(rootDir, 'docs/licenses.csv'), csvContent);

    console.log('✅ External license check complete!');
    console.log(summaryText);

    // Check for problematic licenses
    const problematicLicenses = ['GPL', 'AGPL', 'LGPL', 'UNKNOWN'];
    const found = Object.keys(summary).filter((license) =>
      problematicLicenses.some((prob) => license.includes(prob))
    );

    if (found.length > 0) {
      console.log('\n⚠️  Warning: Found potentially problematic licenses:', found.join(', '));
    }
  } catch (error) {
    console.error('❌ Error checking licenses:', error);
    process.exit(1);
  }
}

checkExternalLicenses();
