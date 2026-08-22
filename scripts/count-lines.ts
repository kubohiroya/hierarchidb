import fs from 'node:fs';
import path from 'node:path';

const IGNORED_DIRS: ReadonlyArray<string> = [
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.turbo',
  '.next',
];

const COUNTED_EXTENSIONS: ReadonlyArray<string> = [
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

type DirEntryResult = {
  name: string;
  lines: number;
  isDir: boolean;
};

type Summary = {
  name: string;
  lines: number;
};

function countLines(filePath: string): number {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    //  CRLF/CR
    return content.split(/\r\n|\r|\n/).length;
  } catch {
    return 0;
  }
}

function formatNumber(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function shouldCountFile(fileName: string): boolean {
  return COUNTED_EXTENSIONS.some((ext) => fileName.endsWith(ext));
}

function findPackageSrcDirs(baseDir: string, maxDepth = 3): string[] {
  const results: string[] = [];

  function walk(currentDir: string, depth: number): void {
    if (depth >= maxDepth) return;

    let items: string[] = [];
    try {
      items = fs.readdirSync(currentDir);
    } catch {
      return;
    }

    for (const item of items) {
      if (item.startsWith('.')) continue;
      if (IGNORED_DIRS.includes(item)) continue;

      const fullPath = path.join(currentDir, item);
      let stats: fs.Stats;
      try {
        stats = fs.statSync(fullPath);
      } catch {
        continue;
      }
      if (!stats.isDirectory()) continue;

      const srcPath = path.join(fullPath, 'src');
      try {
        if (fs.existsSync(srcPath) && fs.statSync(srcPath).isDirectory()) {
          results.push(srcPath);
        }
      } catch {
        // ignore file system race conditions
      }

      walk(fullPath, depth + 1);
    }
  }

  walk(baseDir, 0);
  return results;
}

function countDirectory(dirPath: string, _indent = '', showDetails = true): number {
  let totalLines = 0;
  const results: DirEntryResult[] = [];

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
        const dirLines = countDirectory(fullPath, _indent + '  ', false);
        if (dirLines > 0) {
          results.push({ name: `${item}/`, lines: dirLines, isDir: true });
          totalLines += dirLines;
        }
      } else if (shouldCountFile(item)) {
        const lines = countLines(fullPath);
        results.push({ name: item, lines, isDir: false });
        totalLines += lines;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error reading directory ${dirPath}:`, message);
  }

  if (showDetails && results.length > 0) {
    console.log(`\n📁 ${dirPath}:`);
    console.log('─'.repeat(50));

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

function main(): void {
  console.log('\n🔍 Code Line Counter');
  console.log('='.repeat(60));

  let grandTotal = 0;
  const summaries: Summary[] = [];

  // Count src/src if it exists
  if (fs.existsSync('app/src')) {
    const appLines = countDirectory('app/src');
    grandTotal += appLines;
    summaries.push({ name: 'app/src', lines: appLines });
  }

  // Count each package's src directory (up to 3 levels deep)
  if (fs.existsSync('packages')) {
    const srcDirs = findPackageSrcDirs('packages', 3).sort();
    for (const srcPath of srcDirs) {
      const pkgLines = countDirectory(srcPath);
      grandTotal += pkgLines;
      const rel = path.relative(process.cwd(), srcPath) || srcPath;
      summaries.push({ name: rel, lines: pkgLines });
    }
  }

  // Count each plugin's src directory (up to 3 levels deep)
  if (fs.existsSync('plugins')) {
    const pluginSrcDirs = findPackageSrcDirs('plugins', 3).sort();
    for (const srcPath of pluginSrcDirs) {
      const pluginLines = countDirectory(srcPath);
      grandTotal += pluginLines;
      const rel = path.relative(process.cwd(), srcPath) || srcPath;
      summaries.push({ name: rel, lines: pluginLines });
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
