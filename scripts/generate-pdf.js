#!/usr/bin/env node

/**
 * PDF Generation Script for HierarchiDB Documentation
 * Generates PDF documentation in both Japanese and English
 * 
 * PREREQUISITES:
 * This script requires global installation of the following packages:
 *   npm install -g highlight.js markdown-it puppeteer
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Markdown renderer with syntax highlighting
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value;
      } catch (__) {}
    }
    return '';
  }
});

/**
 * HTML template for PDF generation
 */
const htmlTemplate = (content, title, isJapanese = false) => `
<!DOCTYPE html>
<html lang="${isJapanese ? 'ja' : 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&family=Roboto:wght@400;700&family=Roboto+Mono&display=swap');
    
    body {
      font-family: ${isJapanese ? '"Noto Sans JP", "Hiragino Sans", sans-serif' : '"Roboto", sans-serif'};
      line-height: 1.6;
      color: #333;
      max-width: 210mm;
      margin: 0 auto;
      padding: 20mm;
      font-size: 11pt;
    }
    
    h1 {
      color: #2c3e50;
      border-bottom: 3px solid #3498db;
      padding-bottom: 10px;
      margin-top: 0;
      page-break-after: avoid;
      font-size: 24pt;
    }
    
    h2 {
      color: #34495e;
      border-bottom: 2px solid #95a5a6;
      padding-bottom: 5px;
      margin-top: 30px;
      page-break-after: avoid;
      font-size: 18pt;
    }
    
    h3 {
      color: #34495e;
      margin-top: 25px;
      page-break-after: avoid;
      font-size: 14pt;
    }
    
    h4 {
      color: #34495e;
      margin-top: 20px;
      page-break-after: avoid;
      font-size: 12pt;
    }
    
    code {
      background-color: #f4f4f4;
      padding: 2px 5px;
      border-radius: 3px;
      font-family: 'Roboto Mono', 'Courier New', monospace;
      font-size: 9pt;
    }
    
    pre {
      background-color: #f8f8f8;
      border: 1px solid #ddd;
      border-radius: 5px;
      padding: 15px;
      overflow-x: auto;
      page-break-inside: avoid;
      font-size: 9pt;
      line-height: 1.4;
    }
    
    pre code {
      background-color: transparent;
      padding: 0;
    }
    
    blockquote {
      border-left: 4px solid #3498db;
      padding-left: 15px;
      margin-left: 0;
      color: #666;
      font-style: italic;
    }
    
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 20px 0;
      page-break-inside: avoid;
    }
    
    th, td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    
    th {
      background-color: #f4f4f4;
      font-weight: bold;
    }
    
    ul, ol {
      margin-left: 20px;
    }
    
    li {
      margin: 5px 0;
    }
    
    a {
      color: #3498db;
      text-decoration: none;
    }
    
    .page-break {
      page-break-after: always;
    }
    
    .toc {
      background-color: #f9f9f9;
      border: 1px solid #ddd;
      padding: 20px;
      margin: 20px 0;
      border-radius: 5px;
    }
    
    .toc h2 {
      margin-top: 0;
      border: none;
      color: #2c3e50;
    }
    
    .toc ul {
      list-style: none;
      padding-left: 0;
    }
    
    .toc ul ul {
      padding-left: 20px;
    }
    
    .toc a {
      color: #333;
      text-decoration: none;
    }
    
    .toc a:hover {
      color: #3498db;
    }
    
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      text-align: center;
      color: #666;
      font-size: 9pt;
    }
    
    @media print {
      body {
        padding: 0;
      }
      
      .page-break {
        page-break-after: always;
      }
      
      h1, h2, h3, h4 {
        page-break-after: avoid;
      }
      
      pre, table, blockquote {
        page-break-inside: avoid;
      }
    }
    
    /* Syntax highlighting */
    .hljs {
      display: block;
      overflow-x: auto;
      padding: 0.5em;
      background: #f8f8f8;
    }
    
    .hljs-keyword { color: #8b008b; font-weight: bold; }
    .hljs-string { color: #008000; }
    .hljs-number { color: #0000ff; }
    .hljs-comment { color: #808080; font-style: italic; }
    .hljs-function { color: #0000ff; }
    .hljs-class { color: #0000ff; font-weight: bold; }
    .hljs-variable { color: #a0522d; }
    .hljs-type { color: #2b91af; }
  </style>
</head>
<body>
  ${content}
  <div class="footer">
    <p>HierarchiDB Documentation - Generated on ${new Date().toLocaleDateString()}</p>
  </div>
</body>
</html>
`;

/**
 * Generate table of contents from markdown headings
 */
