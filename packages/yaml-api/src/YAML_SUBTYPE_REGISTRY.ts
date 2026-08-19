import { YAML_SUBTYPES, type YamlSubtype } from './YamlSubtype.js';

interface YamlSubtypeRegistryEntryShape {
  readonly subtype: YamlSubtype;
  readonly schemaId: string;
  readonly fileName: string;
  readonly displayName: string;
  readonly commandCapabilities: readonly {
    readonly commandId: string;
    readonly mutationName: string;
  }[];
}

/**
 * Total subtype registry for the IDE-GSM Step 4 contract.
 *
 * Empty command lists are intentional editor-only capabilities. This registry
 * is not wired into the existing three-step template selector until the later
 * storage and UI cutover issues are completed.
 */
export const YAML_SUBTYPE_REGISTRY = {
  sources: {
    subtype: 'sources',
    schemaId: 'ide-gsm/sources',
    fileName: 'sources.yml',
    displayName: 'Sources',
    commandCapabilities: [{ commandId: 'install', mutationName: 'install' }],
  },
  scenario: {
    subtype: 'scenario',
    schemaId: 'ide-gsm/scenario',
    fileName: 'scenario.yml',
    displayName: 'Scenario',
    commandCapabilities: [
      { commandId: 'check', mutationName: 'checkAll' },
      { commandId: 'check-merge', mutationName: 'checkMerge' },
      { commandId: 'preview-events', mutationName: 'previewEvents' },
      { commandId: 'calib', mutationName: 'calibrate' },
      { commandId: 'sim', mutationName: 'simulate' },
      { commandId: 'purge-cache', mutationName: 'purgeCache' },
    ],
  },
  'scenario-base': {
    subtype: 'scenario-base',
    schemaId: 'ide-gsm/scenario',
    fileName: 'scenario-base.yml',
    displayName: 'Scenario Base',
    commandCapabilities: [],
  },
  calib: {
    subtype: 'calib',
    schemaId: 'ide-gsm/calib',
    fileName: 'calib.yml',
    displayName: 'Calibration',
    commandCapabilities: [],
  },
  remote: {
    subtype: 'remote',
    schemaId: 'ide-gsm/remote',
    fileName: 'remote.yml',
    displayName: 'Remote',
    commandCapabilities: [
      { commandId: 'calib-remote', mutationName: 'calibrateRemote' },
      { commandId: 'sim-remote', mutationName: 'simulateRemote' },
      {
        commandId: 'start-container-remote',
        mutationName: 'startContainerRemote',
      },
      {
        commandId: 'stop-container-remote',
        mutationName: 'stopContainerRemote',
      },
    ],
  },
  'remote-base': {
    subtype: 'remote-base',
    schemaId: 'ide-gsm/remote',
    fileName: 'remote-base.yml',
    displayName: 'Remote Base',
    commandCapabilities: [],
  },
  ssh: {
    subtype: 'ssh',
    schemaId: 'ide-gsm/ssh',
    fileName: 'ssh.yml',
    displayName: 'SSH',
    commandCapabilities: [
      { commandId: 'calib-ssh', mutationName: 'calibrateSsh' },
      { commandId: 'sim-ssh', mutationName: 'simulateSsh' },
    ],
  },
  'ssh-base': {
    subtype: 'ssh-base',
    schemaId: 'ide-gsm/ssh',
    fileName: 'ssh-base.yml',
    displayName: 'SSH Base',
    commandCapabilities: [],
  },
  ec2: {
    subtype: 'ec2',
    schemaId: 'ide-gsm/ec2',
    fileName: 'ec2.yml',
    displayName: 'EC2',
    commandCapabilities: [
      { commandId: 'calib-ec2', mutationName: 'calibrateEc2' },
      { commandId: 'sim-ec2', mutationName: 'simulateEc2' },
      {
        commandId: 'start-container-ec2',
        mutationName: 'startContainerEc2',
      },
      {
        commandId: 'stop-container-ec2',
        mutationName: 'stopContainerEc2',
      },
    ],
  },
  'ec2-base': {
    subtype: 'ec2-base',
    schemaId: 'ide-gsm/ec2',
    fileName: 'ec2-base.yml',
    displayName: 'EC2 Base',
    commandCapabilities: [],
  },
  rsync: {
    subtype: 'rsync',
    schemaId: 'ide-gsm/rsync',
    fileName: 'rsync.yml',
    displayName: 'Rsync',
    commandCapabilities: [
      { commandId: 'rsync-push', mutationName: 'rsyncPush' },
      { commandId: 'rsync-pull', mutationName: 'rsyncPull' },
    ],
  },
  git: {
    subtype: 'git',
    schemaId: 'ide-gsm/git',
    fileName: 'git.yml',
    displayName: 'Git',
    commandCapabilities: [{ commandId: 'init', mutationName: 'init' }],
  },
} as const satisfies Record<YamlSubtype, YamlSubtypeRegistryEntryShape>;

