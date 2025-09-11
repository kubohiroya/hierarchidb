#!/usr/bin/env node
import fs from 'node:fs';

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field.trim()); field = ''; }
      else if (c === '\n') { row.push(field.trim()); rows.push(row); row = []; field = ''; }
      else if (c === '\r') { /* ignore */ }
      else { field += c; }
    }
  }
  if (field.length || row.length) { row.push(field.trim()); rows.push(row); }
  return rows;
}

const csv = fs.readFileSync('TASKS.csv','utf8');
const rows = parseCSV(csv);
const header = rows.shift();
const idx = Object.fromEntries(header.map((h,i)=>[h,i]));

const md = fs.readFileSync('TASKS.md','utf8');
const doneStart = md.indexOf('### Done');
const doneText = doneStart >= 0 ? md.slice(doneStart) : '';

const hits = [];
for (let ln=2; ln<rows.length+2; ln++){
  const r = rows[ln-2];
  const branch = r[idx.branch]||''; const slug = r[idx.slug]||''; const desc = r[idx.description]||'';
  const inDone = (branch && doneText.includes(branch)) || (slug && doneText.toLowerCase().includes(slug.toLowerCase()));
  const inFile = (branch && md.includes(branch)) || (slug && md.toLowerCase().includes(slug.toLowerCase()));
  hits.push({ line: ln, branch, slug, inDone, inFile });
}

const doneLines = hits.filter(h=>h.inDone).map(h=>h.line);
console.log(JSON.stringify({ candidates_done: doneLines, details: hits }, null, 2));

