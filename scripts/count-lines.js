#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const IGNORED_DIRS = ['node_modules', 'dist', 'build', 'coverage', '.turbo', '.next'];
const COUNTED_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.css',
  '.scss',
  '.json',
  '.vue',
  '.svelte',
];

function countLines(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.split('\n').length;
  } catch (error) {
    return 0;
  }
}

function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function shouldCountFile(fileName) {
  return COUNTED_EXTENSIONS.some((ext) => fileName.endsWith(ext));
}

function countDirectory(dirPath, indent = '', showDetails = true) {
  let totalLines = 0;
  const results = [];

  try {
    const items = fs.readdirSync(dirPath);
    const filtered = items.filter((item) => {
      if (item.startsWith('.')) return false;
      if (IGNORED_DIRS.includes(item)) return false;
      return true;
    });

    for (const item of filtered.sort()) {
      const fullPath = path.join(dirPath, item);
      const stats = fs.statSync(fullPath);

      if (stats.isDirectory()) {
        const dirLines = countDirectory(fullPath, indent + '  ', false);
        if (dirLines > 0) {
          results.push({
            name: item + '/',
            lines: dirLines,
            isDir: true,
          });
          totalLines += dirLines;
        }
      } else if (shouldCountFile(item)) {
        const lines = countLines(fullPath);
        results.push({
          name: item,
          lines: lines,
          isDir: false,
        });
        totalLines += lines;
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error.message);
  }

  if (showDetails && results.length > 0) {
    console.log(`\n📁 ${dirPath}:`);
    console.log('─'.repeat(50));

    // Sort: directories first, then files
    const sorted = results.sort((a, b) => {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const result of sorted) {
      const lineStr = formatNumber(result.lines);
      if (result.isDir) {
        console.log(`  📂 ${result.name.padEnd(30)} ${lineStr.padStart(8)} lines`);
      } else {
        console.log(`  📄 ${result.name.padEnd(30)} ${lineStr.padStart(8)} lines`);
      }
    }

    console.log('─'.repeat(50));
    console.log(`  Total: ${formatNumber(totalLines)} lines\n`);
  }

  return totalLines;
}

function main() {
  console.log('\n🔍 Code Line Counter');
  console.log('='.repeat(60));

  let grandTotal = 0;
  const summaries = [];

  // Count app/src if it exists
  if (fs.existsSync('app/src')) {
    const appLines = countDirectory('app/src');
    grandTotal += appLines;
    summaries.push({ name: 'app/src', lines: appLines });
  }

  // Count each package's src directory
  if (fs.existsSync('packages')) {
    const packages = fs.readdirSync('packages').filter((pkg) => {
      const srcPath = path.join('packages', pkg, 'src');
      return fs.existsSync(srcPath) && fs.statSync(srcPath).isDirectory();
    });

    for (const pkg of packages.sort()) {
      const srcPath = path.join('packages', pkg, 'src');
      const pkgLines = countDirectory(srcPath);
      grandTotal += pkgLines;
      summaries.push({ name: `packages/${pkg}/src`, lines: pkgLines });
    }
  }

  // Print summary
  console.log('\n📊 SUMMARY');
  console.log('='.repeat(60));
  for (const summary of summaries) {
    console.log(`  ${summary.name.padEnd(35)} ${formatNumber(summary.lines).padStart(10)} lines`);
  }
  console.log('='.repeat(60));
  console.log(`  🎯 GRAND TOTAL:`.padEnd(35) + ` ${formatNumber(grandTotal).padStart(10)} lines`);
  console.log('='.repeat(60));
  console.log();
}

// Run the script
main();
