#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { globby } from 'globby'

const roots = process.argv.slice(2)
const patterns = (roots.length ? roots : ['packages']).map((r) => `${r}/**/tsconfig*.json`)
const files = await globby(patterns, {
  ignore: ['**/node_modules/**', '**/dist/**'],
})

let changed = 0
for (const file of files) {
  // skip base and custom
  const base = path.basename(file)
  if (base === 'tsconfig.esm-nodenext.json' || base === 'tsconfig.base.json') continue
  const raw = fs.readFileSync(file, 'utf8')
  let stripped = raw
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
    .replace(/^\s*\/\/.*$/gm, '') // line comments
  // remove trailing commas before } or ]
  stripped = stripped.replace(/,\s*(?=[}\]])/g, '')
  let json
  try {
    json = JSON.parse(stripped)
  } catch (e) {
    console.warn('Skip (parse error):', file)
    continue
  }
  json.compilerOptions = json.compilerOptions || {}
  let touched = false
  if (json.compilerOptions.module !== 'Node16') {
    json.compilerOptions.module = 'Node16'
    touched = true
  }
  if (json.compilerOptions.module === 'Node16') {
    if (json.compilerOptions.moduleResolution !== 'Node16') {
      json.compilerOptions.moduleResolution = 'Node16'
      touched = true
    }
  }
  if (touched) {
    fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n', 'utf8')
    changed++
  }
}
console.log(`Updated ${changed} tsconfig files to module=Node16`)
