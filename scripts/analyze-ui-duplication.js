#!/usr/bin/env node

import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join, relative } from 'path';
import { createHash } from 'crypto';

const UI_PACKAGES_DIR = 'packages';
const UI_PACKAGE_PREFIX = 'ui-';

// Get all UI packages
function getUiPackages() {
  const packages = readdirSync(UI_PACKAGES_DIR)
    .filter(name => name.startsWith(UI_PACKAGE_PREFIX))
    .map(name => join(UI_PACKAGES_DIR, name));
  
  return packages.filter(pkg => statSync(pkg).isDirectory());
}

// Get all source files in a package
function getSourceFiles(packagePath) {
  const files = [];
  const srcPath = join(packagePath, 'src');
  
  if (!statSync(srcPath).isDirectory()) return files;
  
  function walk(dir) {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
        // Skip test files and stories
        if (!entry.includes('.test.') && !entry.includes('.stories.')) {
          files.push(fullPath);
        }
      }
    }
  }
  
  walk(srcPath);
  return files;
}

// Extract functions and interfaces from a file
function extractCodePatterns(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const patterns = {
    functions: [],
    interfaces: [],
    types: [],
    exports: [],
    imports: [],
    hooks: [],
    components: []
  };
  
  // Extract function declarations
  const funcRegex = /export\s+(?:const|function)\s+(\w+)/g;
  let match;
  while ((match = funcRegex.exec(content)) !== null) {
    const name = match[1];
    patterns.functions.push(name);
    
    // Check if it's a hook
    if (name.startsWith('use') && name[3] && name[3] === name[3].toUpperCase()) {
      patterns.hooks.push(name);
    }
    
    // Check if it's a component (starts with uppercase)
    if (name[0] === name[0].toUpperCase() && content.includes('return (')) {
      patterns.components.push(name);
    }
  }
  
  // Extract interfaces
  const interfaceRegex = /export\s+interface\s+(\w+)/g;
  while ((match = interfaceRegex.exec(content)) !== null) {
    patterns.interfaces.push(match[1]);
  }
  
  // Extract types
  const typeRegex = /export\s+type\s+(\w+)/g;
  while ((match = typeRegex.exec(content)) !== null) {
    patterns.types.push(match[1]);
  }
  
  // Extract imports from @hierarchidb packages
  const importRegex = /import\s+.*?\s+from\s+['"](@hierarchidb\/[^'"]+)['"]/g;
  while ((match = importRegex.exec(content)) !== null) {
    patterns.imports.push(match[1]);
  }
  
  return patterns;
}

// Calculate content similarity
function calculateSimilarity(content1, content2) {
  // Simple line-based similarity
  const lines1 = content1.split('\n').filter(l => l.trim() && !l.trim().startsWith('//'));
  const lines2 = content2.split('\n').filter(l => l.trim() && !l.trim().startsWith('//'));
  
  const set1 = new Set(lines1);
  const set2 = new Set(lines2);
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}

