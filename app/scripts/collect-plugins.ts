// scripts/collect-plugins.ts
import * as fs from 'fs';
import * as path from 'path';

const PREFIX = '@hierarchidb/';
const SUFFIX = '-plugin';

type PackageJson = {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  [key: string]: any;
};

const ROOT = process.cwd();
const NODE_MODULES = path.join(ROOT, 'node_modules');

/**
 * プラグイン名として有効な名前かどうかを判定
 */
function isValidPluginName(name: string): boolean {
  return name.startsWith(PREFIX) && name.endsWith(SUFFIX);
}

/**
 * 指定されたパッケージ名の package.json を読み取る
 */
function readPackageJson(pkgName: string): PackageJson | null {
  try {
    const pkgJsonPath = require.resolve(`${pkgName}/package.json`, {
      paths: [NODE_MODULES],
    });
    const content = fs.readFileSync(pkgJsonPath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.warn(`⚠️ Skipped: Cannot read package.json for "${pkgName}"`);
    return null;
  }
}

/* 再帰的にプラグインとその依存グラフを構築
 */
function buildDependencyGraph(rootPkg: PackageJson): {
  graph: Map<string, string[]>;
  packages: Map<string, PackageJson>;
} {
  const graph = new Map<string, string[]>(); // key = plugin name, value = list of dependencies
  const packages = new Map<string, PackageJson>();
  const visited = new Set<string>();

  function visit(pkgName: string) {
    if (visited.has(pkgName)) return;
    visited.add(pkgName);

    const pkgJson = readPackageJson(pkgName);
    if (!pkgJson) return;

    packages.set(pkgJson.name, pkgJson);

    const deps = Object.keys(pkgJson.dependencies ?? {}).filter(isValidPluginName);
    graph.set(pkgJson.name, deps);

    for (const dep of deps) {
      visit(dep);
    }
  }
  // Start from top-level plugin dependencies
  const entryPlugins = Object.keys(rootPkg.dependencies ?? {}).filter(isValidPluginName);
  for (const name of entryPlugins) {
    visit(name);
  }

  return { graph, packages };
}

/**
 * トポロジカルソート（Kahn's algorithm）
 */
function topologicalSort(graph: Map<string, string[]>): string[] {
  const inDegree = new Map<string, number>();
  const sorted: string[] = [];

  // 初期化：ノードをすべて inDegree=0 で追加
  for (const node of Object.keys(graph)) {
    inDegree.set(node, 0);
  }

  // 依存関係に応じて inDegree を加算
  for (const deps of Object.keys(graph.values())) {
    for (const dep of deps) {
      inDegree.set(dep, (inDegree.get(dep) ?? 0) + 1);
    }
  }

  const queue = Array.from(inDegree.entries())
    .filter(([_, deg]) => deg === 0)
    .map(([name]) => name);

  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    for (const dep of graph.get(current) ?? []) {
      inDegree.set(dep, inDegree.get(dep)! - 1);
      if (inDegree.get(dep) === 0) {
        queue.push(dep);
      }
    }
  }

  if (sorted.length !== graph.size) {
    throw new Error('⚠️ Circular dependency detected among plugins');
  }

  return sorted;
}

/**
 * メイン処理
 */
export function resolvePluginInitializationOrder(appPkgJson: PackageJson): PackageJson[] {
  const { graph, packages } = buildDependencyGraph(appPkgJson);
  const sortedNames = topologicalSort(graph);
  return sortedNames.map((name) => packages.get(name)!);
}

// ==================== 実行 ====================
if (require.main === module) {
  const appPkgJsonPath = path.resolve(ROOT, 'package.json');
  const appPkgJson = JSON.parse(fs.readFileSync(appPkgJsonPath, 'utf-8'));

  const pluginPkgs = Object.values(resolvePluginInitializationOrder(appPkgJson));
  console.log(`📦 Found ${pluginPkgs.length} plugins:`);
  for (const pkg of pluginPkgs) {
    console.log(`- ${pkg.name}@${pkg.version}`);
  }

  // 例: JSONファイルに書き出す
  fs.writeFileSync(
    path.join(ROOT, 'src/generated/plugin-packages.json'),
    JSON.stringify(
      {
        prefix: PREFIX,
        suffix: SUFFIX,
        updatedAt: new Date().toISOString(),
        packages: [...pluginPkgs],
      },
      null,
      2
    ),
    'utf-8'
  );
}
