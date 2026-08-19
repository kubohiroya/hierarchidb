import { describe, expect, it } from 'vitest';
import {
  YAML_COMMAND_CAPABILITIES,
  YAML_COMMAND_IDS,
  YAML_SUBTYPE_REGISTRY,
} from '../src/YAML_SUBTYPE_REGISTRY.js';
import { YamlContractError, type YamlContractErrorCode } from '../src/YamlContractError.js';
import { YAML_SUBTYPES } from '../src/YamlSubtype.js';
import {
  validateYamlCanonicalFilename,
  validateYamlCommandForSubtype,
  validateYamlCommandId,
  validateYamlSchemaId,
  validateYamlSubtype,
  validateYamlSubtypeContract,
} from '../src/yamlContractValidatorsUtils.js';

const EXPECTED_COMMAND_CAPABILITIES = {
  sources: [{ commandId: 'install', mutationName: 'install' }],
  scenario: [
    { commandId: 'check', mutationName: 'checkAll' },
    { commandId: 'check-merge', mutationName: 'checkMerge' },
    { commandId: 'preview-events', mutationName: 'previewEvents' },
    { commandId: 'calib', mutationName: 'calibrate' },
    { commandId: 'sim', mutationName: 'simulate' },
    { commandId: 'purge-cache', mutationName: 'purgeCache' },
  ],
  'scenario-base': [],
  calib: [],
  remote: [
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
  'remote-base': [],
  ssh: [
    { commandId: 'calib-ssh', mutationName: 'calibrateSsh' },
    { commandId: 'sim-ssh', mutationName: 'simulateSsh' },
  ],
  'ssh-base': [],
  ec2: [
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
  'ec2-base': [],
  rsync: [
    { commandId: 'rsync-push', mutationName: 'rsyncPush' },
    { commandId: 'rsync-pull', mutationName: 'rsyncPull' },
  ],
  git: [{ commandId: 'init', mutationName: 'init' }],
} as const;

function captureContractError(operation: () => unknown): YamlContractError {
  try {
    operation();
  } catch (error) {
    if (error instanceof YamlContractError) {
      return error;
    }
    throw error;
  }
  throw new Error('Expected a YamlContractError');
}

const INVALID_CONTRACT_CASES = [
  ['UNKNOWN_SUBTYPE', () => validateYamlSubtype('generic')],
  ['UNKNOWN_COMMAND', () => validateYamlCommandId('start-daemon-ssh')],
  ['UNKNOWN_SCHEMA', () => validateYamlSchemaId('ide-gsm/unknown')],
  ['UNKNOWN_FILENAME', () => validateYamlCanonicalFilename('other.yml')],
  ['COMMAND_NOT_ALLOWED', () => validateYamlCommandForSubtype('scenario-base', 'check')],
  [
    'SCHEMA_MISMATCH',
    () =>
      validateYamlSubtypeContract({
        subtype: 'scenario',
        schemaId: 'ide-gsm/ssh',
        fileName: 'scenario.yml',
      }),
  ],
  [
    'FILENAME_MISMATCH',
    () =>
      validateYamlSubtypeContract({
        subtype: 'scenario',
        schemaId: 'ide-gsm/scenario',
        fileName: 'scenario-base.yml',
      }),
  ],
] as const satisfies readonly (readonly [YamlContractErrorCode, () => unknown])[];

describe('YAML subtype command capability registry', () => {
  it('is total for all 12 subtypes and exactly matches the canonical map', () => {
    expect(Object.keys(YAML_SUBTYPE_REGISTRY)).toEqual(YAML_SUBTYPES);
    expect(YAML_COMMAND_CAPABILITIES).toEqual(EXPECTED_COMMAND_CAPABILITIES);
  });

  it('derives 20 unique command mappings from the subtype registry', () => {
    expect(Object.values(YAML_COMMAND_CAPABILITIES).flat()).toHaveLength(20);
    expect(YAML_COMMAND_IDS).toHaveLength(20);
    expect(new Set(YAML_COMMAND_IDS).size).toBe(20);
  });

  it('does not expose forbidden aliases or unsupported mutations', () => {
    const serializedRegistry = JSON.stringify(YAML_SUBTYPE_REGISTRY);
    expect(serializedRegistry).not.toContain('checkProject');
    expect(serializedRegistry).not.toContain('start-daemon');
    expect(serializedRegistry).not.toContain('start-container-ssh');
    expect(serializedRegistry).not.toContain('stop-container-ssh');
    expect(serializedRegistry).not.toContain('gitClone');
    expect(serializedRegistry).not.toContain('gitPull');
  });
});

describe('strict YAML contract validators', () => {
  it('returns the pinned checkAll mapping for scenario/check', () => {
    expect(validateYamlCommandForSubtype('scenario', 'check')).toEqual({
      subtype: 'scenario',
      commandId: 'check',
      mutationName: 'checkAll',
    });
  });

  it.each(INVALID_CONTRACT_CASES)(
    'raises typed error %s without fallback',
    (expectedCode, operation) => {
      expect(captureContractError(operation).code).toBe(expectedCode);
    }
  );

  it('does not echo unknown input values into errors', () => {
    const sensitiveValue = 'credential-value-must-not-leak';
    const operations = [
      () => validateYamlSubtype(sensitiveValue),
      () => validateYamlCommandId(sensitiveValue),
      () => validateYamlSchemaId(sensitiveValue),
      () => validateYamlCanonicalFilename(sensitiveValue),
    ];

    for (const operation of operations) {
      const error = captureContractError(operation);
      expect(error.message).not.toContain(sensitiveValue);
      expect(JSON.stringify(error.context)).not.toContain(sensitiveValue);
    }
  });
});
