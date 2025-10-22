#!/usr/bin/env node
/**
 * Script: tools/tsconfig-set-nodenext.mjs
 * Purpose: bulk-update tsconfig files so `module`/`moduleResolution` are
 * switched to NodeNext during the repository-wide ESM migration.
 * Invocation: run from repo root via
 * `node tools/tsconfig-set-nodenext.mjs [roots...]` when aligning configs; used
 * historically by the NodeNext migration tasks recorded in TASKS.md.
 * Output: rewrites matching `tsconfig*.json` files in-place. No extra artefacts
 * are created beyond the edited JSON files.
 */
import fs from 'node:fs'
import path from 'node:path'
import { globby } from 'globby'
import ts from 'typescript'

const roots = process.argv.slice(2)
const patterns = (roots.length ? roots : ['.', 'packages', 'plugins']).map((r) =>
  r.endsWith('.json') ? r : path.posix.join(r.replace(/\\/g, '/'), '**/tsconfig*.json')
)
const files = await globby(patterns, {
  ignore: ['**/node_modules/**', '**/dist/**'],
})

let changed = 0
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8')
  const parsed = ts.parseConfigFileTextToJson(file, text)
  if (parsed.error) {
    console.warn('skip (parse error):', file)
    continue
  }
  const json = parsed.config ?? {}
  json.compilerOptions = json.compilerOptions || {}
  let touched = false
  if (json.compilerOptions.module !== 'NodeNext') {
    json.compilerOptions.module = 'NodeNext'
    touched = true
  }
  if (json.compilerOptions.moduleResolution !== 'NodeNext') {
    json.compilerOptions.moduleResolution = 'NodeNext'
    touched = true
  }
  if (!touched) continue
  const output = JSON.stringify(json, null, 2) + '\n'
  fs.writeFileSync(file, output, 'utf8')
  changed++
}
console.log(`Updated ${changed} tsconfig files to module="NodeNext"`)