/** Contract owned by one canonical YAML subtype. */
export type YamlSubtypeRegistryEntry = (typeof YAML_SUBTYPE_REGISTRY)[YamlSubtype];

/** A schema identifier owned by at least one canonical YAML subtype. */
export type YamlSchemaId = (typeof YAML_SUBTYPE_REGISTRY)[YamlSubtype]['schemaId'];

/** A canonical filename owned by exactly one YAML subtype. */
export type YamlCanonicalFilename = (typeof YAML_SUBTYPE_REGISTRY)[YamlSubtype]['fileName'];

/** One strict local-command to pinned upstream-mutation mapping. */
export type YamlCommandCapability =
  (typeof YAML_SUBTYPE_REGISTRY)[YamlSubtype]['commandCapabilities'][number];

/** A canonical IDE-GSM Step 4 command identifier. */
export type YamlCommandId = YamlCommandCapability['commandId'];

/** A pinned upstream mutation name available to YAML Step 4. */
export type YamlCommandMutationName = YamlCommandCapability['mutationName'];

/** Canonical schema identifiers, derived from the subtype registry. */
export const YAML_SCHEMA_IDS: readonly YamlSchemaId[] = [
  ...new Set(Object.values(YAML_SUBTYPE_REGISTRY).map((entry) => entry.schemaId)),
];

/** Canonical filenames, derived from the subtype registry. */
export const YAML_CANONICAL_FILENAMES: readonly YamlCanonicalFilename[] = Object.values(
  YAML_SUBTYPE_REGISTRY
).map((entry) => entry.fileName);

/** Total command-capability map, derived from the subtype registry. */
export const YAML_COMMAND_CAPABILITIES = {
  sources: YAML_SUBTYPE_REGISTRY.sources.commandCapabilities,
  scenario: YAML_SUBTYPE_REGISTRY.scenario.commandCapabilities,
  'scenario-base': YAML_SUBTYPE_REGISTRY['scenario-base'].commandCapabilities,
  calib: YAML_SUBTYPE_REGISTRY.calib.commandCapabilities,
  remote: YAML_SUBTYPE_REGISTRY.remote.commandCapabilities,
  'remote-base': YAML_SUBTYPE_REGISTRY['remote-base'].commandCapabilities,
  ssh: YAML_SUBTYPE_REGISTRY.ssh.commandCapabilities,
  'ssh-base': YAML_SUBTYPE_REGISTRY['ssh-base'].commandCapabilities,
  ec2: YAML_SUBTYPE_REGISTRY.ec2.commandCapabilities,
  'ec2-base': YAML_SUBTYPE_REGISTRY['ec2-base'].commandCapabilities,
  rsync: YAML_SUBTYPE_REGISTRY.rsync.commandCapabilities,
  git: YAML_SUBTYPE_REGISTRY.git.commandCapabilities,
} as const satisfies Record<YamlSubtype, readonly YamlCommandCapability[]>;

/** Canonical command identifiers, derived from the capability registry. */
export const YAML_COMMAND_IDS: readonly YamlCommandId[] = YAML_SUBTYPES.flatMap((subtype) =>
  YAML_COMMAND_CAPABILITIES[subtype].map((capability) => capability.commandId)
);
