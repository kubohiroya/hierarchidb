#!/usr/bin/env node
import fs from 'node:fs'
import { globby } from 'globby'
import path from 'node:path'

const roots = process.argv.slice(2)
const patterns = (roots.length ? roots : ['packages']).map((r) => `${r}/**/tsconfig*.json`)
const files = await globby(patterns, { ignore: ['**/node_modules/**', '**/dist/**'] })
let changed = 0

for (const file of files) {
  const base = path.basename(file)
  if (base === 'tsconfig.base.json' || base === 'tsconfig.esm-node16.json') continue
  const raw = fs.readFileSync(file, 'utf8')
  let stripped = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  stripped = stripped.replace(/,\s*(?=[}\]])/g, '')
  let json
  try { json = JSON.parse(stripped) } catch { continue }
  json.compilerOptions = json.compilerOptions || {}
  let touch = false
  if (json.compilerOptions.module && json.compilerOptions.module !== 'ESNext') {
    json.compilerOptions.module = 'ESNext'
    touch = true
  }
  if (json.compilerOptions.moduleResolution && json.compilerOptions.moduleResolution !== 'node') {
    json.compilerOptions.moduleResolution = 'node'
    touch = true
  }
  if (touch) {
    fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n', 'utf8')
    changed++
  }
}
console.log(`Reset ${changed} tsconfig files to module=ESNext, moduleResolution=node`)

