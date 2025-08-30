#!/usr/bin/env node

/**
 * Script to analyze and generate license information for all dependencies
 * Run with: npm run analyze:licenses
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Analyzing project dependencies for license information...\n');

try {
  // Run license-checker
  const output = execSync('npx license-checker --json --excludePrivatePackages', {
    encoding: 'utf-8',
    maxBuffer: 1024 * 1024 * 10, // 10MB buffer
  });

  const licenseData = JSON.parse(output);
  
  // Filter out internal packages
  const filteredData = {};
  for (const [packageName, info] of Object.entries(licenseData)) {
    // Skip internal packages
    if (!packageName.startsWith('@hierarchidb/')) {
      filteredData[packageName] = {
        licenses: info.licenses,
        repository: info.repository,
        publisher: info.publisher,
        email: info.email,
        url: info.url,
      };
    }
  }

  // Write to public directory for the app to use
  const outputPath = path.join(process.cwd(), 'app', 'public', 'licenses.json');
  
  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(filteredData, null, 2));

  // Count licenses by type
  const licenseCounts = {};
  for (const info of Object.values(filteredData)) {
    const license = info.licenses || 'UNKNOWN';
    licenseCounts[license] = (licenseCounts[license] || 0) + 1;
  }

  console.log('📊 License Summary:');
  console.log('==========================================');
  
  const sortedLicenses = Object.entries(licenseCounts)
    .sort(([, a], [, b]) => b - a);
  
  for (const [license, count] of sortedLicenses) {
    console.log(`  ${license}: ${count} packages`);
  }
  
  console.log('==========================================');
  console.log(`\n✅ License information saved to: ${outputPath}`);
  console.log(`📦 Total packages analyzed: ${Object.keys(filteredData).length}`);
  
} catch (error) {
  console.error('❌ Error analyzing licenses:', error.message);
  console.error('\nMake sure license-checker is installed:');
  console.error('  npm install -g license-checker');
  process.exit(1);
}