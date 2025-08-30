#!/usr/bin/env node

/**
 * Simple PDF generator for HierarchiDB documentation
 * Combines markdown files and creates HTML versions for PDF conversion
 */

import fs from 'fs';
import path from 'path';

// 設定
const DOCS_DIR = 'docs';
const OUTPUT_DIR = path.join(DOCS_DIR, 'pdf');
const REPORT_DIR = path.join(DOCS_DIR, 'REPORT');
const MANUAL_DIR = path.join(DOCS_DIR, 'MANUAL');

// 出力ディレクトリ作成
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// ユーティリティ関数
function readFileIfExists(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch (err) {
        console.warn(`⚠️  File not found: ${filePath}`);
        return '';
    }
}

function generateHTML(title, content) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
        }
        h1, h2, h3, h4, h5, h6 {
            margin-top: 2em;
            margin-bottom: 0.5em;
            border-bottom: 1px solid #eee;
            padding-bottom: 0.3em;
        }
        h1 { color: #2c3e50; }
        h2 { color: #34495e; }
        h3 { color: #7f8c8d; }
        code {
            background-color: #f8f9fa;
            padding: 2px 4px;
            border-radius: 3px;
            font-family: 'Monaco', 'Menlo', monospace;
        }
        pre {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
            border-left: 4px solid #3498db;
        }
        pre code {
            background-color: transparent;
            padding: 0;
        }
        blockquote {
            border-left: 4px solid #3498db;
            margin-left: 0;
            padding-left: 20px;
            color: #666;
        }
        table {
            border-collapse: collapse;
            width: 100%;
            margin: 1em 0;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 8px 12px;
            text-align: left;
        }
        th {
            background-color: #f8f9fa;
            font-weight: 600;
        }
        .page-break {
            page-break-before: always;
        }
        .toc {
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 5px;
            margin-bottom: 30px;
        }
        .toc h2 {
            margin-top: 0;
        }
        .toc ul {
            list-style-type: none;
            padding-left: 0;
        }
        .toc li {
            margin: 5px 0;
        }
        .toc a {
            text-decoration: none;
            color: #3498db;
        }
        .toc a:hover {
            text-decoration: underline;
        }
        .document-header {
            text-align: center;
            border-bottom: 2px solid #3498db;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .document-header h1 {
            margin: 0;
            border: none;
            color: #2c3e50;
        }
        .document-header .subtitle {
            color: #7f8c8d;
            font-size: 1.2em;
            margin-top: 10px;
        }
        .document-header .date {
            color: #95a5a6;
            margin-top: 10px;
        }
        @media print {
            body { margin: 0; }
            .page-break { page-break-before: always; }
        }
    </style>
</head>
<body>
${content}
</body>
</html>`;
}

// REPORT_EN.html の生成
console.log('🔄 Generating REPORT_EN.html...');

let reportContent = `
<div class="document-header">
    <h1>HierarchiDB Development Reports</h1>
    <div class="subtitle">Technical Documentation and Development Results</div>
    <div class="date">${new Date().toLocaleDateString()}</div>
</div>
`;

// Table of Contents
reportContent += `
<div class="toc">
    <h2>Table of Contents</h2>
    <ul>
        <li><a href="#index">1. Development Reports Index</a></li>
        <li><a href="#architecture">2. Technical Architecture Specification</a></li>
        <li><a href="#implementation">3. Implementation Reports</a></li>
        <li><a href="#plugins">4. Plugin Development</a></li>
    </ul>
</div>
`;

// Index
const reportIndex = readFileIfExists(path.join(REPORT_DIR, 'INDEX_EN.md'));
if (reportIndex) {
    reportContent += `
<div class="page-break"></div>
<h1 id="index">Development Reports Index</h1>
${reportIndex.replace(/^# .*$/m, '')}
`;
}

// Technical Architecture
const techArch = readFileIfExists(path.join(REPORT_DIR, 'technical-architecture-specification.md'));
if (techArch) {
    reportContent += `
<div class="page-break"></div>
<h1 id="architecture">Technical Architecture Specification</h1>
${techArch.replace(/^# .*$/m, '')}
`;
}

// Implementation Analysis
const implAnalysis = readFileIfExists(path.join(REPORT_DIR, 'implementation-analysis-report.md'));
if (implAnalysis) {
    reportContent += `
<div class="page-break"></div>
<h1 id="implementation">Implementation Analysis Report</h1>
${implAnalysis.replace(/^# .*$/m, '')}
`;
}

// Plugin Development Guide
const pluginDev = readFileIfExists(path.join(REPORT_DIR, 'development', 'plugin-development-guide.md'));
if (pluginDev) {
    reportContent += `
<div class="page-break"></div>
<h1 id="plugins">Plugin Development Guide</h1>
${pluginDev.replace(/^# .*$/m, '')}
`;
}

// Write REPORT HTML
const reportHTML = generateHTML('HierarchiDB Development Reports', reportContent);
fs.writeFileSync(path.join(OUTPUT_DIR, 'REPORT_EN.html'), reportHTML);

// MANUAL_EN.html の生成
console.log('📚 Generating MANUAL_EN.html...');

let manualContent = `
<div class="document-header">
    <h1>HierarchiDB User Manual</h1>
    <div class="subtitle">Complete User Guide and Reference</div>
    <div class="date">${new Date().toLocaleDateString()}</div>
</div>
`;

// Table of Contents
manualContent += `
<div class="toc">
    <h2>Table of Contents</h2>
    <ul>
        <li><a href="#index">1. User Manual Index</a></li>
        <li><a href="#overview">2. System Overview</a></li>
        <li><a href="#concepts">3. Basic Concepts</a></li>
        <li><a href="#operations">4. Core Operations</a></li>
        <li><a href="#plugins">5. Plugin System</a></li>
        <li><a href="#development">6. Development Environment</a></li>
    </ul>
</div>
`;

// Index
const manualIndex = readFileIfExists(path.join(MANUAL_DIR, 'INDEX_EN.md'));
if (manualIndex) {
    manualContent += `
<div class="page-break"></div>
<h1 id="index">User Manual Index</h1>
${manualIndex.replace(/^# .*$/m, '')}
`;
}

// 主要マニュアル文書を追加
const manualFiles = [
    { id: 'overview', file: '01-overview.md', title: 'System Overview' },
    { id: 'concepts', file: '01-concepts.md', title: 'Basic Concepts' },
    { id: 'operations', file: '03-core-operations.md', title: 'Core Operations' },
    { id: 'plugins', file: '04-plugin-architecture.md', title: 'Plugin System' },
    { id: 'development', file: '05-dev-environment.md', title: 'Development Environment' }
];

manualFiles.forEach(({ id, file, title }) => {
    const content = readFileIfExists(path.join(MANUAL_DIR, file));
    if (content) {
        manualContent += `
<div class="page-break"></div>
<h1 id="${id}">${title}</h1>
${content.replace(/^# .*$/m, '')}
`;
    }
});

// Write MANUAL HTML
const manualHTML = generateHTML('HierarchiDB User Manual', manualContent);
fs.writeFileSync(path.join(OUTPUT_DIR, 'MANUAL_EN.html'), manualHTML);

console.log('✅ HTML generation completed!');
console.log('📄 Generated files:');
console.log(`   - ${path.join(OUTPUT_DIR, 'REPORT_EN.html')}`);
console.log(`   - ${path.join(OUTPUT_DIR, 'MANUAL_EN.html')}`);
console.log('');
console.log('💡 To convert to PDF, you can:');
console.log('   1. Open the HTML files in a browser');
console.log('   2. Use "Print to PDF" feature');
console.log('   3. Or use tools like wkhtmltopdf or puppeteer');