import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Project, SyntaxKind } from 'ts-morph';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const project = new Project({
  tsConfigFilePath: path.resolve(repoRoot, 'tsconfig.json'),
  skipAddingFilesFromTsConfig: true,
});

const handlerPath = path.resolve(
  repoRoot,
  'plugins',
  'basemap-plugin',
  'src',
  'handlers',
  'BaseMapEntityHandler.ts'
);
const peerStorePath = path.resolve(
  repoRoot,
  'plugins',
  'basemap-plugin',
  'src',
  'worker',
  'basemapPeerStore.dexie.ts'
);

if (!fs.existsSync(handlerPath)) {
  console.warn('[codemod] BaseMapEntityHandler not found; skipping basemap working copy helper codemod.');
  process.exit(0);
}

const handlerFile = project.addSourceFileAtPath(handlerPath);
const peerStoreFile = fs.existsSync(peerStorePath)
  ? project.addSourceFileAtPath(peerStorePath)
  : null;

function ensureNamedImport(source = handlerFile, moduleSpecifier: string, name: string) {
  const decl = source.getImportDeclaration(moduleSpecifier);
  if (decl) {
    if (!decl.getNamedImports().some((n) => n.getName() === name)) {
      decl.addNamedImport(name);
    }
  } else {
    source.addImportDeclaration({
      moduleSpecifier,
      namedImports: [name],
    });
  }
}

// Update handler imports
ensureNamedImport(handlerFile, '@hierarchidb/base-plugin', 'createDraftWorkingCopyBase');

const typesImport = handlerFile
  .getImportDeclaration((decl) => decl.getModuleSpecifierValue() === '../types/index.ts');
if (typesImport && !typesImport.getNamedImports().some((n) => n.getName() === 'BaseMapDraftPayload')) {
  typesImport.addNamedImport('BaseMapDraftPayload');
}

// Replace createWorkingCopy method body
const handlerClass = handlerFile.getClass('BaseMapEntityHandler');
if (!handlerClass) {
  throw new Error('BaseMapEntityHandler class not found');
}
const createWorkingCopyMethod = handlerClass.getInstanceMethod('createWorkingCopy');
if (!createWorkingCopyMethod) {
  throw new Error('createWorkingCopy method not found');
}

createWorkingCopyMethod.setBodyText(`{
  const entity = await this.getEntityByNodeId(nodeId);
  const now = Date.now();
  const workingCopyId = crypto.randomUUID() as unknown as NodeId;

  const mapStyle = normalizeMapStyle(entity?.mapStyle);
  const viewport = normalizeViewport(entity?.viewport);
  const displayOptions = resolveDisplayOptions(mapStyle, entity?.displayOptions);

  const draftPayload: BaseMapDraftPayload = {
    name: entity?.name ?? 'New BaseMap',
    description: entity?.description ?? '',
    category: entity?.category,
    settings: entity?.settings ?? {
      allowNestedFolders: true,
      maxDepth: 10,
      sortOrder: 'name',
    },
    tags: entity?.tags ?? [],
    baseMapMetadataId: entity?.baseMapMetadataId,
    mapStyle,
    viewport,
    displayOptions,
  };

  const base = createDraftWorkingCopyBase<BaseMapDraftPayload, BaseMapEntity>({
    draft: draftPayload,
    meta: {
      treeNodeId: nodeId,
      createdAt: entity?.createdAt ?? now,
      updatedAt: now,
      originalVersion: entity?.version,
      schemaVersion: 1,
    },
  });

  const workingCopy: BaseMapWorkingCopy = {
    ...draftPayload,
    ...base,
    id: workingCopyId,
    workingCopyId,
    nodeId,
    version: entity?.version ?? 1,
    copiedAt: now,
    originalId: entity?.id,
  };

  await this.workingCopyTable.add(workingCopy);
  return workingCopy;
}`);

// Update peer store normalizer
ensureNamedImport(peerStoreFile, '@hierarchidb/base-plugin', 'createPeerStoreNormalizer');

if (peerStoreFile) {
  const normalizeFn = peerStoreFile.getFunction('normalizeBasemapPeerData');
  if (normalizeFn) {
    normalizeFn.replaceWithText(`const normalizeBasemapPeerData = createPeerStoreNormalizer<BasemapPeerData>(() => ({
  schemaVersion: 1,
  presentation: undefined,
  metadata: {},
}));`);
  }

  peerStoreFile.getStatements().forEach((stmt) => {
    if (stmt.getKind() === SyntaxKind.VariableStatement) {
      const text = stmt.getText();
      if (text.includes('normalizeBasemapPeerData') && text.includes('createPeerStoreNormalizer')) {
        // already handled
      }
    }
  });
}

project.saveSync();
