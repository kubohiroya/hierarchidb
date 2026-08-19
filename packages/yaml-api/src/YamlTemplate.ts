import {
  YAML_SUBTYPE_REGISTRY,
  type YamlCanonicalFilename,
  type YamlSchemaId,
} from './YAML_SUBTYPE_REGISTRY.js';
import { YAML_SUBTYPES, type YamlSubtype } from './YamlSubtype.js';

/** A single canonical YAML file template entry. */
export interface YamlTemplate {
  readonly templateId: YamlSubtype;
  readonly subtype: YamlSubtype;
  readonly displayName: string;
  readonly fileName: YamlCanonicalFilename;
  readonly schemaId: YamlSchemaId;
}

function createYamlTemplate(subtype: YamlSubtype): YamlTemplate {
  const entry = YAML_SUBTYPE_REGISTRY[subtype];
  return {
    templateId: subtype,
    subtype,
    displayName: entry.displayName,
    fileName: entry.fileName,
    schemaId: entry.schemaId,
  };
}

/** Total canonical template registry keyed by YAML subtype. */
export const YAML_TEMPLATE_REGISTRY = {
  sources: createYamlTemplate('sources'),
  scenario: createYamlTemplate('scenario'),
  'scenario-base': createYamlTemplate('scenario-base'),
  calib: createYamlTemplate('calib'),
  remote: createYamlTemplate('remote'),
  'remote-base': createYamlTemplate('remote-base'),
  ssh: createYamlTemplate('ssh'),
  'ssh-base': createYamlTemplate('ssh-base'),
  ec2: createYamlTemplate('ec2'),
  'ec2-base': createYamlTemplate('ec2-base'),
  rsync: createYamlTemplate('rsync'),
  git: createYamlTemplate('git'),
} as const satisfies Record<YamlSubtype, YamlTemplate>;

/** All 12 canonical YAML templates, derived from the subtype registry. */
export const YAML_CANONICAL_TEMPLATES: readonly YamlTemplate[] = YAML_SUBTYPES.map(
  (subtype) => YAML_TEMPLATE_REGISTRY[subtype]
);

/**
 * Templates consumed by the existing three-step runtime.
 *
 * The rsync and git templates remain excluded until the later UI/storage
 * cutover issue. This explicit list is not the canonical 12-template contract.
 */
export const YAML_TEMPLATES: readonly YamlTemplate[] = YAML_CANONICAL_TEMPLATES.filter(
  (template) => template.subtype !== 'rsync' && template.subtype !== 'git'
);

/**
 * Look up a template in the existing three-step runtime contract.
 * Returns undefined when that runtime does not expose the template.
 */
export function findYamlTemplate(templateId: string): YamlTemplate | undefined {
  return YAML_TEMPLATES.find((template) => template.templateId === templateId);
}
