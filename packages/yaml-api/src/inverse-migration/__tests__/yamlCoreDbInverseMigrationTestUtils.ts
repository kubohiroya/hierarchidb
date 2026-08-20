import { YAML_SUBTYPE_REGISTRY } from '../../YAML_SUBTYPE_REGISTRY.js';
import type { YamlSubtype } from '../../YamlSubtype.js';
import type {
  PlanExactYamlCoreDbInverseMigrationInput,
  PlanExactYamlCoreDbInverseMigrationResult,
  PlanReleaseYamlCoreDbInverseMigrationInput,
  PlanReleaseYamlCoreDbInverseMigrationResult,
  YamlCoreDbExactInverseMigrationPlan,
  YamlCoreDbInverseMigrationError,
  YamlCoreDbInverseMigrationSlot,
  YamlCoreDbReleaseInverseMigrationPlan,
} from '../yamlCoreDbInverseMigrationTypes.js';

export const VALID_DIGEST = '0123456789abcdef'.repeat(4);

export const VALID_CONTENT: Readonly<Record<YamlSubtype, string>> = {
  sources: 'sources: []\n',
  scenario: 'name: demo\n',
  'scenario-base': 'name: demo\n',
  calib: 'calibrationId: calibration-1\n',
  remote: 'host: remote.example.test\n',
  'remote-base': 'host: remote.example.test\n',
  ssh: 'host: ssh.example.test\nusername: user\n',
  'ssh-base': 'host: ssh.example.test\nusername: user\n',
  ec2: 'instanceId: i-123\nregion: ap-northeast-1\n',
  'ec2-base': 'instanceId: i-123\nregion: ap-northeast-1\n',
  rsync: 'include: []\nexclude: []\n',
  git: 'url: https://example.test/repository.git\n',
};

export function canonicalNode(
  id: string,
  subtype: YamlSubtype,
  version = 1
): Readonly<Record<string, unknown>> {
  const registryEntry = YAML_SUBTYPE_REGISTRY[subtype];
  return {
    id,
    version,
    nodeType: 'yaml-file',
    metadata: { name: registryEntry.fileName },
    draftMetadata: null,
    data: {
      subtype,
      schemaId: registryEntry.schemaId,
      content: VALID_CONTENT[subtype],
    },
  };
}

export function legacyNode(id: string, subtype: YamlSubtype): Readonly<Record<string, unknown>> {
  const registryEntry = YAML_SUBTYPE_REGISTRY[subtype];
  return {
    id,
    version: 1,
    nodeType: 'yaml-file',
    metadata: { name: registryEntry.fileName },
    draftMetadata: null,
    data: {
      name: registryEntry.fileName,
      schemaId: registryEntry.schemaId,
      content: VALID_CONTENT[subtype],
    },
  };
}

export function exactJournal(
  nodeId: string,
  slot: YamlCoreDbInverseMigrationSlot = 'committed',
  legacyName = 'scenario.yml'
): Readonly<Record<string, unknown>> {
  return {
    migrationId: 'yaml-v1-to-v2',
    fromCoreDbVersion: 1,
    toCoreDbVersion: 2,
    nodeId,
    slot,
    legacyName,
    canonicalPostimageDigest: VALID_DIGEST,
  };
}

export function exactInput(
  overrides: Partial<PlanExactYamlCoreDbInverseMigrationInput> = {}
): PlanExactYamlCoreDbInverseMigrationInput {
  return {
    rollbackId: 'yaml-v2-to-v3-exact',
    forwardMigrationId: 'yaml-v1-to-v2',
    currentCoreDbVersion: 2,
    rollbackTargetVersion: 3,
    publicationRequirement: 'canonical-writer-never-published',
    rawNodes: [canonicalNode('scenario-node', 'scenario')],
    rawJournalEntries: [exactJournal('scenario-node')],
    digestSha256Hex: async () => VALID_DIGEST,
    ...overrides,
  };
}

export function releaseInput(
  overrides: Partial<PlanReleaseYamlCoreDbInverseMigrationInput> = {}
): PlanReleaseYamlCoreDbInverseMigrationInput {
  return {
    rollbackId: 'yaml-v2-to-v3-release',
    currentCoreDbVersion: 2,
    rollbackTargetVersion: 3,
    publicationRequirement: 'canonical-writer-published-or-unknown',
    rawNodes: [canonicalNode('scenario-node', 'scenario')],
    ...overrides,
  };
}

export function expectExactPlan(
  result: PlanExactYamlCoreDbInverseMigrationResult
): YamlCoreDbExactInverseMigrationPlan {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('Expected an exact inverse migration plan');
  return result.plan;
}

export function expectReleasePlan(
  result: PlanReleaseYamlCoreDbInverseMigrationResult
): YamlCoreDbReleaseInverseMigrationPlan {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('Expected a release inverse migration plan');
  return result.plan;
}

export function expectInverseErrors(
  result: PlanExactYamlCoreDbInverseMigrationResult | PlanReleaseYamlCoreDbInverseMigrationResult
): readonly YamlCoreDbInverseMigrationError[] {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('Expected inverse migration errors');
  return result.errors;
}
