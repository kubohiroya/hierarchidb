#!/usr/bin/env node
/**
 * Codemod: Rename TreeNodeUpdater id -> treeNodeId
 *
 * - Renames the `id` property to `treeNodeId` on TreeNodeUpdaterPayload/State.
 * - Uses ts-morph to update declarations and references across the project.
 * - Default roots: packages, app, plugins (configurable via --roots).
 *
 * Usage:
 *   pnpm --filter @hierarchidb/tools-codemods run codemod:treenode-updater-id -- --write --roots packages app plugins
 * Dry run by default (omit --write).
 */
import ts from 'ts-morph';
import type { PropertySignature } from 'ts-morph';
import * as path from 'node:path';
import * as globby from 'globby';
import process from 'node:process';

type Args = { write: boolean; roots: string[] };

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const out: Args = { write: false, roots: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--write' || a === '-w') out.write = true;
    else if (a === '--roots') {
      i++;
      for (; i < args.length && !args[i]?.startsWith('--'); i++) out.roots.push(args[i] as string);
      i--;
    }
  }
  if (out.roots.length === 0) out.roots = ['packages', 'app', 'plugins'];
  return out;
}

const { Project, Node, SyntaxKind } = ts;

const targetInterfaces = ['TreeNodeUpdaterPayload', 'TreeNodeUpdaterState'];
const oldName = 'id';
const newName = 'treeNodeId';

async function main() {
  const { write, roots } = parseArgs();
  const repoRoot = path.resolve(process.cwd(), '../../..');
  const ignored = [
    '**/*.d.ts',
    '**/*.test.*',
    '**/*.spec.*',
    '**/*.stories.*',
    '**/node_modules/**',
    '**/dist/**',
    '**/.turbo/**',
    '**/coverage/**',
    '**/.cache/**',
    '**/stage/**',
    '**/.next/**',
    '**/.storybook/**',
  ];

  let totalRenamed = 0;
  let totalFiles = 0;

  for (const root of roots) {
    const rootPath = path.join(repoRoot, root);
    const patterns = [
      path.join(rootPath, '**/*.ts'),
      path.join(rootPath, '**/*.tsx'),
    ];
    const files = await globby.globby(patterns, { ignore: ignored });
    if (files.length === 0) {
      console.log(`[codemod] Skip root ${root}: no files`);
      continue;
    }

    const project = new Project({ skipAddingFilesFromTsConfig: true });
    project.addSourceFilesAtPaths(files);

    let renamedProps = 0;
    let touchedFiles = 0;

    for (const sf of project.getSourceFiles()) {
      let fileChanged = false;

      // Interface declarations
      sf.getInterfaces().forEach((iface) => {
        if (!targetInterfaces.includes(iface.getName())) return;
        const prop = iface.getProperty(oldName);
        if (!prop) return;
        prop.rename(newName);
        renamedProps++;
        fileChanged = true;
      });

      // Type literal aliases (fallback)
      sf.getTypeAliases().forEach((alias) => {
        if (!targetInterfaces.includes(alias.getName())) return;
        const typeNode = alias.getTypeNode()?.asKind(SyntaxKind.TypeLiteral);
        if (!typeNode) return;
        const member = typeNode.getMembers().find(
          (memberNode): memberNode is PropertySignature =>
            Node.isPropertySignature(memberNode) && memberNode.getNameNode().getText() === oldName
        );
        if (member) {
          member.rename(newName);
          renamedProps++;
          fileChanged = true;
        }
      });

      if (fileChanged) touchedFiles++;
    }

    if (write) {
      await project.save();
      console.log(`[codemod] ${root}: applied in ${touchedFiles} files, ${renamedProps} props renamed.`);
    } else {
      console.log(`[codemod] ${root}: dry run would rename ${renamedProps} props across ${touchedFiles} files.`);
    }

    totalRenamed += renamedProps;
    totalFiles += touchedFiles;
  }

  if (!write) console.log('[codemod] Dry run complete. Re-run with --write to apply changes.');
  console.log(`[codemod] Total: ${totalFiles} files touched, ${totalRenamed} properties renamed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
