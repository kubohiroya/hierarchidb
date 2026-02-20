import fs from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"
import ts from "typescript"

type CliArgs = {
  rootDir: string
  dryRun: boolean
}

type ChangeEntry = {
  line: number
  before: string
  after: string
}

type FileChange = {
  filePath: string
  changes: ChangeEntry[]
  rewrittenText: string
}

const TARGET_EXTENSIONS = new Set([".ts", ".js", ".tsx", ".jsx", ".json"])
const KNOWN_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json"])

function printHelp(): void {
  console.log("Usage: pnpm run rel2abs <directory> [--dry-run]")
  console.log("  --dry-run  Show intended changes without writing files")
}

function parseArgs(argv: string[]): CliArgs {
  const options = new Set(argv)
  const positional = argv.filter((value) => !value.startsWith("-"))

  if (options.has("--help") || options.has("-h")) {
    printHelp()
    process.exit(0)
  }

  if (positional.length !== 1) {
    printHelp()
    throw new Error("Error: target directory is required")
  }

  return {
    rootDir: path.resolve(positional[0] ?? ""),
    dryRun: options.has("--dry-run") || options.has("-d"),
  }
}

function toPosix(p: string): string {
  return p.split(path.sep).join("/")
}

function stripKnownExtension(importPath: string): string {
  for (const ext of KNOWN_EXTENSIONS) {
    if (importPath.endsWith(ext)) {
      return importPath.slice(0, -ext.length)
    }
  }
  return importPath
}

const SCOPE_DIRECTORIES = new Set(["packages", "plugins"])

const packageRootCache = new Map<string, string | null>()

function getPackageRoot(sourceFilePath: string, rootDir: string): string | null {
  const cached = packageRootCache.get(sourceFilePath)
  if (cached !== undefined) {
    return cached
  }

  let current = path.dirname(sourceFilePath)
  const resolvedRoot = path.resolve(rootDir)

  while (true) {
    if (existsSync(path.join(current, "package.json"))) {
      const packageRoot = current
      packageRootCache.set(sourceFilePath, packageRoot)
      return packageRoot
    }

    const parent = path.dirname(current)
    if (current === parent || !parent.startsWith(resolvedRoot)) {
      packageRootCache.set(sourceFilePath, null)
      return null
    }

    current = parent
  }
}

function getPackageScopePrefix(sourceFilePath: string, rootDir: string): string | null {
  const packageRoot = getPackageRoot(sourceFilePath, rootDir)
  if (packageRoot === null) {
    return null
  }

  let current = path.dirname(packageRoot)
  const resolvedRoot = path.resolve(rootDir)

  while (true) {
    const basename = path.basename(current)
    if (SCOPE_DIRECTORIES.has(basename)) {
      return toPosix(path.relative(current, packageRoot))
    }

    const parent = path.dirname(current)
    if (current === parent || !parent.startsWith(resolvedRoot)) {
      return null
    }

    current = parent
  }
}

const packageScopePrefixCache = new Map<string, string | null>()

function getPackageScopePrefixCached(sourceFilePath: string, rootDir: string): string | null {
  const key = `${sourceFilePath}::${path.resolve(rootDir)}`
  const cached = packageScopePrefixCache.get(key)
  if (cached !== undefined) {
    return cached
  }

  const prefix = getPackageScopePrefix(sourceFilePath, rootDir)
  packageScopePrefixCache.set(key, prefix)
  return prefix
}

function getAppScopeRoot(sourceFilePath: string): string | null {
  let current = path.dirname(sourceFilePath)

  while (true) {
    const basename = path.basename(current)
    if (basename === "src" && path.basename(path.dirname(current)) === "app") {
      return current
    }

    const parent = path.dirname(current)
    if (current === parent) {
      return null
    }
    current = parent
  }
}

function toLegacyAbsoluteAlias(
  moduleSpecifier: string,
  sourceFilePath: string,
  rootDir: string,
): string | null {
  const appScopeRoot = getAppScopeRoot(sourceFilePath)
  if (appScopeRoot !== null) {
    const appPrefix = "~/"
    if (!moduleSpecifier.startsWith(appPrefix)) {
      return null
    }
    return `~/${stripKnownExtension(moduleSpecifier.slice(appPrefix.length))}`
  }

  const prefix = getPackageScopePrefixCached(sourceFilePath, rootDir)
  if (prefix === null || prefix.length === 0) {
    return null
  }

  const legacyPrefix = `~/${prefix}/`
  if (!moduleSpecifier.startsWith(legacyPrefix)) {
    return null
  }

  return `~/${stripKnownExtension(moduleSpecifier.slice(legacyPrefix.length))}`
}

function isRelativeImport(moduleSpecifier: string): boolean {
  return moduleSpecifier.startsWith("./") || moduleSpecifier.startsWith("../")
}

function isKeepAsRelativeImport(moduleSpecifier: string): boolean {
  return moduleSpecifier.startsWith("./")
}

