# rel2abs

`@hierarchidb/tools-rel2abs` is a workspace CLI that rewrites relative imports to a `~`-prefixed absolute import style.

## Purpose

This tool helps reduce complex relative paths in `import` statements.

Input:

- Root directory passed as CLI argument
- Target files: `*.ts`, `*.js`, `*.tsx`, `*.jsx`, `*.json`

Output:

- `./` and `../` imports are rewritten to `~/<path from root>`
- File extensions such as `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs` are stripped
- Only imports that resolve inside the target root are rewritten
- No file is modified in dry-run mode

## Installation / location

The package is located at:

- `packages/tools/rel2abs`

It is included as a sub-workspace under `packages/tools`.

## Usage

Run from repository root:

```bash
pnpm --filter @hierarchidb/tools-rel2abs run rel2abs <directory> [--dry-run]
```

Examples:

```bash
cd /Users/hiroya/WebstormProjects/hierarchidb/packages/tools/rel2abs
pnpm run rel2abs /Users/hiroya/WebstormProjects/hierarchidb/packages/util/src --dry-run

pnpm --filter @hierarchidb/tools-rel2abs run rel2abs /Users/hiroya/WebstormProjects/hierarchidb/plugins/shape-plugin/src
```

## Supported syntaxes

The tool rewrites module specifiers in:

- `import` declarations
- `export ... from` declarations
- `import = require`-style external module references
- dynamic `import("...")` expressions

## Conversion rules

- Converts only relative module specifiers:
  - `./foo`
  - `../bar`
- Leaves non-relative references unchanged:
  - `@scope/pkg`
- `~/foo` style aliases
- absolute path imports
- Rewrites only files under the provided root directory
- Skips:
  - `node_modules`
  - `dist`
  - hidden directories (name starts with `.`)

## Output format in `--dry-run`

For each replaced import, one line is printed:

- file path
- line number
- `before => after`

At the end of execution, the tool prints the total count of replacements and affected files.

## How to run with review first

1. Run with `--dry-run` and inspect changes.
2. If the output is correct, run without `--dry-run`.
3. Verify alias resolution in your package `tsconfig.json` (example: `~/*` path mapping).

## Notes

`--dry-run` does not write to disk.

The build step keeps `node_modules` untouched and only bundles this CLI for execution.

### Command entrypoints

- package script: `rel2abs`
- binary: `dist/rel2abs.js` (generated)
