/** Canonical YAML subtypes supported by the IDE-GSM project contract. */
export const YAML_SUBTYPES = [
  'sources',
  'scenario',
  'scenario-base',
  'calib',
  'remote',
  'remote-base',
  'ssh',
  'ssh-base',
  'ec2',
  'ec2-base',
  'rsync',
  'git',
] as const;

/** A canonical YAML subtype. */
export type YamlSubtype = (typeof YAML_SUBTYPES)[number];
