#!/usr/bin/env tsx

/**
 * Check package dependency rules for the hierarchical structure
 * 
 * Rules:
 * 1. Siblings: Younger packages (higher number) can depend on older (lower number), not vice versa
 * 2. Parent-child: Parent can depend on child, not vice versa
 * 3. Cross-layer: Higher numbered layers can depend on lower numbered layers
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
} as const;

const log = {
  info: (msg: string) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg: string) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  header: (msg: string) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}`)
};

interface Package {
  name: string;
  path: string;
  layer: number;
  sublayer?: string;
  dependencies: string[];
}

interface Violation {
  from: string;
  to: string;
  fromLayer: number;
  toLayer: number;
  rule: string;
}

// Parse package layer from path or name
function parsePackageLayer(packagePath: string, packageName: string): { layer: number; sublayer?: string } {
  // Check if path starts with a number prefix
  const pathMatch = packagePath.match(/packages\/(\d+)-/);
  if (pathMatch) {
    return { layer: parseInt(pathMatch[1], 10) };
  }
  
  // Check if package name has a number prefix
  const nameMatch = packageName.match(/@hierarchidb\/(\d+)-/);
  if (nameMatch) {
    return { layer: parseInt(nameMatch[1], 10) };
  }
  
  // Legacy packages without number prefixes - assign based on type
  if (packageName.includes('ui-') && !packageName.includes('treeconsole')) {
    return { layer: 15, sublayer: 'ui-widget' }; // UI widgets
  }
  if (packageName.includes('ui/')) {
    return { layer: 14, sublayer: 'ui-legacy' }; // Legacy UI
  }
  if (packageName.includes('plugin')) {
    return { layer: 25, sublayer: 'plugin-legacy' }; // Legacy plugins
  }
  
  return { layer: 99, sublayer: 'unknown' }; // Unknown packages
}

// Load all packages
async function loadPackages(): Promise<Package[]> {
  const packages: Package[] = [];
  
  const packageJsonFiles = await glob('packages/**/package.json', {
    ignore: ['**/node_modules/**', '**/dist/**']
  });
  
  for (const file of packageJsonFiles) {
    try {
      const content = await fs.promises.readFile(file, 'utf8');
      const pkg = JSON.parse(content);
      const packagePath = path.dirname(file);
      const { layer, sublayer } = parsePackageLayer(packagePath, pkg.name);
      
      // Collect all @hierarchidb dependencies
      const dependencies: string[] = [];
      const depTypes = ['dependencies', 'devDependencies', 'peerDependencies'] as const;
      
      for (const depType of depTypes) {
        if (pkg[depType]) {
          for (const dep of Object.keys(pkg[depType])) {
            if (dep.startsWith('@hierarchidb/')) {
              dependencies.push(dep);
            }
          }
        }
      }
      
      packages.push({
        name: pkg.name,
        path: packagePath,
        layer,
        sublayer,
        dependencies
      });
    } catch (error) {
      log.error(`Failed to load ${file}: ${error}`);
    }
  }
  
  return packages;
}

