#!/usr/bin/env node
/*
  Analyze docs in SS-MMM-title.md format under ./docs
  - Sorts by filename
  - Extracts title and headings
  - Builds keyword sets from content (simple tokenizer with JP/EN stopwords)
  - Computes similarity between adjacent files to flag potential gaps/redundancies
  - Checks presence of common sections
  - Outputs a report to console and docs/_analysis.md
*/

const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(process.cwd(), 'docs');
const OUTPUT_MD = path.join(DOCS_DIR, '_analysis.md');

function listDocs() {
  const all = fs.readdirSync(DOCS_DIR);
  const re = /^(\d{2})-(\d{3})-.+\.md$/;
  return all
    .filter((f) => re.test(f))
    .sort((a, b) => a.localeCompare(b, 'en'))
    .map((f) => ({ file: f, full: path.join(DOCS_DIR, f) }));
}

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

function extractTitleAndHeadings(md) {
  const lines = md.split(/\r?\n/);
  let title = null;
  const headings = [];
  for (const line of lines) {
    const m = /^(#{1,6})\s*(.+?)\s*$/.exec(line);
    if (m) {
      const level = m[1].length;
      const text = m[2].trim();
      headings.push({ level, text });
      if (!title && level === 1) title = text;
    }
  }
  return { title, headings };
}

const EN_STOP = new Set([
  'the','and','or','a','an','to','of','in','on','for','with','by','is','are','be','as','at','from','that','this','it','its','into','can','will','should','may','not','if','when','how','what','why','we','you','they','their','our','your','these','those','also','but','than','then','so','such','use','used','using','about','over','more','most','each','per','via','e.g','i.e','etc','vs','based','through','across','up','out','new','old','one','two','three','into','able','unable','set','get','put','make','made','like'
]);

// Minimal JP stop words / common section words
const JP_STOP = new Set([
  'こと','ため','よう','もの','それ','これ','あれ','など','また','および','おける','における','について','に対して','により','から','まで','ので','のである','です','ます','いる','ある','された','する','した','して','おく','できる','でき','場合','例','例え','対象','全体','概要','目的','背景','利点','課題','移行','基準','受け入れ','導入','注意','参考','補足','定義','用語'
]);

function tokenize(text) {
  // Remove code blocks fenced by triple backticks to avoid noise
  text = text.replace(/```[\s\S]*?```/g, ' ');
  // Keep Japanese characters and alphanumerics
  const tokens = [];
  // Split by non-word but keep CJK sequences
  const cjkRegex = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]+|[A-Za-z][A-Za-z\-]+|[A-Za-z]+|[0-9]{2,}/g;
  const matches = text.match(cjkRegex) || [];
  for (let t of matches) {
    t = t.toLowerCase();
    if (/^[a-z\-]{1,2}$/.test(t)) continue; // too short
    if (/^[0-9]+$/.test(t)) continue; // numbers only
    if (EN_STOP.has(t)) continue;
    if (JP_STOP.has(t)) continue;
    // drop single-character Japanese tokens
    if (t.length < 2) continue;
    tokens.push(t);
  }
  return tokens;
}

function topKeywords(tokens, k = 20) {
  const freq = new Map();
  for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1);
  // Remove extremely frequent tokens that look like boilerplate
  const entries = [...freq.entries()].sort((a,b)=>b[1]-a[1]);
  const top = entries.slice(0, k);
  return top.map(([t]) => t);
}

function jaccard(a, b) {
  const A = new Set(a), B = new Set(b);
  const inter = new Set([...A].filter(x => B.has(x)));
  const union = new Set([...A, ...B]);
  if (union.size === 0) return 0;
  return inter.size / union.size;
}

function sectionPresence(headings) {
  const wanted = ['概要','目的','背景','アーキテクチャ','設計','実装','例','エッジケース','データフロー','受け入れ基準','利点','移行'];
  const present = new Set(headings.map(h => h.text.replace(/\s+/g,'').toLowerCase()));
  const result = {};
  for (const w of wanted) {
    const key = w.toLowerCase();
    result[w] = [...present].some(h => h.includes(key));
  }
  return result;
}

function analyze() {
  const docs = listDocs();
  if (docs.length === 0) {
    console.error('No docs found in SS-MMM-title.md format in ./docs');
    process.exit(1);
  }

  const items = docs.map((d) => {
    const md = readFileSafe(d.full);
    const { title, headings } = extractTitleAndHeadings(md);
    const tokens = tokenize(md);
    const keywords = topKeywords(tokens, 25);
    const sections = sectionPresence(headings);
    return { ...d, title: title || d.file.replace(/\.md$/, ''), headings, keywords, sections };
  });

  // Similarities between neighbors
  const analyses = items.map((item, idx) => {
    const prev = idx > 0 ? items[idx - 1] : null;
    const next = idx < items.length - 1 ? items[idx + 1] : null;
    const simPrev = prev ? jaccard(item.keywords, prev.keywords) : null;
    const simNext = next ? jaccard(item.keywords, next.keywords) : null;

    // Heuristics
    const flags = [];
    if (simPrev !== null && simPrev < 0.05) flags.push('LOW_SIM_WITH_PREV (possible gap)');
    if (simPrev !== null && simPrev > 0.6) flags.push('HIGH_SIM_WITH_PREV (possible redundancy)');
    if (simNext !== null && simNext < 0.05) flags.push('LOW_SIM_WITH_NEXT (possible gap)');
    if (simNext !== null && simNext > 0.6) flags.push('HIGH_SIM_WITH_NEXT (possible redundancy)');

    const missingSections = Object.entries(item.sections)
      .filter(([_, v]) => !v)
      .map(([k]) => k);

    return { item, prev, next, simPrev, simNext, flags, missingSections };
  });

  // Output
  const lines = [];
  lines.push('# Docs Flow Analysis');
  lines.push('');
  lines.push(`Analyzed at: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('Heuristics:');
  lines.push('- Similarity = Jaccard on top 25 keywords (after simple tokenization)');
  lines.push('- LOW_SIM threshold < 0.05; HIGH_SIM threshold > 0.60');
  lines.push('- Missing sections are suggestions for completeness, not strict requirements');
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const a of analyses) {
    const { item, prev, next, simPrev, simNext, flags, missingSections } = a;
    lines.push(`## ${item.file}`);
    lines.push(`Title: ${item.title}`);
    if (prev) lines.push(`Prev: ${prev.file} | Similarity: ${simPrev?.toFixed(3)}`);
    if (next) lines.push(`Next: ${next.file} | Similarity: ${simNext?.toFixed(3)}`);
    if (flags.length) lines.push(`Flags: ${flags.join(', ')}`);
    if (missingSections.length) lines.push(`Suggested sections to consider adding: ${missingSections.join(', ')}`);
    // Show a small set of keywords
    lines.push(`Keywords: ${item.keywords.slice(0, 12).join(', ')}`);
    // Show top-level headings outline
    const h1 = item.headings.filter(h => h.level <= 2).map(h => `${'#'.repeat(h.level)} ${h.text}`);
    if (h1.length) {
      lines.push('Outline (H1/H2):');
      for (const h of h1) lines.push(`- ${h}`);
    }
    lines.push('');
  }

  const out = lines.join('\n');
  fs.writeFileSync(OUTPUT_MD, out, 'utf8');
  console.log(out);
  console.log(`\nReport written to: ${path.relative(process.cwd(), OUTPUT_MD)}`);
}

if (require.main === module) {
  analyze();
}
