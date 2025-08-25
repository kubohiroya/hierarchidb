#!/usr/bin/env node

/**
 * Comprehensive Code Duplication Analysis Tool
 * Analyzes the entire codebase for duplicated code blocks, functions, and patterns
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join, relative, basename, dirname } from 'path';
import { createHash } from 'crypto';

// Configuration
const IGNORE_DIRS = ['node_modules', '.git', 'dist', 'build', '.turbo', 'coverage', '.next', 'docs/pdf', 'references'];
const SCAN_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const MIN_LINES_FOR_DUPLICATION = 5; // Minimum lines to consider as duplication
const MIN_TOKENS_FOR_DUPLICATION = 50; // Minimum tokens to consider as duplication
const SIMILARITY_THRESHOLD = 0.85; // 85% similarity threshold

/**
 * Get all source files recursively
 */
function getAllSourceFiles(dir, basePath = '') {
  const files = [];
  
  function walk(currentDir) {
    try {
      const entries = readdirSync(currentDir);
      
      for (const entry of entries) {
        const fullPath = join(currentDir, entry);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Skip ignored directories
          if (!IGNORE_DIRS.includes(entry) && !entry.startsWith('.')) {
            walk(fullPath);
          }
        } else {
          // Check file extension
          const hasValidExt = SCAN_EXTENSIONS.some(ext => entry.endsWith(ext));
          // Skip test files, stories, and spec files
          const isTestFile = entry.includes('.test.') || 
                            entry.includes('.spec.') || 
                            entry.includes('.stories.');
          
          if (hasValidExt && !isTestFile) {
            files.push({
              path: fullPath,
              relative: relative(basePath || dir, fullPath),
              name: entry,
              dir: dirname(relative(basePath || dir, fullPath))
            });
          }
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${currentDir}:`, error.message);
    }
  }
  
  walk(dir);
  return files;
}

/**
 * Tokenize code for comparison
 */
function tokenizeCode(code) {
  // Remove comments
  code = code.replace(/\/\*[\s\S]*?\*\//g, '');
  code = code.replace(/\/\/.*/g, '');
  
  // Normalize whitespace
  code = code.replace(/\s+/g, ' ');
  
  // Split into tokens
  const tokens = code.match(/\b\w+\b|[{}()[\];,.<>!?:=+-/*&|^~%]/g) || [];
  
  return tokens;
}

/**
 * Extract code blocks from file
 */
function extractCodeBlocks(filePath, content) {
  const blocks = [];
  const lines = content.split('\n');
  
  // Extract functions
  const functionRegex = /^(?:export\s+)?(?:async\s+)?(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)\s*=>|function))/gm;
  let match;
  
  while ((match = functionRegex.exec(content)) !== null) {
    const functionName = match[1] || match[2];
    const startLine = content.substring(0, match.index).split('\n').length;
    
    // Find the end of the function by counting braces
    let braceCount = 0;
    let inFunction = false;
    let endLine = startLine;
    
    for (let i = startLine - 1; i < lines.length; i++) {
      const line = lines[i];
      for (const char of line) {
        if (char === '{') {
          braceCount++;
          inFunction = true;
        } else if (char === '}') {
          braceCount--;
        }
      }
      
      if (inFunction && braceCount === 0) {
        endLine = i + 1;
        break;
      }
    }
    
    if (endLine > startLine + MIN_LINES_FOR_DUPLICATION) {
      const blockContent = lines.slice(startLine - 1, endLine).join('\n');
      const tokens = tokenizeCode(blockContent);
      
      if (tokens.length >= MIN_TOKENS_FOR_DUPLICATION) {
        blocks.push({
          type: 'function',
          name: functionName,
          startLine,
          endLine,
          content: blockContent,
          tokens,
          hash: createHash('md5').update(tokens.join('')).digest('hex'),
          file: filePath
        });
      }
    }
  }
  
  // Extract classes
  const classRegex = /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/gm;
  
  while ((match = classRegex.exec(content)) !== null) {
    const className = match[1];
    const startLine = content.substring(0, match.index).split('\n').length;
    
    // Find the end of the class
    let braceCount = 0;
    let inClass = false;
    let endLine = startLine;
    
    for (let i = startLine - 1; i < lines.length; i++) {
      const line = lines[i];
      for (const char of line) {
        if (char === '{') {
          braceCount++;
          inClass = true;
        } else if (char === '}') {
          braceCount--;
        }
      }
      
      if (inClass && braceCount === 0) {
        endLine = i + 1;
        break;
      }
    }
    
    if (endLine > startLine + MIN_LINES_FOR_DUPLICATION) {
      const blockContent = lines.slice(startLine - 1, endLine).join('\n');
      const tokens = tokenizeCode(blockContent);
      
      if (tokens.length >= MIN_TOKENS_FOR_DUPLICATION) {
        blocks.push({
          type: 'class',
          name: className,
          startLine,
          endLine,
          content: blockContent,
          tokens,
          hash: createHash('md5').update(tokens.join('')).digest('hex'),
          file: filePath
        });
      }
    }
  }
  
  // Extract interface blocks
  const interfaceRegex = /^(?:export\s+)?interface\s+(\w+)/gm;
  
  while ((match = interfaceRegex.exec(content)) !== null) {
    const interfaceName = match[1];
    const startLine = content.substring(0, match.index).split('\n').length;
    
    // Find the end of the interface
    let braceCount = 0;
    let inInterface = false;
    let endLine = startLine;
    
    for (let i = startLine - 1; i < lines.length; i++) {
      const line = lines[i];
      for (const char of line) {
        if (char === '{') {
          braceCount++;
          inInterface = true;
        } else if (char === '}') {
          braceCount--;
        }
      }
      
      if (inInterface && braceCount === 0) {
        endLine = i + 1;
        break;
      }
    }
    
    const blockContent = lines.slice(startLine - 1, endLine).join('\n');
    const tokens = tokenizeCode(blockContent);
    
    blocks.push({
      type: 'interface',
      name: interfaceName,
      startLine,
      endLine,
      content: blockContent,
      tokens,
      hash: createHash('md5').update(tokens.join('')).digest('hex'),
      file: filePath
    });
  }
  
  return blocks;
}

/**
 * Calculate similarity between two token arrays
 */
function calculateTokenSimilarity(tokens1, tokens2) {
  if (tokens1.length === 0 || tokens2.length === 0) return 0;
  
  // Use Jaccard similarity
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  // Also consider order with Levenshtein-like approach for small blocks
  if (tokens1.length < 100 && tokens2.length < 100) {
    let matches = 0;
    const minLen = Math.min(tokens1.length, tokens2.length);
    for (let i = 0; i < minLen; i++) {
      if (tokens1[i] === tokens2[i]) matches++;
    }
    const orderSimilarity = matches / Math.max(tokens1.length, tokens2.length);
    
    // Combine Jaccard and order similarity
    return (intersection.size / union.size) * 0.7 + orderSimilarity * 0.3;
  }
  
  return intersection.size / union.size;
}

/**
 * Main analysis function
 */
async function analyzeCodeDuplication() {
  console.log('🔍 Comprehensive Code Duplication Analysis\n');
  console.log('=' .repeat(80));
  
  // Collect all source files
  console.log('\n📁 Scanning for source files...');
  const allFiles = getAllSourceFiles('.');
  console.log(`   Found ${allFiles.length} source files\n`);
  
  // Extract code blocks from all files
  console.log('📊 Extracting code blocks...');
  const allBlocks = [];
  const fileContents = {};
  
  for (const file of allFiles) {
    try {
      const content = readFileSync(file.path, 'utf-8');
      fileContents[file.relative] = content;
      const blocks = extractCodeBlocks(file.relative, content);
      allBlocks.push(...blocks);
    } catch (error) {
      console.error(`   Error reading ${file.relative}: ${error.message}`);
    }
  }
  
  console.log(`   Extracted ${allBlocks.length} code blocks`);
  console.log(`   - Functions: ${allBlocks.filter(b => b.type === 'function').length}`);
  console.log(`   - Classes: ${allBlocks.filter(b => b.type === 'class').length}`);
  console.log(`   - Interfaces: ${allBlocks.filter(b => b.type === 'interface').length}\n`);
  
  // Find exact duplicates
  console.log('🔍 Finding exact duplicates...');
  const hashGroups = {};
  for (const block of allBlocks) {
    if (!hashGroups[block.hash]) {
      hashGroups[block.hash] = [];
    }
    hashGroups[block.hash].push(block);
  }
  
  const exactDuplicates = Object.values(hashGroups).filter(group => group.length > 1);
  console.log(`   Found ${exactDuplicates.length} groups of exact duplicates\n`);
  
  // Find similar code blocks
  console.log('🔍 Finding similar code blocks...');
  const similarBlocks = [];
  
  for (let i = 0; i < allBlocks.length; i++) {
    for (let j = i + 1; j < allBlocks.length; j++) {
      const block1 = allBlocks[i];
      const block2 = allBlocks[j];
      
      // Skip if same file or already exact duplicates
      if (block1.file === block2.file || block1.hash === block2.hash) continue;
      
      // Skip if different types (except function/class which might be similar)
      if (block1.type === 'interface' || block2.type === 'interface') {
        if (block1.type !== block2.type) continue;
      }
      
      const similarity = calculateTokenSimilarity(block1.tokens, block2.tokens);
      
      if (similarity >= SIMILARITY_THRESHOLD) {
        similarBlocks.push({
          block1: {
            type: block1.type,
            name: block1.name,
            file: block1.file,
            lines: `${block1.startLine}-${block1.endLine}`,
            tokens: block1.tokens.length
          },
          block2: {
            type: block2.type,
            name: block2.name,
            file: block2.file,
            lines: `${block2.startLine}-${block2.endLine}`,
            tokens: block2.tokens.length
          },
          similarity: (similarity * 100).toFixed(1)
        });
      }
    }
  }
  
  console.log(`   Found ${similarBlocks.length} similar code block pairs\n`);
  
  // Analyze patterns
  console.log('📈 Analyzing duplication patterns...\n');
  
  const packageDuplication = {};
  const fileDuplication = {};
  
  // Count duplications by package
  for (const group of exactDuplicates) {
    for (const block of group) {
      const pkg = block.file.split('/')[0];
      if (!packageDuplication[pkg]) {
        packageDuplication[pkg] = { exact: 0, similar: 0, lines: 0 };
      }
      packageDuplication[pkg].exact++;
      packageDuplication[pkg].lines += (block.endLine - block.startLine + 1);
    }
  }
  
  for (const pair of similarBlocks) {
    const pkg1 = pair.block1.file.split('/')[0];
    const pkg2 = pair.block2.file.split('/')[0];
    
    if (!packageDuplication[pkg1]) {
      packageDuplication[pkg1] = { exact: 0, similar: 0, lines: 0 };
    }
    if (!packageDuplication[pkg2]) {
      packageDuplication[pkg2] = { exact: 0, similar: 0, lines: 0 };
    }
    
    packageDuplication[pkg1].similar++;
    packageDuplication[pkg2].similar++;
  }
  
  // Generate report
  console.log('=' .repeat(80));
  console.log('📋 DUPLICATION REPORT');
  console.log('=' .repeat(80) + '\n');
  
  // Exact duplicates report
  console.log('## 1. EXACT DUPLICATES\n');
  
  if (exactDuplicates.length > 0) {
    // Sort by number of duplicates and token count
    const sortedExact = exactDuplicates.sort((a, b) => {
      const countDiff = b.length - a.length;
      if (countDiff !== 0) return countDiff;
      return b[0].tokens.length - a[0].tokens.length;
    });
    
    // Show top 10 most duplicated blocks
    const topDuplicates = sortedExact.slice(0, 10);
    
    topDuplicates.forEach((group, index) => {
      const sample = group[0];
      console.log(`${index + 1}. ${sample.type} "${sample.name}" (${sample.tokens.length} tokens)`);
      console.log(`   Appears ${group.length} times in:`);
      group.forEach(block => {
        console.log(`   - ${block.file}:${block.startLine}-${block.endLine}`);
      });
      console.log();
    });
    
    if (sortedExact.length > 10) {
      console.log(`   ... and ${sortedExact.length - 10} more groups\n`);
    }
  } else {
    console.log('   No exact duplicates found.\n');
  }
  
  // Similar blocks report
  console.log('## 2. SIMILAR CODE BLOCKS (≥85% similarity)\n');
  
  if (similarBlocks.length > 0) {
    // Sort by similarity
    const sortedSimilar = similarBlocks.sort((a, b) => 
      parseFloat(b.similarity) - parseFloat(a.similarity)
    );
    
    // Show top 10 most similar blocks
    const topSimilar = sortedSimilar.slice(0, 10);
    
    topSimilar.forEach((pair, index) => {
      console.log(`${index + 1}. ${pair.similarity}% similar:`);
      console.log(`   - ${pair.block1.type} "${pair.block1.name}" in ${pair.block1.file}:${pair.block1.lines}`);
      console.log(`   - ${pair.block2.type} "${pair.block2.name}" in ${pair.block2.file}:${pair.block2.lines}`);
      console.log();
    });
    
    if (sortedSimilar.length > 10) {
      console.log(`   ... and ${sortedSimilar.length - 10} more similar pairs\n`);
    }
  } else {
    console.log('   No similar blocks found.\n');
  }
  
  // Package-level analysis
  console.log('## 3. DUPLICATION BY PACKAGE\n');
  
  const sortedPackages = Object.entries(packageDuplication)
    .sort((a, b) => (b[1].exact + b[1].similar) - (a[1].exact + a[1].similar))
    .slice(0, 10);
  
  if (sortedPackages.length > 0) {
    console.log('Top packages with most duplication:');
    sortedPackages.forEach(([pkg, stats]) => {
      console.log(`   ${pkg}:`);
      console.log(`      Exact duplicates: ${stats.exact}`);
      console.log(`      Similar blocks: ${stats.similar}`);
      console.log(`      Duplicated lines: ~${stats.lines}`);
    });
    console.log();
  }
  
  // Statistics
  console.log('## 4. OVERALL STATISTICS\n');
  
  const totalLines = Object.values(fileContents)
    .reduce((sum, content) => sum + content.split('\n').length, 0);
  
  const duplicatedLines = Object.values(hashGroups)
    .filter(group => group.length > 1)
    .reduce((sum, group) => {
      return sum + group.reduce((s, block) => 
        s + (block.endLine - block.startLine + 1), 0);
    }, 0);
  
  console.log(`   Total files analyzed: ${allFiles.length}`);
  console.log(`   Total lines of code: ${totalLines.toLocaleString()}`);
  console.log(`   Total code blocks: ${allBlocks.length}`);
  console.log(`   Exact duplicate groups: ${exactDuplicates.length}`);
  console.log(`   Similar block pairs: ${similarBlocks.length}`);
  console.log(`   Estimated duplicated lines: ${duplicatedLines.toLocaleString()}`);
  console.log(`   Duplication percentage: ${((duplicatedLines / totalLines) * 100).toFixed(2)}%\n`);
  
  // Recommendations
  console.log('=' .repeat(80));
  console.log('💡 RECOMMENDATIONS');
  console.log('=' .repeat(80) + '\n');
  
  const recommendations = [];
  
  // Check for common patterns
  const functionNames = {};
  for (const block of allBlocks.filter(b => b.type === 'function')) {
    if (!functionNames[block.name]) {
      functionNames[block.name] = [];
    }
    functionNames[block.name].push(block.file);
  }
  
  const duplicateFunctionNames = Object.entries(functionNames)
    .filter(([, files]) => files.length > 2)
    .sort((a, b) => b[1].length - a[1].length);
  
  if (duplicateFunctionNames.length > 0) {
    recommendations.push({
      priority: 'HIGH',
      issue: 'Duplicate function names across multiple files',
      examples: duplicateFunctionNames.slice(0, 3).map(([name, files]) => 
        `"${name}" appears in ${files.length} files`
      ),
      solution: 'Consider extracting common functions to shared utility packages'
    });
  }
  
  if (exactDuplicates.length > 10) {
    recommendations.push({
      priority: 'HIGH',
      issue: `Found ${exactDuplicates.length} groups of exact duplicate code`,
      examples: exactDuplicates.slice(0, 3).map(group => 
        `"${group[0].name}" duplicated ${group.length} times`
      ),
      solution: 'Extract duplicated code to shared modules or base classes'
    });
  }
  
  if (similarBlocks.length > 20) {
    recommendations.push({
      priority: 'MEDIUM',
      issue: `Found ${similarBlocks.length} pairs of similar code blocks`,
      examples: similarBlocks.slice(0, 3).map(pair => 
        `${pair.block1.name} and ${pair.block2.name} are ${pair.similarity}% similar`
      ),
      solution: 'Consider creating generic/template functions or using composition'
    });
  }
  
  const duplicationPercentage = (duplicatedLines / totalLines) * 100;
  if (duplicationPercentage > 5) {
    recommendations.push({
      priority: 'MEDIUM',
      issue: `Overall duplication is ${duplicationPercentage.toFixed(1)}% (target: <5%)`,
      solution: 'Implement a systematic refactoring plan to reduce duplication'
    });
  }
  
  if (recommendations.length > 0) {
    recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. [${rec.priority}] ${rec.issue}`);
      if (rec.examples) {
        console.log('   Examples:');
        rec.examples.forEach(ex => console.log(`   - ${ex}`));
      }
      console.log(`   Solution: ${rec.solution}\n`);
    });
  } else {
    console.log('   Code duplication is within acceptable limits.\n');
  }
  
  // Save detailed report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      filesAnalyzed: allFiles.length,
      totalLines,
      codeBlocks: allBlocks.length,
      exactDuplicateGroups: exactDuplicates.length,
      similarPairs: similarBlocks.length,
      duplicatedLines,
      duplicationPercentage: duplicationPercentage.toFixed(2)
    },
    exactDuplicates: exactDuplicates.slice(0, 50).map(group => ({
      type: group[0].type,
      name: group[0].name,
      tokenCount: group[0].tokens.length,
      occurrences: group.map(b => ({
        file: b.file,
        lines: `${b.startLine}-${b.endLine}`
      }))
    })),
    similarBlocks: similarBlocks.slice(0, 50),
    packageAnalysis: packageDuplication,
    recommendations
  };
  
  const reportPath = 'docs/code-duplication-report.json';
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📄 Detailed report saved to: ${reportPath}\n`);
}

// Run analysis
analyzeCodeDuplication().catch(console.error);