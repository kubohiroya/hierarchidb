# rel2abs

`@hierarchidb/tools-rel2abs` is a workspace CLI that rewrites some relative imports to a `~`-prefixed absolute import style.

## Purpose

This tool helps reduce complex relative paths in `import` statements.

Input:

- Root directory passed as CLI argument
- Target files: `*.ts`, `*.js`, `*.tsx`, `*.jsx`, `*.json`

Output:

- `../` imports are rewritten to `~/<path from scope root>`
  - In `packages/*`, `plugins/*`, scope root is the package root.
  - In `app`, scope root is `app/src`.
- `./` imports are kept as-is (local relative path exception)
- File extensions such as `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs` are stripped
- Only imports that resolve inside the target package are rewritten
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
- `new URL("...", import.meta.url)` expressions

## Conversion rules

- Converts only relative module specifiers that navigate outside the current directory:
  - `../bar`
- Leaves non-relative references unchanged:
  - `@scope/pkg`
- `~/*` aliases are resolved from the nearest scope root:
  - package scopes (`packages/*`, `plugins/*`) resolve from package root
  - `app` resolves from `app/src`
- You can also import package-root files directly, e.g. `~/package.json`
- absolute path imports
- Rewrites only files under the provided root directory
- Skips:
  - `node_modules`
  - `dist`
  - hidden directories (name starts with `.`)

The tool intentionally skips conversions under the following runtime contexts:

- `new URL("...", import.meta.url)`
  - e.g. `new URL("../worker.js", import.meta.url)` is kept unchanged.
- `new Worker("...")` and `new Worker(...)` overload variants
  - The string argument is not rewritten when it is an argument to `new Worker(...)`.
- `Comlink.wrap(...)`
  - `wrap` calls where the member access base resolves to `Comlink` (for example `Comlink.wrap(...)`, `SomeNamespace.Comlink.wrap(...)`) keep their argument strings unchanged.

Dynamic import (`import("...")`) is intentionally still rewritten when the argument is a rewritable relative specifier, and no special skip rule is applied.

If you need to preserve a specific dynamic import string from rewriting in a special case, pass that file through an explicit ignore list in the CI process for now (tool-level exclusion is currently only for the contexts above).

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
