#!/usr/bin/env node
"use strict";
/**
 * Script to refactor imports and update package dependencies
 * - Replace devLog/devError/devWarn with console
 * - Update formatBytes and validateExternalURL imports to @hierarchidb/util
 * - Remove ResourceProjectToggle from ui-core
 * - Update package.json dependencies
 */
Object.defineProperty(exports, "__esModule", { value: true });
var fs_1 = require("fs");
var path_1 = require("path");
var url_1 = require("url");
var __filename = (0, url_1.fileURLToPath)(import.meta.url);
var __dirname = path_1.default.dirname(__filename);
var rootDir = path_1.default.join(__dirname, '..');
// Packages to process
var packagesToProcess = [
    'packages/ui/auth',
    'packages/ui/core',
    'packages/ui/file',
    'packages/ui/i18n',
    'packages/ui/monitoring',
    'packages/ui/csv-extract',
    'packages/ui/dialog',
    'packages/ui/map',
    'packages/ui/navigation',
];
// Define replacements for each file type
var logReplacements = [
    // Remove import statement
    {
        pattern: /import\s*\{[^}]*(?:devLog|devError|devWarn|devInfo|devDebug)[^}]*\}\s*from\s*['"]@hierarchidb\/common-core['"];?\n?/g,
        replacement: ''
    },
    // Replace devLog calls
    {
        pattern: /(\s*)devLog\((.*?)\);/g,
        replacement: '$1if (import.meta.env.DEV) {\n$1  console.log($2);\n$1}'
    },
    // Replace devError calls
    {
        pattern: /(\s*)devError\((.*?)\);/g,
        replacement: '$1if (import.meta.env.DEV) {\n$1  console.error($2);\n$1}'
    },
    // Replace devWarn calls
    {
        pattern: /(\s*)devWarn\((.*?)\);/g,
        replacement: '$1if (import.meta.env.DEV) {\n$1  console.warn($2);\n$1}'
    },
    // Replace devInfo calls
    {
        pattern: /(\s*)devInfo\((.*?)\);/g,
        replacement: '$1if (import.meta.env.DEV) {\n$1  console.info($2);\n$1}'
    },
    // Replace devDebug calls
    {
        pattern: /(\s*)devDebug\((.*?)\);/g,
        replacement: '$1if (import.meta.env.DEV) {\n$1  console.debug($2);\n$1}'
    },
];
var utilReplacements = [
    // Replace formatBytes import
    {
        pattern: /import\s*\{([^}]*)\}\s*from\s*['"]@hierarchidb\/common-core['"];?/g,
        replacement: function (match, imports) {
            var importList = imports.split(',').map(function (s) { return s.trim(); });
            var utilImports = importList.filter(function (imp) {
                return ['formatBytes', 'validateExternalURL', 'clampPercentage', 'getMemorySeverity'].includes(imp);
            });
            var otherImports = importList.filter(function (imp) {
                return !['formatBytes', 'validateExternalURL', 'clampPercentage', 'getMemorySeverity'].includes(imp) &&
                    !['devLog', 'devError', 'devWarn', 'devInfo', 'devDebug'].includes(imp);
            });
            var result = '';
            if (utilImports.length > 0) {
                result += "import { ".concat(utilImports.join(', '), " } from '@hierarchidb/util';\n");
            }
            if (otherImports.length > 0) {
                result += "import { ".concat(otherImports.join(', '), " } from '@hierarchidb/common-core';\n");
            }
            return result || '';
        }
    },
];
function processFile(filePath) {
    if (!fs_1.default.existsSync(filePath))
        return;
    var content = fs_1.default.readFileSync(filePath, 'utf-8');
    var originalContent = content;
    // First apply util replacements
    for (var _i = 0, utilReplacements_1 = utilReplacements; _i < utilReplacements_1.length; _i++) {
        var _a = utilReplacements_1[_i], pattern = _a.pattern, replacement = _a.replacement;
        content = content.replace(pattern, replacement);
    }
    // Then apply log replacements
    for (var _b = 0, logReplacements_1 = logReplacements; _b < logReplacements_1.length; _b++) {
        var _c = logReplacements_1[_b], pattern = _c.pattern, replacement = _c.replacement;
        content = content.replace(pattern, replacement);
    }
    // Clean up empty lines
    content = content.replace(/\n\n\n+/g, '\n\n');
    if (content !== originalContent) {
        fs_1.default.writeFileSync(filePath, content);
        console.log("\u2705 Updated: ".concat(filePath));
    }
}
function updatePackageJson(packageDir) {
    var packageJsonPath = path_1.default.join(packageDir, 'package.json');
    if (!fs_1.default.existsSync(packageJsonPath))
        return;
    var packageJson = JSON.parse(fs_1.default.readFileSync(packageJsonPath, 'utf-8'));
    var modified = false;
    // Check if we need to add @hierarchidb/util
    var srcDir = path_1.default.join(packageDir, 'src');
    var needsUtil = false;
    var needsCommonCore = false;
    var needsCommonType = false;
    // Recursively check all source files
    function checkFiles(dir) {
        if (!fs_1.default.existsSync(dir))
            return;
        var files = fs_1.default.readdirSync(dir);
        for (var _i = 0, files_1 = files; _i < files_1.length; _i++) {
            var file = files_1[_i];
            var filePath = path_1.default.join(dir, file);
            var stat = fs_1.default.statSync(filePath);
            if (stat.isDirectory()) {
                checkFiles(filePath);
            }
            else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
                var content = fs_1.default.readFileSync(filePath, 'utf-8');
                if (content.includes('@hierarchidb/util'))
                    needsUtil = true;
                if (content.includes('@hierarchidb/common-core'))
                    needsCommonCore = true;
                if (content.includes('@hierarchidb/common-type'))
                    needsCommonType = true;
            }
        }
    }
    checkFiles(srcDir);
    // Update dependencies
    if (packageJson.dependencies) {
        if (needsUtil && !packageJson.dependencies['@hierarchidb/util']) {
            packageJson.dependencies['@hierarchidb/util'] = 'workspace:*';
            modified = true;
        }
        if (needsCommonType && !packageJson.dependencies['@hierarchidb/common-type']) {
            packageJson.dependencies['@hierarchidb/common-type'] = 'workspace:*';
            modified = true;
        }
        if (!needsCommonCore && packageJson.dependencies['@hierarchidb/common-core']) {
            delete packageJson.dependencies['@hierarchidb/common-core'];
            modified = true;
        }
    }
    if (modified) {
        fs_1.default.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
        console.log("\u2705 Updated package.json: ".concat(packageJsonPath));
    }
}
function processPackage(packageDir) {
    console.log("\n\uD83D\uDCE6 Processing ".concat(packageDir, "..."));
    // Process all TypeScript files
    function processDirectory(dir) {
        if (!fs_1.default.existsSync(dir))
            return;
        var files = fs_1.default.readdirSync(dir);
        for (var _i = 0, files_2 = files; _i < files_2.length; _i++) {
            var file = files_2[_i];
            var filePath = path_1.default.join(dir, file);
            var stat = fs_1.default.statSync(filePath);
            if (stat.isDirectory() && file !== 'node_modules' && file !== 'dist') {
                processDirectory(filePath);
            }
            else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
                processFile(filePath);
            }
        }
    }
    var srcDir = path_1.default.join(rootDir, packageDir, 'src');
    processDirectory(srcDir);
    // Update package.json
    updatePackageJson(path_1.default.join(rootDir, packageDir));
}
// Main execution
console.log('🚀 Starting refactoring...\n');
for (var _i = 0, packagesToProcess_1 = packagesToProcess; _i < packagesToProcess_1.length; _i++) {
    var packagePath = packagesToProcess_1[_i];
    processPackage(packagePath);
}
// Special handling for ui-core to remove ResourceProjectToggle
var resourceTogglePath = path_1.default.join(rootDir, 'packages/ui/core/src/components/ResourceProjectToggle');
if (fs_1.default.existsSync(resourceTogglePath)) {
    fs_1.default.rmSync(resourceTogglePath, { recursive: true, force: true });
    console.log('\n✅ Removed ResourceProjectToggle from ui-core');
}
// Update ui-core index to remove ResourceProjectToggle export
var uiCoreIndexPath = path_1.default.join(rootDir, 'packages/ui/core/src/index.ts');
if (fs_1.default.existsSync(uiCoreIndexPath)) {
    var content = fs_1.default.readFileSync(uiCoreIndexPath, 'utf-8');
    content = content.replace(/export.*ResourceProjectToggle.*\n/g, '');
    fs_1.default.writeFileSync(uiCoreIndexPath, content);
    console.log('✅ Updated ui-core index.ts');
}
console.log('\n✨ Refactoring complete!');
console.log('\nNext steps:');
console.log('1. Run: pnpm install');
console.log('2. Run: pnpm typecheck');
console.log('3. Run: pnpm build');