// Main analysis
function analyzeUiPackages() {
  const packages = getUiPackages();
  const packageData = {};
  const duplicates = {
    exactFiles: [],
    similarFiles: [],
    duplicateFunctions: {},
    duplicateInterfaces: {},
    duplicateTypes: {},
    commonImports: {}
  };
  
  console.log('Analyzing UI packages for code duplication...\n');
  console.log(`Found ${packages.length} UI packages:\n`);
  
  // Collect all data
  for (const pkg of packages) {
    const pkgName = pkg.split('/').pop();
    console.log(`  - ${pkgName}`);
    
    const files = getSourceFiles(pkg);
    packageData[pkgName] = {
      files: [],
      patterns: {}
    };
    
    for (const file of files) {
      const relPath = relative(pkg, file);
      const content = readFileSync(file, 'utf-8');
      const hash = createHash('md5').update(content).digest('hex');
      const patterns = extractCodePatterns(file);
      
      packageData[pkgName].files.push({
        path: relPath,
        fullPath: file,
        hash,
        content,
        patterns
      });
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('ANALYSIS RESULTS');
  console.log('='.repeat(80) + '\n');
  
  // Find exact duplicates
  const hashMap = {};
  for (const [pkgName, data] of Object.entries(packageData)) {
    for (const file of data.files) {
      if (!hashMap[file.hash]) {
        hashMap[file.hash] = [];
      }
      hashMap[file.hash].push({
        package: pkgName,
        path: file.path
      });
    }
  }
  
  console.log('## 1. EXACT FILE DUPLICATES\n');
  let foundExactDuplicates = false;
  for (const [hash, files] of Object.entries(hashMap)) {
    if (files.length > 1) {
      foundExactDuplicates = true;
      console.log(`Found ${files.length} identical files:`);
      files.forEach(f => console.log(`  - ${f.package}/${f.path}`));
      console.log();
    }
  }
  if (!foundExactDuplicates) {
    console.log('No exact file duplicates found.\n');
  }
  
  // Find similar files (>70% similarity)
  console.log('## 2. SIMILAR FILES (>70% similarity)\n');
  const similarPairs = [];
  const allFiles = [];
  for (const [pkgName, data] of Object.entries(packageData)) {
    for (const file of data.files) {
      allFiles.push({ package: pkgName, ...file });
    }
  }
  
  for (let i = 0; i < allFiles.length; i++) {
    for (let j = i + 1; j < allFiles.length; j++) {
      const file1 = allFiles[i];
      const file2 = allFiles[j];
      
      // Skip if same package or already exact duplicates
      if (file1.package === file2.package || file1.hash === file2.hash) continue;
      
      const similarity = calculateSimilarity(file1.content, file2.content);
      if (similarity > 0.7) {
        similarPairs.push({
          file1: `${file1.package}/${file1.path}`,
          file2: `${file2.package}/${file2.path}`,
          similarity: (similarity * 100).toFixed(1)
        });
      }
    }
  }
  
  if (similarPairs.length > 0) {
    similarPairs.sort((a, b) => parseFloat(b.similarity) - parseFloat(a.similarity));
    similarPairs.forEach(pair => {
      console.log(`${pair.similarity}% similar:`);
      console.log(`  - ${pair.file1}`);
      console.log(`  - ${pair.file2}`);
      console.log();
    });
  } else {
    console.log('No highly similar files found.\n');
  }
  
  // Find duplicate function/component names
  console.log('## 3. DUPLICATE FUNCTION/COMPONENT NAMES\n');
  const functionMap = {};
  for (const [pkgName, data] of Object.entries(packageData)) {
    for (const file of data.files) {
      for (const func of file.patterns.functions) {
        if (!functionMap[func]) {
          functionMap[func] = [];
        }
        functionMap[func].push({
          package: pkgName,
          path: file.path
        });
      }
    }
  }
  
  const duplicateFunctions = Object.entries(functionMap)
    .filter(([name, locations]) => locations.length > 1)
    .sort((a, b) => b[1].length - a[1].length);
  
  if (duplicateFunctions.length > 0) {
    duplicateFunctions.forEach(([name, locations]) => {
      console.log(`"${name}" appears in ${locations.length} places:`);
      locations.forEach(loc => console.log(`  - ${loc.package}/${loc.path}`));
      console.log();
    });
  } else {
    console.log('No duplicate function names found.\n');
  }
  
  // Find duplicate interfaces
  console.log('## 4. DUPLICATE INTERFACE NAMES\n');
  const interfaceMap = {};
  for (const [pkgName, data] of Object.entries(packageData)) {
    for (const file of data.files) {
      for (const iface of file.patterns.interfaces) {
        if (!interfaceMap[iface]) {
          interfaceMap[iface] = [];
        }
        interfaceMap[iface].push({
          package: pkgName,
          path: file.path
        });
      }
    }
  }
  
  const duplicateInterfaces = Object.entries(interfaceMap)
    .filter(([name, locations]) => locations.length > 1)
    .sort((a, b) => b[1].length - a[1].length);
  
  if (duplicateInterfaces.length > 0) {
    duplicateInterfaces.forEach(([name, locations]) => {
      console.log(`"${name}" appears in ${locations.length} places:`);
      locations.forEach(loc => console.log(`  - ${loc.package}/${loc.path}`));
      console.log();
    });
  } else {
    console.log('No duplicate interface names found.\n');
  }
  
  // Analyze common imports
  console.log('## 5. COMMON IMPORT PATTERNS\n');
  const importMap = {};
  for (const [pkgName, data] of Object.entries(packageData)) {
    for (const file of data.files) {
      for (const imp of file.patterns.imports) {
        if (!importMap[imp]) {
          importMap[imp] = new Set();
        }
        importMap[imp].add(pkgName);
      }
    }
  }
  
  const commonImports = Object.entries(importMap)
    .filter(([imp, packages]) => packages.size > 2)
    .sort((a, b) => b[1].size - a[1].size);
  
  if (commonImports.length > 0) {
    console.log('Packages commonly imported across multiple UI packages:');
    commonImports.forEach(([imp, packages]) => {
      console.log(`  - ${imp} (used by ${packages.size} packages)`);
      console.log(`    ${[...packages].join(', ')}`);
    });
    console.log();
  }
  
  // Summary and recommendations
  console.log('='.repeat(80));
  console.log('REFACTORING RECOMMENDATIONS');
  console.log('='.repeat(80) + '\n');
  
  const recommendations = [];
  
  // Check for logger duplication
  if (duplicateFunctions.some(([name]) => name === 'devLog' || name === 'devError' || name === 'devWarn')) {
    recommendations.push({
      priority: 'HIGH',
      issue: 'Duplicate logger utilities',
      description: 'Multiple packages have identical logger functions (devLog, devError, devWarn)',
      solution: 'Create a shared @hierarchidb/ui-utils package with common logging utilities'
    });
  }
  
  // Check for validation duplication
  if (duplicateFunctions.some(([name]) => name === 'validateExternalURL')) {
    recommendations.push({
      priority: 'HIGH',
      issue: 'Duplicate validation functions',
      description: 'validateExternalURL exists in multiple packages with slight variations',
      solution: 'Consolidate validation functions in @hierarchidb/core or create @hierarchidb/ui-utils'
    });
  }
  
  // Check for theme utilities
  if (duplicateFunctions.some(([name]) => name.includes('Theme'))) {
    recommendations.push({
      priority: 'MEDIUM',
      issue: 'Theme-related code duplication',
      description: 'Multiple packages implement their own theme utilities',
      solution: 'Use the centralized @hierarchidb/ui-theme package consistently'
    });
  }
  
  // Check for common component patterns
  if (duplicateFunctions.some(([name]) => name === 'ThemedLoadingScreen')) {
    recommendations.push({
      priority: 'MEDIUM',
      issue: 'Duplicate component implementations',
      description: 'ThemedLoadingScreen exists in multiple packages',
      solution: 'Move shared components to @hierarchidb/ui-core'
    });
  }
  
  // Import analysis recommendation
  if (commonImports.length > 0) {
    recommendations.push({
      priority: 'LOW',
      issue: 'Common import patterns',
      description: `${commonImports.length} packages are commonly imported across UI packages`,
      solution: 'Consider creating facade exports in parent packages to simplify imports'
    });
  }
  
  if (recommendations.length > 0) {
    recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. [${rec.priority}] ${rec.issue}`);
      console.log(`   Problem: ${rec.description}`);
      console.log(`   Solution: ${rec.solution}`);
      console.log();
    });
  } else {
    console.log('No significant refactoring opportunities found.');
  }
  
  // Generate JSON report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      packagesAnalyzed: packages.length,
      totalFiles: allFiles.length,
      exactDuplicates: Object.values(hashMap).filter(files => files.length > 1).length,
      similarFiles: similarPairs.length,
      duplicateFunctions: duplicateFunctions.length,
      duplicateInterfaces: duplicateInterfaces.length
    },
    details: {
      exactDuplicates: Object.entries(hashMap)
        .filter(([, files]) => files.length > 1)
        .map(([hash, files]) => ({ hash, files })),
      similarFiles: similarPairs,
      duplicateFunctions: duplicateFunctions.map(([name, locations]) => ({ name, locations })),
      duplicateInterfaces: duplicateInterfaces.map(([name, locations]) => ({ name, locations })),
      commonImports: commonImports.map(([imp, packages]) => ({ import: imp, packages: [...packages] }))
    },
    recommendations
  };
  
  // Write report
  const reportPath = 'docs/ui-duplication-report.json';
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nDetailed report saved to: ${reportPath}`);
}

// Run analysis
analyzeUiPackages();