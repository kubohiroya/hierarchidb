import { describe, expect, it } from 'vitest';
import { YAML_SUBTYPE_REGISTRY } from '../../YAML_SUBTYPE_REGISTRY.js';
import { planReleaseYamlCoreDbInverseMigration } from '../planReleaseYamlCoreDbInverseMigration.js';
import type { PlanReleaseYamlCoreDbInverseMigrationInput } from '../yamlCoreDbInverseMigrationTypes.js';
import {
  canonicalNode,
  expectInverseErrors,
  expectReleasePlan,
  legacyNode,
  releaseInput,
  VALID_CONTENT,
} from './yamlCoreDbInverseMigrationTestUtils.js';

describe('planReleaseYamlCoreDbInverseMigration success contract', () => {
  it('restores every registered canonical subtype from metadata in deterministic order', () => {
    const rawNodes = Object.keys(YAML_SUBTYPE_REGISTRY)
      .reverse()
      .map((subtype, sourceIndex) =>
        canonicalNode(`${subtype}-node`, subtype as keyof typeof YAML_SUBTYPE_REGISTRY, sourceIndex)
      );
    const plan = expectReleasePlan(
      planReleaseYamlCoreDbInverseMigration(releaseInput({ rawNodes }))
    );

    expect(plan.entries).toHaveLength(Object.keys(YAML_SUBTYPE_REGISTRY).length);
    expect(plan.entries.map(({ nodeId }) => nodeId)).toEqual(
      [...plan.entries.map(({ nodeId }) => nodeId)].sort()
    );
    for (const entry of plan.entries) {
      expect(entry.action).toBe('restore-release-legacy');
      if (entry.action !== 'restore-release-legacy') continue;
      const subtype = entry.preimage.subtype;
      expect(entry.postimage).toEqual({
        name: YAML_SUBTYPE_REGISTRY[subtype].fileName,
        schemaId: YAML_SUBTYPE_REGISTRY[subtype].schemaId,
        content: VALID_CONTENT[subtype],
      });
      expect(entry.postimage.schemaId).toBe(entry.preimage.schemaId);
      expect(entry.postimage.content).toBe(entry.preimage.content);
    }
  });

  it('handles committed and draft slots and preserves structural no-ops', () => {
    const scenario = YAML_SUBTYPE_REGISTRY.scenario;
    const git = YAML_SUBTYPE_REGISTRY.git;
    const committedAndDraft = {
      ...canonicalNode('both', 'scenario'),
      draftMetadata: { name: git.fileName },
      draftData: {
        subtype: 'git',
        schemaId: git.schemaId,
        content: VALID_CONTENT.git,
      },
    };
    const placeholder = {
      id: 'placeholder',
      version: 0,
      nodeType: 'yaml-file',
      metadata: { name: scenario.fileName },
      draftMetadata: { name: scenario.fileName },
      data: null,
      draftData: {},
      isTemporary: true,
    };
    const metadataOnly = {
      ...canonicalNode('metadata-only', 'scenario'),
      draftMetadata: { name: scenario.fileName },
    };
    const plan = expectReleasePlan(
      planReleaseYamlCoreDbInverseMigration(
        releaseInput({ rawNodes: [placeholder, metadataOnly, committedAndDraft] })
      )
    );

    expect(plan.entries.map(({ nodeId, slot, action }) => [nodeId, slot, action])).toEqual([
      ['both', 'committed', 'restore-release-legacy'],
      ['both', 'draft', 'restore-release-legacy'],
      ['metadata-only', 'committed', 'restore-release-legacy'],
      ['metadata-only', 'draft', 'validated-noop'],
      ['placeholder', 'draft', 'validated-noop'],
    ]);
  });

  it('returns complete guards and a deeply frozen plan without mutating inputs', () => {
    const rawNode = canonicalNode('scenario-node', 'scenario', 9);
    const input = releaseInput({ rawNodes: [rawNode] });
    const plan = expectReleasePlan(planReleaseYamlCoreDbInverseMigration(input));

    expect(input.rawNodes[0]).toBe(rawNode);
    expect(plan.nodeGuards).toEqual([
      { sourceIndex: 0, nodeId: 'scenario-node', expectedVersion: 9 },
    ]);
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.nodeGuards)).toBe(true);
    expect(Object.isFrozen(plan.nodeGuards[0])).toBe(true);
    expect(Object.isFrozen(plan.entries)).toBe(true);
    const entry = plan.entries[0];
    expect(Object.isFrozen(entry)).toBe(true);
    if (entry?.action === 'restore-release-legacy') {
      expect(Object.isFrozen(entry.preimage)).toBe(true);
      expect(Object.isFrozen(entry.postimage)).toBe(true);
    }
  });
});

