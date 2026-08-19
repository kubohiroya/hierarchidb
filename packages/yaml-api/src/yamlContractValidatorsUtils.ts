import {
  YAML_CANONICAL_FILENAMES,
  YAML_COMMAND_CAPABILITIES,
  YAML_COMMAND_IDS,
  YAML_SCHEMA_IDS,
  YAML_SUBTYPE_REGISTRY,
  type YamlCanonicalFilename,
  type YamlCommandId,
  type YamlCommandMutationName,
  type YamlSchemaId,
  type YamlSubtypeRegistryEntry,
} from './YAML_SUBTYPE_REGISTRY.js';
import { YamlContractError } from './YamlContractError.js';
import { YAML_SUBTYPES, type YamlSubtype } from './YamlSubtype.js';

const YAML_SUBTYPE_SET: ReadonlySet<string> = new Set(YAML_SUBTYPES);
const YAML_COMMAND_ID_SET: ReadonlySet<string> = new Set(YAML_COMMAND_IDS);
const YAML_SCHEMA_ID_SET: ReadonlySet<string> = new Set(YAML_SCHEMA_IDS);
const YAML_FILENAME_SET: ReadonlySet<string> = new Set(YAML_CANONICAL_FILENAMES);

/** Validate and return a canonical YAML subtype. */
export function validateYamlSubtype(value: unknown): YamlSubtype {
  if (typeof value !== 'string' || !YAML_SUBTYPE_SET.has(value)) {
    throw new YamlContractError('UNKNOWN_SUBTYPE', 'Unknown YAML subtype');
  }
  return value as YamlSubtype;
}

/** Validate and return a canonical YAML command identifier. */
export function validateYamlCommandId(value: unknown): YamlCommandId {
  if (typeof value !== 'string' || !YAML_COMMAND_ID_SET.has(value)) {
    throw new YamlContractError('UNKNOWN_COMMAND', 'Unknown YAML command');
  }
  return value as YamlCommandId;
}

/** Validate and return a registered schema identifier. */
export function validateYamlSchemaId(value: unknown): YamlSchemaId {
  if (typeof value !== 'string' || !YAML_SCHEMA_ID_SET.has(value)) {
    throw new YamlContractError('UNKNOWN_SCHEMA', 'Unknown YAML schema');
  }
  return value as YamlSchemaId;
}

/** Validate and return a canonical YAML filename. */
export function validateYamlCanonicalFilename(value: unknown): YamlCanonicalFilename {
  if (typeof value !== 'string' || !YAML_FILENAME_SET.has(value)) {
    throw new YamlContractError('UNKNOWN_FILENAME', 'Unknown canonical YAML filename');
  }
  return value as YamlCanonicalFilename;
}

/**
 * Validate that subtype, schema, and filename identify the same registry row.
 */
export function validateYamlSubtypeContract(input: {
  readonly subtype: unknown;
  readonly schemaId: unknown;
  readonly fileName: unknown;
}): YamlSubtypeRegistryEntry {
  const subtype = validateYamlSubtype(input.subtype);
  const schemaId = validateYamlSchemaId(input.schemaId);
  const fileName = validateYamlCanonicalFilename(input.fileName);
  const entry = YAML_SUBTYPE_REGISTRY[subtype];

  if (entry.schemaId !== schemaId) {
    throw new YamlContractError(
      'SCHEMA_MISMATCH',
      `Schema ${schemaId} is not valid for YAML subtype ${subtype}`,
      { actualSchemaId: schemaId, expectedSchemaId: entry.schemaId, subtype }
    );
  }
  if (entry.fileName !== fileName) {
    throw new YamlContractError(
      'FILENAME_MISMATCH',
      `Filename ${fileName} is not valid for YAML subtype ${subtype}`,
      { actualFileName: fileName, expectedFileName: entry.fileName, subtype }
    );
  }

  return entry;
}

/**
 * Validate a command capability before any network request is created.
 */
export function validateYamlCommandForSubtype(
  subtypeValue: unknown,
  commandValue: unknown
): {
  readonly subtype: YamlSubtype;
  readonly commandId: YamlCommandId;
  readonly mutationName: YamlCommandMutationName;
} {
  const subtype = validateYamlSubtype(subtypeValue);
  const commandId = validateYamlCommandId(commandValue);
  const capability = YAML_COMMAND_CAPABILITIES[subtype].find(
    (candidate) => candidate.commandId === commandId
  );

  if (capability === undefined) {
    throw new YamlContractError(
      'COMMAND_NOT_ALLOWED',
      `Command ${commandId} is not allowed for YAML subtype ${subtype}`,
      { commandId, subtype }
    );
  }

  return {
    subtype,
    commandId,
    mutationName: capability.mutationName,
  };
}
