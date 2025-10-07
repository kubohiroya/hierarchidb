#!/usr/bin/env tsx
import { Project, SyntaxKind } from 'ts-morph'
import path from 'node:path'
import fs from 'node:fs'
import globby from 'globby'

type Args = { write: boolean; roots: string[] }

function parseArgs(): Args {
  const args = process.argv.slice(2)
  const out: Args = { write: false, roots: [] }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--write' || a === '-w') out.write = true
    else if (a === '--roots') {
      i++
      for (; i < args.length && !args[i].startsWith('--'); i++) out.roots.push(args[i])
      i--
    }
  }
  if (out.roots.length === 0) out.roots = ['packages']
  return out
}

const EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.mjs', '.cjs'])

const logCodemodWarning = (message: string, error: unknown): void => {
  if (error && typeof (error as NodeJS.ErrnoException).code === 'string' && (error as NodeJS.ErrnoException).code === 'ENOENT') {
    return
  }
  console.warn('[esm-ext-codemod]', message, error)
}

function needsExtension(spec: string): boolean {
  if (!spec.startsWith('.')) return false
  const parsed = path.parse(spec)
  if (parsed.ext) return false
  return true
}

function resolveIndexIfDir(absFrom: string, rel: string): string | null {
  const abs = path.resolve(absFrom, rel)
  try {
    const stat = fs.statSync(abs)
    if (stat.isDirectory()) {
      const idx = ['index.tsx', 'RuntimeWorkerService.ts', 'index.jsx', 'index.js'].find((f) =>
        fs.existsSync(path.join(abs, f))
      )
      if (idx) return rel.replace(/\/$/, '') + (rel.endsWith('/') ? '' : '/') + 'index.js'
    }
  } catch (error) {
    logCodemodWarning(`Failed to resolve directory at ${abs}`, error as unknown)
  }
  return null
}

async function main() {
  const { write, roots } = parseArgs()
  const patterns = roots.map((r) => `${r}/**/*.{ts,tsx}`)
  const files = await globby(patterns, {
    ignore: ['**/*.d.ts', '**/*.test.*', '**/*.spec.*', '**/*.stories.*', '**/node_modules/**', '**/dist/**'],
  })

  const project = new Project({ skipAddingFilesFromTsConfig: true })
  project.addSourceFilesAtPaths(files)

  let changedFiles = 0
  let changedImports = 0

  for (const sf of project.getSourceFiles()) {
    let fileChanged = false
    const dir = path.dirname(sf.getFilePath())

    const update = (spec: string): string | null => {
      if (!needsExtension(spec)) return null
      const maybeIndex = resolveIndexIfDir(dir, spec)
      if (maybeIndex) return maybeIndex
      return spec + '.js'
    }

    const imps = sf.getImportDeclarations()
    for (const imp of imps) {
      const spec = imp.getModuleSpecifierValue()
      const next = update(spec)
      if (next) {
        imp.setModuleSpecifier(next)
        changedImports++
        fileChanged = true
      }
    }
    const exps = sf.getExportDeclarations()
    for (const exp of exps) {
      const spec = exp.getModuleSpecifierValue()
      if (!spec) continue
      const next = update(spec)
      if (next) {
        exp.setModuleSpecifier(next)
        changedImports++
        fileChanged = true
      }
    }

    if (fileChanged) changedFiles++
  }

  if (write) {
    await project.save()
  }

  console.log(`Scanned ${files.length} files`) 
  console.log(`${changedFiles} files need updates, ${changedImports} imports/exports adjusted`)
  if (!write) console.log('Dry run. Re-run with --write to apply changes.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