function isImportMetaUrl(node: ts.Node): boolean {
  return (
    ts.isPropertyAccessExpression(node) &&
    ts.isMetaProperty(node.expression) &&
    node.expression.keywordToken === ts.SyntaxKind.ImportKeyword &&
    node.name.text === "url"
  )
}

function isUrlConstructorWithImportMetaUrl(node: ts.Node): node is ts.NewExpression {
  if (!ts.isNewExpression(node)) {
    return false
  }

  if (!ts.isIdentifier(node.expression) || node.expression.text !== "URL") {
    return false
  }

  const [specifier, baseArg] = node.arguments ?? []

  if (specifier === undefined || !ts.isStringLiteral(specifier)) {
    return false
  }

  if (!isRelativeImport(specifier.text)) {
    return false
  }

  if (baseArg === undefined) {
    return false
  }

  return isImportMetaUrl(baseArg)
}

function isWorkerUrlOrComlinkContext(node: ts.Node): boolean {
  let current: ts.Node | undefined = node

  const unwrapNode = (target: ts.Node): ts.Node => {
    let currentNode: ts.Node = target
    while (
      ts.isParenthesizedExpression(currentNode)
      || ts.isAsExpression(currentNode)
      || ts.isTypeAssertionExpression(currentNode)
    ) {
      currentNode = currentNode.expression
    }
    return currentNode
  }

  const isDirectArgumentNode = (target: ts.Node, candidates?: ts.NodeArray<ts.Expression>): boolean => {
    if (candidates === undefined || candidates.length === 0) {
      return false
    }

    const normalizedTarget = unwrapNode(target)
    return candidates.some((candidate) => unwrapNode(candidate) === normalizedTarget)
  }

  const isWorkerOrUrlIdentifier = (expression: ts.Expression): boolean => {
    if (ts.isIdentifier(expression)) {
      return expression.text === "URL" || expression.text === "Worker"
    }

    if (ts.isPropertyAccessExpression(expression)) {
      return expression.name.text === "URL" || expression.name.text === "Worker"
    }

    if (ts.isParenthesizedExpression(expression)) {
      return isWorkerOrUrlIdentifier(expression.expression)
    }

    return false
  }

  const isComlinkIdentifier = (expression: ts.Expression): boolean => {
    if (ts.isIdentifier(expression)) {
      return expression.text === "Comlink"
    }

    if (ts.isPropertyAccessExpression(expression)) {
      return isComlinkIdentifier(expression.expression)
    }

    if (ts.isParenthesizedExpression(expression)) {
      return isComlinkIdentifier(expression.expression)
    }

    return false
  }

  while (current !== undefined) {
    if (ts.isNewExpression(current) && isWorkerOrUrlIdentifier(current.expression)) {
      if (current.arguments !== undefined && isDirectArgumentNode(node, current.arguments)) {
        return true
      }
    }

    if (ts.isCallExpression(current)) {
      const expression = current.expression
      if (
        ts.isPropertyAccessExpression(expression)
        && expression.name.text === "wrap"
        && isComlinkIdentifier(expression.expression)
      ) {
        if (isDirectArgumentNode(node, current.arguments)) {
          return true
        }
      }
    }

    current = current.parent
  }

  return false
}

function isWithinRoot(resolved: string, rootDir: string): boolean {
  const rel = path.relative(rootDir, resolved)

  if (path.isAbsolute(rel)) {
    return false
  }

  return !(rel === ".." || rel.startsWith(`..${path.sep}`))
}

function toAbsoluteAlias(
  sourceFilePath: string,
  moduleSpecifier: string,
  rootDir: string,
): string | null {
  const sourceDir = path.dirname(sourceFilePath)
  const targetPath = path.resolve(sourceDir, moduleSpecifier)
  const appScopeRoot = getAppScopeRoot(sourceFilePath)
  const packageRoot = getPackageRoot(sourceFilePath, rootDir)

  const scopeRoot = appScopeRoot ?? packageRoot
  if (scopeRoot === null) {
    return null
  }

  if (!isWithinRoot(targetPath, scopeRoot)) {
    return null
  }

  const rel = path.relative(scopeRoot, targetPath)
  const alias = `~/${stripKnownExtension(toPosix(rel))}`

  return alias
}

function formatLog(before: string, after: string): string {
  return `${before} => ${after}`
}

function collectSourceFiles(rootDir: string): Promise<string[]> {
  const visit = async (currentDir: string): Promise<string[]> => {
    const entries = await fs.readdir(currentDir, { withFileTypes: true })
    const collected: string[] = []
    for (const entry of entries) {
      if (!entry.isDirectory() && !entry.isFile()) {
        continue
      }

      if (entry.isDirectory()) {
        if (entry.name === "dist" || entry.name === "node_modules" || entry.name.startsWith(".")) {
          continue
        }
        const childEntries = await visit(path.join(currentDir, entry.name))
        collected.push(...childEntries)
        continue
      }

      if (!TARGET_EXTENSIONS.has(path.extname(entry.name))) {
        continue
      }
      collected.push(path.join(currentDir, entry.name))
    }
    return collected
  }

  return visit(rootDir)
}

