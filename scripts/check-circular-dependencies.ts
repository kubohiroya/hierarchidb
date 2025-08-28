#!/usr/bin/env tsx
import * as fs from 'fs';
import * as path from 'path';

interface PackageInfo {
  name: string;
  path: string;
  dependencies: string[];
  devDependencies: string[];
}

interface DependencyGraph {
  [packageName: string]: string[];
}

// 依存関係を収集
function collectPackages(baseDir: string): Map<string, PackageInfo> {
  const packages = new Map<string, PackageInfo>();
  
  function scanDirectory(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.name === 'node_modules') continue;
      
      if (entry.isDirectory()) {
        const packageJsonPath = path.join(fullPath, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
          if (packageJson.name && packageJson.name.startsWith('@hierarchidb/')) {
            const deps = Object.keys(packageJson.dependencies || {})
              .filter(d => d.startsWith('@hierarchidb/'));
            const devDeps = Object.keys(packageJson.devDependencies || {})
              .filter(d => d.startsWith('@hierarchidb/'));
              
            packages.set(packageJson.name, {
              name: packageJson.name,
              path: fullPath,
              dependencies: deps,
              devDependencies: devDeps
            });
          }
        }
        
        // 再帰的にサブディレクトリをスキャン
        if (!['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
          scanDirectory(fullPath);
        }
      }
    }
  }
  
  scanDirectory(baseDir);
  return packages;
}

// 循環依存を検出
function detectCycles(graph: DependencyGraph): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const currentPath: string[] = [];
  
  function dfs(node: string) {
    visited.add(node);
    recursionStack.add(node);
    currentPath.push(node);
    
    const neighbors = graph[node] || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      } else if (recursionStack.has(neighbor)) {
        // 循環を発見
        const cycleStart = currentPath.indexOf(neighbor);
        const cycle = currentPath.slice(cycleStart);
        cycle.push(neighbor); // 循環を閉じる
        cycles.push(cycle);
      }
    }
    
    currentPath.pop();
    recursionStack.delete(node);
  }
  
  for (const node of Object.keys(graph)) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }
  
  return cycles;
}

// 依存関係の深さを計算
function calculateDepth(graph: DependencyGraph, node: string, memo: Map<string, number>): number {
  if (memo.has(node)) {
    return memo.get(node)!;
  }
  
  const deps = graph[node] || [];
  if (deps.length === 0) {
    memo.set(node, 0);
    return 0;
  }
  
  const maxDepth = Math.max(...deps.map(dep => calculateDepth(graph, dep, memo)));
  const depth = maxDepth + 1;
  memo.set(node, depth);
  return depth;
}

// メイン処理
function main() {
  console.log('🔍 Checking for circular dependencies in HierarchiDB monorepo...\n');
  
  const packagesDir = path.join(process.cwd(), 'packages');
  const packages = collectPackages(packagesDir);
  
  console.log(`📦 Found ${packages.size} packages:\n`);
  
  // 依存グラフを構築（production dependenciesのみ）
  const prodGraph: DependencyGraph = {};
  const allDepsGraph: DependencyGraph = {};
  
  for (const [name, info] of packages) {
    prodGraph[name] = info.dependencies;
    allDepsGraph[name] = [...info.dependencies, ...info.devDependencies];
  }
  
  // Production依存での循環チェック
  console.log('=== Checking production dependencies ===\n');
  const prodCycles = detectCycles(prodGraph);
  
  if (prodCycles.length > 0) {
    console.log('❌ Circular dependencies detected in production dependencies:');
    prodCycles.forEach((cycle, index) => {
      console.log(`\n  Cycle ${index + 1}:`);
      console.log('  ' + cycle.join(' → '));
    });
  } else {
    console.log('✅ No circular dependencies in production dependencies\n');
  }
  
  // すべての依存での循環チェック
  console.log('=== Checking all dependencies (including devDependencies) ===\n');
  const allCycles = detectCycles(allDepsGraph);
  
  if (allCycles.length > 0) {
    console.log('⚠️  Circular dependencies detected when including devDependencies:');
    allCycles.forEach((cycle, index) => {
      console.log(`\n  Cycle ${index + 1}:`);
      console.log('  ' + cycle.join(' → '));
    });
  } else {
    console.log('✅ No circular dependencies in all dependencies\n');
  }
  
  // 依存関係の深さ分析
  console.log('\n=== Dependency Depth Analysis ===\n');
  const depthMemo = new Map<string, number>();
  const depths: Array<[string, number]> = [];
  
  for (const pkg of packages.keys()) {
    const depth = calculateDepth(prodGraph, pkg, depthMemo);
    depths.push([pkg, depth]);
  }
  
  // 深さでソート
  depths.sort((a, b) => a[1] - b[1]);
  
  console.log('Package dependency depths (production only):');
  let currentDepth = -1;
  depths.forEach(([pkg, depth]) => {
    if (depth !== currentDepth) {
      currentDepth = depth;
      console.log(`\nDepth ${depth}:`);
    }
    const shortName = pkg.replace('@hierarchidb/', '');
    const depCount = prodGraph[pkg]?.length || 0;
    console.log(`  - ${shortName} (${depCount} dependencies)`);
  });
  
  // 最も依存されているパッケージ
  console.log('\n=== Most Depended Upon Packages ===\n');
  const dependedUponCount = new Map<string, number>();
  
  for (const info of packages.values()) {
    for (const dep of info.dependencies) {
      dependedUponCount.set(dep, (dependedUponCount.get(dep) || 0) + 1);
    }
  }
  
  const sortedDependedUpon = Array.from(dependedUponCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  console.log('Top 10 most depended upon packages:');
  sortedDependedUpon.forEach(([pkg, count], index) => {
    const shortName = pkg.replace('@hierarchidb/', '');
    console.log(`  ${index + 1}. ${shortName} (${count} packages depend on it)`);
  });
  
  // サマリー
  console.log('\n=== Summary ===\n');
  console.log(`Total packages: ${packages.size}`);
  console.log(`Maximum dependency depth: ${Math.max(...depths.map(d => d[1]))}`);
  console.log(`Production circular dependencies: ${prodCycles.length}`);
  console.log(`All circular dependencies: ${allCycles.length}`);
  
  if (prodCycles.length > 0) {
    console.log('\n❌ Build will fail due to circular dependencies in production!');
    process.exit(1);
  } else if (allCycles.length > 0) {
    console.log('\n⚠️  Warning: Circular dependencies exist in devDependencies');
    console.log('   This may cause issues during development but won\'t affect production builds.');
  } else {
    console.log('\n✅ All dependency checks passed!');
  }
}

main();