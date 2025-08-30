#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

// Find all tsup.config.ts files
const configFiles = glob.sync('**/tsup.config.ts', {
  cwd: '/Users/hiroya/WebstormProjects/hierarchidb',
  ignore: ['node_modules/**', 'dist/**', 'tsup.base.config.ts']
});

console.log(`Found ${configFiles.length} tsup config files to update`);

// Standard base config template
const baseConfigTemplate = `import { createTsupConfig } from '../../../tsup.base.config';

export default createTsupConfig();
`;

// Config with dexie external
const dexieConfigTemplate = `import { createTsupConfig } from '../../../tsup.base.config';

export default createTsupConfig({
  external: [
    'react',
    'react-dom',
    '@mui/material',
    '@mui/icons-material',
    '@emotion/react',
    '@emotion/styled',
    'dexie',
  ],
});
`;

// Packages that need dexie external
const dexiePackages = [
  'packages/runtime/worker',
  'packages/node-type-plugin/shape-plugin',
  'packages/node-type-plugin/basemap',
  'packages/node-type-plugin/spreadsheet-plugin',
  'packages/node-type-plugin/stylemap-plugin',
];

configFiles.forEach(configFile => {
  const fullPath = path.join('/Users/hiroya/WebstormProjects/hierarchidb', configFile);
  
  console.log(`Updating: ${configFile}`);
  
  // Check if this package needs dexie
  const needsDexie = dexiePackages.some(pkg => configFile.includes(pkg));
  
  // Write the appropriate template
  const template = needsDexie ? dexieConfigTemplate : baseConfigTemplate;
  
  try {
    fs.writeFileSync(fullPath, template, 'utf8');
    console.log(`✓ Updated: ${configFile}`);
  } catch (error) {
    console.error(`✗ Failed to update ${configFile}:`, error.message);
  }
});

console.log(`\nCompleted updating ${configFiles.length} tsup config files`);