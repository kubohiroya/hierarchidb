import { YAML_CANONICAL_FILENAMES, type YamlCanonicalFilename } from '@hierarchidb/yaml-api';
import { validateYamlCanonicalPayload } from '@hierarchidb/yaml-api/validation';
import { encodeCanonicalYamlZip } from '../canonical-yaml-zip-codec/index.js';
import { canonicalYamlZipPlanGuards } from './canonicalYamlZipPlanGuards.internal.js';
import type {
  CanonicalYamlZipNodeGuard,
  CanonicalYamlZipPlanError,
  PlanCanonicalYamlZipExportResult,
} from './canonicalYamlZipPlanTypes.js';

const { freezeCanonicalPayload, nodeGuard, parseExportInput } = canonicalYamlZipPlanGuards;

function validationFailure(sourceIndex: number, slot: 'committed' | 'draft') {
  const error: CanonicalYamlZipPlanError = Object.freeze({
    code: 'CANONICAL_VALIDATION_FAILED',
    sourceIndex,
    slot,
  });
  return Object.freeze({ ok: false, errors: Object.freeze([error]) } as const);
}

/** Plans a deterministic canonical YAML archive without reading storage or runtime state. */
export function planCanonicalYamlZipExport(input: unknown): PlanCanonicalYamlZipExportResult {
  const parsed = parseExportInput(input);
  if (!parsed.ok) return parsed;

  const entries: Array<{
    readonly filename: YamlCanonicalFilename;
    readonly payload: ReturnType<typeof freezeCanonicalPayload>;
  }> = [];
  const guards: CanonicalYamlZipNodeGuard[] = [];
  for (const node of parsed.value.nodes) {
    if (node.nodeType !== 'yaml-file')
      return validationFailure(node.sourceIndex, parsed.value.slot);
    const metadata = parsed.value.slot === 'committed' ? node.metadata : node.draftMetadata;
    const payload = parsed.value.slot === 'committed' ? node.data : node.draftData;
    if (metadata === null || payload === undefined || payload === null) {
      return validationFailure(node.sourceIndex, parsed.value.slot);
    }
    const validation = validateYamlCanonicalPayload(metadata.name, payload);
    if (!validation.ok) return validationFailure(node.sourceIndex, parsed.value.slot);
    const filename = YAML_CANONICAL_FILENAMES.find((candidate) => candidate === metadata.name);
    if (filename === undefined) return validationFailure(node.sourceIndex, parsed.value.slot);
    entries.push(
      Object.freeze({
        filename,
        payload: freezeCanonicalPayload(validation.value),
      })
    );
    guards.push(nodeGuard(node));
  }

  const archive = encodeCanonicalYamlZip(Object.freeze(entries));
  if (!archive.ok) {
    const codecError: CanonicalYamlZipPlanError = Object.freeze({
      code: 'ZIP_CODEC_FAILED',
      codecCode: archive.error.code,
      ...(archive.error.entryIndex === undefined ? {} : { entryIndex: archive.error.entryIndex }),
    });
    return Object.freeze({ ok: false, errors: Object.freeze([codecError]) });
  }
  guards.sort((left, right) => left.nodeId.localeCompare(right.nodeId));
  const plan = Object.freeze({
    slot: parsed.value.slot,
    nodeGuards: Object.freeze(guards),
    archive: archive.value,
  });
  return Object.freeze({ ok: true, plan });
}