function generateTOC(content) {
  const headings = [];
  const lines = content.split('\n');
  
  for (const line of lines) {
    const h1Match = line.match(/^# (.+)$/);
    const h2Match = line.match(/^## (.+)$/);
    const h3Match = line.match(/^### (.+)$/);
    
    if (h1Match) {
      headings.push({ level: 1, text: h1Match[1] });
    } else if (h2Match) {
      headings.push({ level: 2, text: h2Match[1] });
    } else if (h3Match) {
      headings.push({ level: 3, text: h3Match[1] });
    }
  }
  
  let toc = '# Table of Contents\n\n';
  for (const heading of headings) {
    const indent = '  '.repeat(heading.level - 1);
    toc += `${indent}- ${heading.text}\n`;
  }
  
  return toc + '\n\n';
}

/**
 * Collect all markdown files from a directory
 */
async function collectMarkdownFiles(dir, pattern = '*.md') {
  const files = [];
  
  async function walkDir(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip node_modules and hidden directories
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          await walkDir(fullPath);
        }
      } else if (entry.name.endsWith('.md')) {
        const relativePath = path.relative(dir, fullPath);
        files.push({ path: fullPath, relative: relativePath });
      }
    }
  }
  
  await walkDir(dir);
  return files.sort((a, b) => a.relative.localeCompare(b.relative));
}

/**
 * Combine multiple markdown files into a single document
 */
async function combineMarkdownFiles(files, baseDir) {
  let combined = '';
  
  for (const file of files) {
    const content = await fs.readFile(file.path, 'utf-8');
    
    // Add section header with file path
    combined += `\n\n<!-- File: ${file.relative} -->\n`;
    combined += `<div class="page-break"></div>\n\n`;
    
    // Add content
    combined += content;
  }
  
  return combined;
}

/**
 * Generate PDF from markdown content
 */
async function generatePDF(markdownContent, outputPath, title, isJapanese = false) {
  // Add TOC
  const toc = generateTOC(markdownContent);
  const fullContent = toc + markdownContent;
  
  // Convert markdown to HTML
  const htmlContent = md.render(fullContent);
  const html = htmlTemplate(htmlContent, title, isJapanese);
  
  // Save HTML for debugging
  const htmlPath = outputPath.replace('.pdf', '.html');
  await fs.writeFile(htmlPath, html);
  
  // Launch Puppeteer and generate PDF
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    // Generate PDF with options
    await page.pdf({
      path: outputPath,
      format: 'A4',
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="font-size: 9pt; width: 100%; text-align: center; color: #666;">
          ${title}
        </div>
      `,
      footerTemplate: `
        <div style="font-size: 9pt; width: 100%; text-align: center; color: #666;">
          Page <span class="pageNumber"></span> of <span class="totalPages"></span>
        </div>
      `
    });
    
    console.log(`✅ PDF generated: ${outputPath}`);
  } finally {
    await browser.close();
  }
}

/**
 * Main function to generate all PDFs
 */
async function main() {
  // Ensure output directory exists
  const pdfDir = path.join(rootDir, 'docs', 'pdf');
  await fs.mkdir(pdfDir, { recursive: true });
  
  // Documentation sets to generate
  const docSets = [
    {
      name: 'manual-user-ja',
      title: 'HierarchiDB ユーザーマニュアル',
      source: path.join(rootDir, 'docs', 'MANUAL-USER'),
      output: path.join(pdfDir, 'HierarchiDB-User-Manual-JA.pdf'),
      isJapanese: true
    },
    {
      name: 'manual-technical-en',
      title: 'HierarchiDB Technical Manual',
      source: path.join(rootDir, 'docs', 'MANUAL'),
      output: path.join(pdfDir, 'HierarchiDB-Technical-Manual-EN.pdf'),
      isJapanese: false
    },
    {
      name: 'report-developer-en',
      title: 'HierarchiDB Developer Report',
      source: path.join(rootDir, 'docs', 'REPORT'),
      output: path.join(pdfDir, 'HierarchiDB-Developer-Report-EN.pdf'),
      isJapanese: false
    }
  ];
  
  // Generate each PDF
  for (const docSet of docSets) {
    console.log(`\n📚 Generating ${docSet.name}...`);
    
    try {
      // Collect markdown files
      const files = await collectMarkdownFiles(docSet.source);
      console.log(`  Found ${files.length} markdown files`);
      
      // Combine files
      const combined = await combineMarkdownFiles(files, docSet.source);
      
      // Generate PDF
      await generatePDF(combined, docSet.output, docSet.title, docSet.isJapanese);
      
    } catch (error) {
      console.error(`❌ Error generating ${docSet.name}:`, error);
    }
  }
  
  console.log('\n✨ PDF generation complete!');
  console.log(`📁 PDFs saved to: ${pdfDir}`);
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(console.error);
}

export { generatePDF, collectMarkdownFiles, combineMarkdownFiles };