// Check dependency rules
function checkDependencyRules(packages: Package[]): Violation[] {
  const violations: Violation[] = [];
  const packageMap = new Map<string, Package>();
  
  // Build package map for quick lookup
  packages.forEach(pkg => {
    packageMap.set(pkg.name, pkg);
  });
  
  // Check each package's dependencies
  packages.forEach(pkg => {
    pkg.dependencies.forEach(depName => {
      const dep = packageMap.get(depName);
      if (!dep) {
        // Dependency not found in workspace (might be external)
        return;
      }
      
      // Rule 1: Lower layer cannot depend on higher layer
      if (pkg.layer < dep.layer) {
        violations.push({
          from: pkg.name,
          to: depName,
          fromLayer: pkg.layer,
          toLayer: dep.layer,
          rule: 'Lower layer cannot depend on higher layer'
        });
      }
      
      // Rule 2: Within same layer, check sublayer rules if applicable
      if (pkg.layer === dep.layer && pkg.sublayer && dep.sublayer) {
        // For numbered packages in same layer, no restrictions within same layer
        // This is mainly for legacy packages
        if (pkg.sublayer === 'ui-widget' && dep.sublayer === 'ui-legacy') {
          // UI widgets should not depend on legacy UI
          violations.push({
            from: pkg.name,
            to: depName,
            fromLayer: pkg.layer,
            toLayer: dep.layer,
            rule: 'UI widgets should not depend on legacy UI packages'
          });
        }
      }
      
      // Rule 3: Special rules for specific layers
      // Worker (02) should not depend on UI packages (10+)
      if (pkg.layer === 2 && dep.layer >= 10) {
        violations.push({
          from: pkg.name,
          to: depName,
          fromLayer: pkg.layer,
          toLayer: dep.layer,
          rule: 'Worker package cannot depend on UI packages'
        });
      }
      
      // Core (00) should not depend on anything except itself
      if (pkg.layer === 0 && dep.layer > 0) {
        violations.push({
          from: pkg.name,
          to: depName,
          fromLayer: pkg.layer,
          toLayer: dep.layer,
          rule: 'Core package should not depend on other packages'
        });
      }
      
      // API (01) should only depend on Core (00)
      if (pkg.layer === 1 && dep.layer > 1) {
        violations.push({
          from: pkg.name,
          to: depName,
          fromLayer: pkg.layer,
          toLayer: dep.layer,
          rule: 'API package should only depend on Core'
        });
      }
    });
  });
  
  return violations;
}

// Generate dependency graph for visualization
function generateDependencyReport(packages: Package[], violations: Violation[]): void {
  log.header('Package Dependency Report');
  
  // Group packages by layer
  const packagesByLayer = new Map<number, Package[]>();
  packages.forEach(pkg => {
    if (!packagesByLayer.has(pkg.layer)) {
      packagesByLayer.set(pkg.layer, []);
    }
    packagesByLayer.get(pkg.layer)!.push(pkg);
  });
  
  // Sort layers
  const layers = Array.from(packagesByLayer.keys()).sort((a, b) => a - b);
  
  console.log('\n📦 Package Hierarchy:');
  layers.forEach(layer => {
    const layerPackages = packagesByLayer.get(layer)!;
    console.log(`\n  Layer ${layer.toString().padStart(2, '0')}:`);
    layerPackages.forEach(pkg => {
      const shortName = pkg.name.replace('@hierarchidb/', '');
      const sublayerInfo = pkg.sublayer ? ` (${pkg.sublayer})` : '';
      console.log(`    - ${shortName}${sublayerInfo}`);
    });
  });
}

// Main function
async function main(): Promise<void> {
  console.log(`
${colors.bright}${colors.cyan}╔══════════════════════════════════════════════════════════╗
║         Package Dependency Rule Checker                   ║
╚══════════════════════════════════════════════════════════╝${colors.reset}
`);
  
  log.info('Loading packages...');
  const packages = await loadPackages();
  log.success(`Loaded ${packages.length} packages`);
  
  log.info('Checking dependency rules...');
  const violations = checkDependencyRules(packages);
  
  // Generate report
  generateDependencyReport(packages, violations);
  
  // Report violations
  if (violations.length === 0) {
    log.header('✅ All dependency rules are satisfied!');
  } else {
    log.header(`❌ Found ${violations.length} dependency rule violations:`);
    
    // Group violations by rule
    const violationsByRule = new Map<string, Violation[]>();
    violations.forEach(v => {
      if (!violationsByRule.has(v.rule)) {
        violationsByRule.set(v.rule, []);
      }
      violationsByRule.get(v.rule)!.push(v);
    });
    
    // Display violations grouped by rule
    violationsByRule.forEach((vList, rule) => {
      console.log(`\n  ${colors.yellow}${rule}:${colors.reset}`);
      vList.forEach(v => {
        const fromName = v.from.replace('@hierarchidb/', '');
        const toName = v.to.replace('@hierarchidb/', '');
        console.log(`    ${colors.red}✗${colors.reset} ${fromName} (layer ${v.fromLayer}) → ${toName} (layer ${v.toLayer})`);
      });
    });
    
    console.log('\n');
    log.error('Please fix the violations above to maintain the package hierarchy integrity.');
    process.exit(1);
  }
}

// Run the checker
main().catch(error => {
  log.error(`Fatal error: ${error}`);
  process.exit(1);
});