describe('planReleaseYamlCoreDbInverseMigration fail-closed matrix', () => {
  it.each([
    ['legacy payload', legacyNode('legacy', 'scenario'), 'LEGACY_PAYLOAD'],
    [
      'mixed payload',
      {
        ...canonicalNode('mixed', 'scenario'),
        data: {
          subtype: 'scenario',
          name: 'scenario.yml',
          schemaId: 'ide-gsm/scenario',
          content: VALID_CONTENT.scenario,
        },
      },
      'MIXED_PAYLOAD',
    ],
    [
      'incomplete payload',
      {
        ...canonicalNode('incomplete', 'scenario'),
        data: { subtype: 'scenario', schemaId: 'ide-gsm/scenario' },
      },
      'INCOMPLETE_PAYLOAD',
    ],
    [
      'unknown payload field',
      {
        ...canonicalNode('unknown', 'scenario'),
        data: {
          subtype: 'scenario',
          schemaId: 'ide-gsm/scenario',
          content: VALID_CONTENT.scenario,
          secret: 'must-not-pass',
        },
      },
      'UNKNOWN_PAYLOAD_FIELD',
    ],
    [
      'metadata mismatch',
      { ...canonicalNode('mismatch', 'scenario'), metadata: { name: 'git.yml' } },
      'UNKNOWN_REGISTRY_TUPLE',
    ],
    [
      'invalid YAML',
      {
        ...canonicalNode('invalid-yaml', 'scenario'),
        data: {
          subtype: 'scenario',
          schemaId: 'ide-gsm/scenario',
          content: 'credential: [invalid YAML',
        },
      },
      'INVALID_YAML',
    ],
    [
      'schema-invalid YAML',
      {
        ...canonicalNode('invalid-schema', 'ssh'),
        data: {
          subtype: 'ssh',
          schemaId: 'ide-gsm/ssh',
          content: 'host: ssh.example.test\n',
        },
      },
      'CONTENT_SCHEMA_INVALID',
    ],
  ])('rejects %s all-or-none', (_label, rawNode, expectedCode) => {
    const result = planReleaseYamlCoreDbInverseMigration(
      releaseInput({ rawNodes: [canonicalNode('valid', 'git'), rawNode] })
    );
    const errors = expectInverseErrors(result);

    expect(errors.map(({ code }) => code)).toContain(expectedCode);
    expect(result).not.toHaveProperty('plan');
    expect(JSON.stringify(errors)).not.toMatch(/credential|must-not-pass/);
  });

  it.each([
    ['array node', [], 'INVALID_RAW_NODE'],
    ['non-plain node', new Date(0), 'INVALID_RAW_NODE'],
    [
      'unknown node field',
      { ...canonicalNode('unknown-node', 'scenario'), unexpected: 'secret' },
      'UNKNOWN_RAW_NODE_FIELD',
    ],
    [
      'invalid version',
      { ...canonicalNode('bad-version', 'scenario'), version: -1 },
      'INVALID_NODE_VERSION',
    ],
  ])('rejects %s', (_label, rawNode, expectedCode) => {
    const result = planReleaseYamlCoreDbInverseMigration(releaseInput({ rawNodes: [rawNode] }));
    const errors = expectInverseErrors(result);

    expect(errors.map(({ code }) => code)).toContain(expectedCode);
    expect(JSON.stringify(errors)).not.toContain('secret');
  });

  it('rejects duplicate node IDs without a partial plan', () => {
    const result = planReleaseYamlCoreDbInverseMigration(
      releaseInput({
        rawNodes: [canonicalNode('duplicate', 'scenario'), canonicalNode('duplicate', 'git')],
      })
    );

    expect(expectInverseErrors(result).map(({ code }) => code)).toEqual([
      'DUPLICATE_NODE_ID',
      'DUPLICATE_NODE_ID',
    ]);
    expect(result).not.toHaveProperty('plan');
  });

  it.each([
    ['missing publication proof', { publicationRequirement: undefined }],
    ['wrong publication proof', { publicationRequirement: 'never-published' }],
    ['empty rollback ID', { rollbackId: ' ' }],
    ['same target version', { rollbackTargetVersion: 2 }],
    ['unsafe current version', { currentCoreDbVersion: Number.MAX_SAFE_INTEGER + 1 }],
  ])('rejects %s', (_label, override) => {
    const result = planReleaseYamlCoreDbInverseMigration(
      releaseInput(override as Partial<PlanReleaseYamlCoreDbInverseMigrationInput>)
    );
    expect(result.ok).toBe(false);
  });

  it('does not execute top-level or raw-node accessors', () => {
    const input = releaseInput();
    let inputGetterCalls = 0;
    Object.defineProperty(input, 'rollbackId', {
      configurable: true,
      enumerable: true,
      get() {
        inputGetterCalls += 1;
        throw new Error('top-level secret');
      },
    });
    const inputErrors = expectInverseErrors(planReleaseYamlCoreDbInverseMigration(input));
    expect(inputGetterCalls).toBe(0);
    expect(inputErrors.map(({ code }) => code)).toEqual(['INVALID_INPUT']);

    const rawNode = canonicalNode('scenario-node', 'scenario');
    let nodeGetterCalls = 0;
    Object.defineProperty(rawNode, 'data', {
      configurable: true,
      enumerable: true,
      get() {
        nodeGetterCalls += 1;
        throw new Error('payload secret');
      },
    });
    const nodeErrors = expectInverseErrors(
      planReleaseYamlCoreDbInverseMigration(releaseInput({ rawNodes: [rawNode] }))
    );
    expect(nodeGetterCalls).toBe(0);
    expect(nodeErrors.map(({ code }) => code)).toEqual(['UNSAFE_PROPERTY_DESCRIPTOR']);
    expect(JSON.stringify([...inputErrors, ...nodeErrors])).not.toContain('secret');
  });

  it('turns top-level and raw-node Proxy failures into stable redacted errors', () => {
    const inputRevocable = Proxy.revocable(releaseInput(), {});
    inputRevocable.revoke();
    const inputResult = planReleaseYamlCoreDbInverseMigration(
      inputRevocable.proxy as PlanReleaseYamlCoreDbInverseMigrationInput
    );
    expect(expectInverseErrors(inputResult).map(({ code }) => code)).toEqual(['INVALID_INPUT']);

    const rawNodeProxy = new Proxy(canonicalNode('scenario-node', 'scenario'), {
      ownKeys() {
        throw new Error('raw node proxy secret');
      },
    });
    const rawNodeResult = planReleaseYamlCoreDbInverseMigration(
      releaseInput({ rawNodes: [rawNodeProxy] })
    );
    const rawNodeErrors = expectInverseErrors(rawNodeResult);
    expect(rawNodeErrors.map(({ code }) => code)).toEqual(['RAW_RECORD_ACCESS_FAILED']);
    expect(JSON.stringify(rawNodeErrors)).not.toContain('secret');
  });
});
