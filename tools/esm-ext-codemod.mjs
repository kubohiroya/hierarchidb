#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { globby } from 'globby'

const args = process.argv.slice(2)
let write = false
let includeStories = false
let includeTests = false
const roots = []
for (let i = 0; i < args.length; i++) {
  const a = args[i]
  if (a === '--write' || a === '-w') write = true
  else if (a === '--include-stories') includeStories = true
  else if (a === '--include-tests') includeTests = true
  else if (a === '--roots') {
    i++
    for (; i < args.length && !args[i].startsWith('--'); i++) roots.push(args[i])
    i--
  }
}
if (roots.length === 0) roots.push('packages')

const IGNORE = ['**/*.d.ts', '**/node_modules/**', '**/dist/**']
if (!includeTests) IGNORE.push('**/*.test.*', '**/*.spec.*')
if (!includeStories) IGNORE.push('**/*.stories.*')
const EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.mjs', '.cjs'])

const patterns = roots.map((r) => `${r}/**/*.{ts,tsx}`)
const files = await globby(patterns, { ignore: IGNORE })

let changedFiles = 0
let changedImports = 0

function needsExtension(spec) {
  if (!spec.startsWith('.')) return false
  const parsed = path.parse(spec)
  // If there's no extension or it's a pseudo-extension like ".types",
  // we still need to append ".js" for Node16 ESM resolution.
  if (!parsed.ext) return true
  // Don't touch style or asset imports
  if (spec.endsWith('.css') || spec.includes('.module.css')) return false
  if (!EXTS.has(parsed.ext)) return true
  return false
}

function resolveIndexIfDir(absFrom, rel) {
  const abs = path.resolve(absFrom, rel)
  try {
    const stat = fs.statSync(abs)
    if (stat.isDirectory()) {
      const idx = ['index.tsx', 'index.ts', 'index.jsx', 'index.js'].find((f) =>
        fs.existsSync(path.join(abs, f))
      )
      if (idx) return rel.replace(/\/$/, '') + (rel.endsWith('/') ? '' : '/') + 'index.js'
    }
  } catch {}
  return null
}

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8')
  const dir = path.dirname(file)
  let out = src
  let fileChanged = false

  const re = /(import\s+[^'"\n]+from\s+|export\s+[^'"\n]*from\s+|export\s+\*\s+from\s+)(["'])([^"']+)(\2)/g
  out = out.replace(re, (m, prefix, q, spec, q2) => {
    if (!needsExtension(spec)) return m
    let next = resolveIndexIfDir(dir, spec)
    if (!next) next = spec + '.js'
    changedImports++
    fileChanged = true
    return `${prefix}${q}${next}${q2}`
  })

  // Second pass: handle multiline exports/imports where 'from' is on a different line
  const re2 = /from\s+(["'])(\.[^"']+)(\1)/g
  out = out.replace(re2, (m, q, spec, q2) => {
    if (!needsExtension(spec)) return m
    let next = resolveIndexIfDir(dir, spec)
    if (!next) next = spec + '.js'
    changedImports++
    fileChanged = true
    return `from ${q}${next}${q2}`
  })

  // Third pass: handle dynamic imports import('...')
  const re3 = /import\s*\(\s*(["'])(\.[^"']+)(\1)\s*\)/g
  out = out.replace(re3, (m, q, spec, q2) => {
    if (!needsExtension(spec)) return m
    let next = resolveIndexIfDir(dir, spec)
    if (!next) next = spec + '.js'
    changedImports++
    fileChanged = true
    return `import(${q}${next}${q2})`
  })

  if (fileChanged) {
    changedFiles++
    if (write) fs.writeFileSync(file, out, 'utf8')
  }
}

console.log(`Scanned ${files.length} files`)
console.log(`${changedFiles} files need updates, ${changedImports} imports/exports adjusted`)
if (!write) console.log('Dry run. Re-run with --write to apply changes.')
