import { decodeCanonicalYamlZip } from '../canonical-yaml-zip-codec/decodeCanonicalYamlZip.js';
import { canonicalYamlZipImportPlanProvenance } from './canonicalYamlZipImportPlanProvenance.internalConstants.js';
import { canonicalYamlZipPlanGuards } from './canonicalYamlZipPlanGuards.internal.js';
import type {
  CanonicalYamlZipImportedNode,
  CanonicalYamlZipImportPlan,
  CanonicalYamlZipParentPatch,
  CanonicalYamlZipPlanError,
  PlanCanonicalYamlZipImportResult,
} from './canonicalYamlZipPlanTypes.js';

const { freezeCanonicalPayload, parseImportInput, siblingGuard } = canonicalYamlZipPlanGuards;

function errorResult(error: CanonicalYamlZipPlanError): PlanCanonicalYamlZipImportResult {
  return Object.freeze({ ok: false, errors: Object.freeze([error]) });
}

function createImportedNode(
  id: string,
  parentId: string,
  parentDepth: number,
  timestamp: number,
  filename: string,
  payload: Parameters<typeof freezeCanonicalPayload>[0]
): CanonicalYamlZipImportedNode {
  return Object.freeze({
    id,
    parentId,
    nodeType: 'yaml-file',
    depth: parentDepth + 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
    metadata: Object.freeze({ name: filename, description: '', tags: Object.freeze([]) }),
    draftMetadata: null,
    data: freezeCanonicalPayload(payload),
    visible: true,
  });
}