function rewriteSourceFile(sourceText: string, filePath: string, rootDir: string): FileChange {
  const getScriptKind = (targetFilePath: string): ts.ScriptKind => {
    if (targetFilePath.endsWith(".tsx") || targetFilePath.endsWith(".jsx")) {
      return ts.ScriptKind.TSX
    }
    if (targetFilePath.endsWith(".json")) {
      return ts.ScriptKind.JSON
    }
    return ts.ScriptKind.TS
  }

  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    getScriptKind(filePath),
  )

  type Rewrite = {
    start: number
    end: number
    next: string
    line: number
    before: string
  }

  const rewrites: Rewrite[] = []

  const pushRewrite = (node: ts.StringLiteral): void => {
    if (isWorkerUrlOrComlinkContext(node)) {
      return
    }

    const moduleSpecifier = node.text

    const isLegacy = moduleSpecifier.startsWith("~/")
    const legacyAlias = isLegacy
      ? toLegacyAbsoluteAlias(moduleSpecifier, filePath, rootDir)
      : null

    const hasNext = isRelativeImport(moduleSpecifier) || isLegacy
    if (!hasNext) {
      return
    }

    if (isRelativeImport(moduleSpecifier) && isKeepAsRelativeImport(moduleSpecifier)) {
      return
    }

    const next = isRelativeImport(moduleSpecifier)
      ? toAbsoluteAlias(filePath, moduleSpecifier, rootDir)
      : legacyAlias

    if (next === null || next === moduleSpecifier) {
      return
    }

    const start = node.getStart(sourceFile)
    const end = node.getEnd()
    const before = sourceText.slice(start, end)
    const quote = before.startsWith("'") ? "'" : "\""
    const line = sourceFile.getLineAndCharacterOfPosition(start).line + 1

    rewrites.push({
      start,
      end,
      next: `${quote}${next}${quote}`,
      line,
      before,
    })
  }

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      pushRewrite(node.moduleSpecifier)
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      pushRewrite(node.moduleSpecifier)
    } else if (isUrlConstructorWithImportMetaUrl(node)) {
      return
    } else if (
      ts.isCallExpression(node)
      && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && node.arguments !== undefined
    ) {
      const sourceArgument = node.arguments[0]
      if (sourceArgument && ts.isStringLiteral(sourceArgument)) {
        pushRewrite(sourceArgument)
      }
    } else if (
      ts.isImportEqualsDeclaration(node)
      && ts.isExternalModuleReference(node.moduleReference)
      && ts.isStringLiteral(node.moduleReference.expression)
    ) {
      pushRewrite(node.moduleReference.expression)
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  if (rewrites.length === 0) {
    return {
      filePath,
      changes: [],
      rewrittenText: sourceText,
    }
  }

  rewrites.sort((a, b) => b.start - a.start)
  let nextText = sourceText

  for (const rewrite of rewrites) {
    nextText = `${nextText.slice(0, rewrite.start)}${rewrite.next}${nextText.slice(rewrite.end)}`
  }

  const changes = rewrites.map((item) => ({
    line: item.line,
    before: item.before,
    after: item.next,
  })).reverse()

  return {
    filePath,
    changes,
    rewrittenText: nextText,
  }
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const stat = await fs.stat(args.rootDir).catch(() => null)
  if (stat === null || !stat.isDirectory()) {
    throw new Error(`Error: target directory not found or not a directory: ${args.rootDir}`)
  }

  const files = await collectSourceFiles(args.rootDir)
  const fileChanges: FileChange[] = []

  for (const filePath of files) {
    const sourceText = await fs.readFile(filePath, "utf8")
    const result = rewriteSourceFile(sourceText, filePath, args.rootDir)
    if (result.changes.length > 0) {
      fileChanges.push(result)
      if (!args.dryRun) {
        const rewrittenText = result.rewrittenText
        await fs.writeFile(filePath, rewrittenText, "utf8")
      }
    }
  }

  if (fileChanges.length === 0) {
    console.log("No changes.")
    return
  }

  if (args.dryRun) {
    console.log("Dry-run mode: no files were written.")
  }

  for (const entry of fileChanges) {
    const message = [
      `${entry.filePath}`,
      ...entry.changes.map(
        (change) => `  ${change.line}: ${formatLog(change.before, change.after)}`,
      ),
    ].join("\n")
    console.log(message)
  }

  const changedFiles = fileChanges.length
  const changedImports = fileChanges.reduce((acc, entry) => acc + entry.changes.length, 0)
  console.log(
    `${changedImports} specifier replacements in ${changedFiles} file(s).`,
  )
}

run().catch((error) => {
  console.error((error as Error).message)
  process.exitCode = 1
})
