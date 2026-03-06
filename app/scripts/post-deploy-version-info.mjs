#!/usr/bin/env node

/**
 * Post-deploy version info display script
 * Shows the same version information that appears in browser console
 * to help verify deployment consistency
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
    // Read package.json to get version
    const packageJsonPath = join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    const appVersion = packageJson.version;

    // Get current build time (approximation of when deploy was run)
    const buildTime = new Date().toISOString();
    const localBuildTime = new Date(buildTime).toLocaleString();

    // Display the same format as browser console
    console.log(`[App] Version: ${appVersion} | Build Time (local): ${localBuildTime}`);
    console.log('✅ Deploy completed successfully');
    console.log('🌐 Check browser console for version consistency');

} catch (error) {
    console.error('❌ Failed to display version info:', error.message);
    process.exit(1);
}