/** Plans a strict canonical ZIP import while leaving all storage mutation to an injected port. */
export function planCanonicalYamlZipImport(input: unknown): PlanCanonicalYamlZipImportResult {
  const parsed = parseImportInput(input);
  if (!parsed.ok) return parsed;
  if (parsed.value.parent.nodeType !== 'folder') {
    return errorResult(
      Object.freeze({
        code: 'INVALID_INPUT',
        context: Object.freeze({ field: 'parent', reason: 'invalid-value' }),
      })
    );
  }
  if (parsed.value.parent.depth === Number.MAX_SAFE_INTEGER) {
    return errorResult(
      Object.freeze({
        code: 'INVALID_INPUT',
        context: Object.freeze({ field: 'depth', reason: 'invalid-value' }),
      })
    );
  }
  for (const sibling of parsed.value.siblings) {
    if (sibling.parentId !== parsed.value.parent.id) {
      return errorResult(
        Object.freeze({
          code: 'INVALID_INPUT',
          context: Object.freeze({
            field: 'siblings',
            reason: 'invalid-item',
            sourceIndex: sibling.sourceIndex,
          }),
        })
      );
    }
  }
  const existingNodeIds = new Set(parsed.value.existingNodeIds);
  if (
    !existingNodeIds.has(parsed.value.parent.id) ||
    parsed.value.siblings.some((sibling) => !existingNodeIds.has(sibling.id))
  ) {
    return errorResult(
      Object.freeze({
        code: 'INVALID_INPUT',
        context: Object.freeze({ field: 'existingNodeIds', reason: 'invalid-value' }),
      })
    );
  }
  const siblingNames = new Set<string>();
  for (const sibling of parsed.value.siblings) {
    if (siblingNames.has(sibling.metadata.name)) {
      return errorResult(
        Object.freeze({
          code: 'INVALID_INPUT',
          context: Object.freeze({
            field: 'siblings',
            reason: 'duplicate',
            sourceIndex: sibling.sourceIndex,
          }),
        })
      );
    }
    siblingNames.add(sibling.metadata.name);
  }

  const decoded = decodeCanonicalYamlZip(parsed.value.archive);
  if (!decoded.ok) {
    return errorResult(
      Object.freeze({
        code: 'ZIP_CODEC_FAILED',
        codecCode: decoded.error.code,
        ...(decoded.error.entryIndex === undefined ? {} : { entryIndex: decoded.error.entryIndex }),
      })
    );
  }
  if (decoded.value.entries.length === 0) {
    return errorResult(
      Object.freeze({
        code: 'INVALID_INPUT',
        context: Object.freeze({ field: 'archive', reason: 'empty' }),
      })
    );
  }
  if (decoded.value.entries.length !== parsed.value.generatedNodeIds.length) {
    return errorResult(
      Object.freeze({
        code: 'INVALID_INPUT',
        context: Object.freeze({ field: 'generatedNodeIds', reason: 'length-mismatch' }),
      })
    );
  }

  const nodes: Array<CanonicalYamlZipImportedNode & { readonly occurrenceIndex: number }> = [];
  for (let index = 0; index < decoded.value.entries.length; index += 1) {
    const entry = decoded.value.entries[index];
    const generatedId = parsed.value.generatedNodeIds[index];
    if (entry === undefined || generatedId === undefined) {
      return errorResult(
        Object.freeze({
          code: 'INVALID_INPUT',
          context: Object.freeze({ field: 'generatedNodeIds', reason: 'length-mismatch' }),
        })
      );
    }
    if (existingNodeIds.has(generatedId)) {
      return errorResult(Object.freeze({ code: 'NODE_ID_COLLISION', entryIndex: index }));
    }
    if (siblingNames.has(entry.filename)) {
      return errorResult(Object.freeze({ code: 'SIBLING_NAME_CONFLICT', entryIndex: index }));
    }
    nodes.push(
      Object.freeze({
        ...createImportedNode(
          generatedId,
          parsed.value.parent.id,
          parsed.value.parent.depth,
          parsed.value.timestamp,
          entry.filename,
          entry.payload
        ),
        occurrenceIndex: entry.occurrenceIndex,
      })
    );
  }
  nodes.sort((left, right) => left.metadata.name.localeCompare(right.metadata.name));
  const importedNodes: CanonicalYamlZipImportedNode[] = nodes.map((node) =>
    Object.freeze({
      id: node.id,
      parentId: node.parentId,
      nodeType: node.nodeType,
      depth: node.depth,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
      version: node.version,
      metadata: node.metadata,
      draftMetadata: node.draftMetadata,
      data: node.data,
      visible: node.visible,
    })
  );

  let parentPatch: CanonicalYamlZipParentPatch | undefined;
  if (parsed.value.parent.hasChildren !== true) {
    if (parsed.value.parent.version === Number.MAX_SAFE_INTEGER) {
      return errorResult(
        Object.freeze({
          code: 'INVALID_INPUT',
          context: Object.freeze({ field: 'version', reason: 'invalid-value' }),
        })
      );
    }
    parentPatch = Object.freeze({
      id: parsed.value.parent.id,
      expectedVersion: parsed.value.parent.version,
      postimage: Object.freeze({
        hasChildren: true,
        updatedAt: parsed.value.timestamp,
        version: parsed.value.parent.version + 1,
      }),
    });
  }

  const parentGuard = Object.freeze({
    sourceIndex: parsed.value.parent.sourceIndex,
    nodeId: parsed.value.parent.id,
    expectedVersion: parsed.value.parent.version,
    expectedDepth: parsed.value.parent.depth,
    expectedHasChildren: parsed.value.parent.hasChildren,
  });
  const siblingGuards = Object.freeze(
    parsed.value.siblings
      .map(siblingGuard)
      .sort((left, right) => left.nodeId.localeCompare(right.nodeId))
  );
  const existingNodeIdGuard = Object.freeze([...parsed.value.existingNodeIds].sort());
  const request = Object.freeze({
    parentGuard,
    siblingGuards,
    existingNodeIdGuard,
    nodes: Object.freeze(importedNodes),
    ...(parentPatch === undefined ? {} : { parentPatch }),
  });
  const plan: CanonicalYamlZipImportPlan = Object.freeze({
    parentGuard,
    siblingGuards,
    existingNodeIdGuard,
    request,
  });
  canonicalYamlZipImportPlanProvenance.issue(plan);
  return Object.freeze({ ok: true, plan });
}
