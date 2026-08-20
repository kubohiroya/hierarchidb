import { describe, expect, it, vi } from 'vitest';
import { YAML_SUBTYPE_REGISTRY } from '../../YAML_SUBTYPE_REGISTRY.js';
import { planExactYamlCoreDbInverseMigration } from '../planExactYamlCoreDbInverseMigration.js';
import type { PlanExactYamlCoreDbInverseMigrationInput } from '../yamlCoreDbInverseMigrationTypes.js';
import {
  canonicalNode,
  exactInput,
  exactJournal,
  expectExactPlan,
  expectInverseErrors,
  VALID_CONTENT,
  VALID_DIGEST,
} from './yamlCoreDbInverseMigrationTestUtils.js';

describe('planExactYamlCoreDbInverseMigration success contract', () => {
  it('restores only journaled slots and returns deterministic complete guards', async () => {
    const input = exactInput({
      rawNodes: [canonicalNode('z-node', 'scenario', 7), canonicalNode('a-node', 'git', 3)],
      rawJournalEntries: [exactJournal('z-node')],
    });

    const plan = expectExactPlan(await planExactYamlCoreDbInverseMigration(input));

    expect(plan).toMatchObject({
      rollbackId: 'yaml-v2-to-v3-exact',
      forwardMigrationId: 'yaml-v1-to-v2',
      currentCoreDbVersion: 2,
      rollbackTargetVersion: 3,
      publicationRequirement: 'canonical-writer-never-published',
    });
    expect(plan.nodeGuards).toEqual([
      { sourceIndex: 1, nodeId: 'a-node', expectedVersion: 3 },
      { sourceIndex: 0, nodeId: 'z-node', expectedVersion: 7 },
    ]);
    expect(plan.journalGuards).toEqual([
      {
        sourceIndex: 0,
        migrationId: 'yaml-v1-to-v2',
        fromCoreDbVersion: 1,
        toCoreDbVersion: 2,
        nodeId: 'z-node',
        slot: 'committed',
        legacyName: 'scenario.yml',
        canonicalPostimageDigest: VALID_DIGEST,
      },
    ]);
    expect(plan.entries).toEqual([
      {
        action: 'validated-noop',
        nodeId: 'a-node',
        slot: 'committed',
        reason: 'non-journal-canonical',
      },
      {
        action: 'restore-exact-legacy',
        nodeId: 'z-node',
        slot: 'committed',
        preimage: {
          subtype: 'scenario',
          schemaId: 'ide-gsm/scenario',
          content: VALID_CONTENT.scenario,
        },
        postimage: {
          name: 'scenario.yml',
          schemaId: 'ide-gsm/scenario',
          content: VALID_CONTENT.scenario,
        },
        expectedCanonicalPostimageDigest: VALID_DIGEST,
      },
    ]);
  });

  it('handles committed and draft journal slots while preserving placeholder and metadata-only no-ops', async () => {
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
    const plan = expectExactPlan(
      await planExactYamlCoreDbInverseMigration(
        exactInput({
          rawNodes: [metadataOnly, placeholder, committedAndDraft],
          rawJournalEntries: [
            exactJournal('both', 'draft', git.fileName),
            exactJournal('both', 'committed', scenario.fileName),
          ],
        })
      )
    );

    expect(plan.entries.map(({ nodeId, slot, action }) => [nodeId, slot, action])).toEqual([
      ['both', 'committed', 'restore-exact-legacy'],
      ['both', 'draft', 'restore-exact-legacy'],
      ['metadata-only', 'committed', 'validated-noop'],
      ['metadata-only', 'draft', 'validated-noop'],
      ['placeholder', 'draft', 'validated-noop'],
    ]);
  });

  it('returns a deeply frozen plan without mutating inputs', async () => {
    const rawNode = canonicalNode('scenario-node', 'scenario');
    const rawJournal = exactJournal('scenario-node');
    const input = exactInput({ rawNodes: [rawNode], rawJournalEntries: [rawJournal] });
    const plan = expectExactPlan(await planExactYamlCoreDbInverseMigration(input));

    expect(input.rawNodes[0]).toBe(rawNode);
    expect(input.rawJournalEntries[0]).toBe(rawJournal);
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.nodeGuards)).toBe(true);
    expect(Object.isFrozen(plan.nodeGuards[0])).toBe(true);
    expect(Object.isFrozen(plan.journalGuards)).toBe(true);
    expect(Object.isFrozen(plan.journalGuards[0])).toBe(true);
    expect(Object.isFrozen(plan.entries)).toBe(true);
    const entry = plan.entries[0];
    expect(entry).toBeDefined();
    if (entry?.action === 'restore-exact-legacy') {
      expect(Object.isFrozen(entry)).toBe(true);
      expect(Object.isFrozen(entry.preimage)).toBe(true);
      expect(Object.isFrozen(entry.postimage)).toBe(true);
    }
  });

  it('preserves non-empty whitespace-only rollback and forward migration IDs', async () => {
    const plan = expectExactPlan(
      await planExactYamlCoreDbInverseMigration(
        exactInput({
          rollbackId: ' ',
          forwardMigrationId: ' ',
          rawJournalEntries: [{ ...exactJournal('scenario-node'), migrationId: ' ' }],
        })
      )
    );

    expect(plan.rollbackId).toBe(' ');
    expect(plan.forwardMigrationId).toBe(' ');
    expect(plan.journalGuards[0]?.migrationId).toBe(' ');
  });
});

describe('planExactYamlCoreDbInverseMigration journal contract', () => {
  it.each([
    [
      'migration ID mismatch',
      [{ ...exactJournal('scenario-node'), migrationId: 'other' }],
      'JOURNAL_MIGRATION_ID_MISMATCH',
    ],
    [
      'invalid version pair',
      [{ ...exactJournal('scenario-node'), toCoreDbVersion: 1 }],
      'INVALID_JOURNAL_FIELD',
    ],
    [
      'unknown field',
      [{ ...exactJournal('scenario-node'), secret: 'must-not-pass' }],
      'INVALID_RAW_JOURNAL_ENTRY',
    ],
    [
      'missing field',
      [
        {
          migrationId: 'yaml-v1-to-v2',
          fromCoreDbVersion: 1,
          toCoreDbVersion: 2,
          nodeId: 'scenario-node',
          slot: 'committed',
          legacyName: 'scenario.yml',
        },
      ],
      'INVALID_RAW_JOURNAL_ENTRY',
    ],
    ['missing node', [exactJournal('missing-node')], 'JOURNAL_NODE_NOT_FOUND'],
    ['missing slot', [exactJournal('scenario-node', 'draft')], 'JOURNAL_SLOT_NOT_FOUND'],
    [
      'digest mismatch',
      [{ ...exactJournal('scenario-node'), canonicalPostimageDigest: 'f'.repeat(64) }],
      'JOURNAL_DIGEST_MISMATCH',
    ],
    [
      'legacy name mismatch',
      [exactJournal('scenario-node', 'committed', 'git.yml')],
      'JOURNAL_LEGACY_NAME_MISMATCH',
    ],
  ])('rejects %s without returning a partial plan', async (_label, journals, expectedCode) => {
    const result = await planExactYamlCoreDbInverseMigration(
      exactInput({ rawJournalEntries: journals })
    );
    const errors = expectInverseErrors(result);

    expect(errors.map(({ code }) => code)).toContain(expectedCode);
    expect(result).not.toHaveProperty('plan');
  });

  it('rejects duplicate compound keys and mixed forward-version cohorts', async () => {
    const git = YAML_SUBTYPE_REGISTRY.git;
    const node = {
      ...canonicalNode('scenario-node', 'scenario'),
      draftMetadata: { name: git.fileName },
      draftData: {
        subtype: 'git',
        schemaId: git.schemaId,
        content: VALID_CONTENT.git,
      },
    };
    const duplicateResult = await planExactYamlCoreDbInverseMigration(
      exactInput({
        rawJournalEntries: [exactJournal('scenario-node'), exactJournal('scenario-node')],
      })
    );
    expect(expectInverseErrors(duplicateResult).map(({ code }) => code)).toContain(
      'DUPLICATE_JOURNAL_KEY'
    );

    const cohortResult = await planExactYamlCoreDbInverseMigration(
      exactInput({
        currentCoreDbVersion: 4,
        rollbackTargetVersion: 5,
        rawNodes: [node],
        rawJournalEntries: [
          exactJournal('scenario-node'),
          {
            ...exactJournal('scenario-node', 'draft', git.fileName),
            fromCoreDbVersion: 2,
            toCoreDbVersion: 3,
          },
        ],
      })
    );
    expect(expectInverseErrors(cohortResult).map(({ code }) => code)).toContain(
      'JOURNAL_VERSION_COHORT_MISMATCH'
    );
  });

  it.each([
    [
      'port rejection',
      async () => Promise.reject(new Error('raw digest secret')),
      'DIGEST_PORT_FAILED',
    ],
    ['invalid output', async () => 'ABC', 'INVALID_DIGEST_OUTPUT'],
  ])('sanitizes %s', async (_label, digestSha256Hex, expectedCode) => {
    const result = await planExactYamlCoreDbInverseMigration(exactInput({ digestSha256Hex }));
    const errors = expectInverseErrors(result);

    expect(errors.map(({ code }) => code)).toContain(expectedCode);
    expect(JSON.stringify(errors)).not.toContain('raw digest secret');
  });
});

describe('planExactYamlCoreDbInverseMigration fail-closed boundary', () => {
  it.each([
    ['missing publication proof', { publicationRequirement: undefined }],
    ['wrong publication proof', { publicationRequirement: 'published' }],
    ['empty rollback ID', { rollbackId: '' }],
    ['empty forward migration ID', { forwardMigrationId: '' }],
    ['same target version', { rollbackTargetVersion: 2 }],
    ['unsafe current version', { currentCoreDbVersion: Number.MAX_SAFE_INTEGER + 1 }],
  ])('rejects %s', async (_label, override) => {
    const result = await planExactYamlCoreDbInverseMigration(
      exactInput(override as Partial<PlanExactYamlCoreDbInverseMigrationInput>)
    );
    expect(result.ok).toBe(false);
  });

  it('does not execute a top-level input getter', async () => {
    const input = exactInput();
    let getterCalls = 0;
    Object.defineProperty(input, 'rollbackId', {
      configurable: true,
      enumerable: true,
      get() {
        getterCalls += 1;
        throw new Error('top-level secret');
      },
    });

    const result = await planExactYamlCoreDbInverseMigration(input);
    const errors = expectInverseErrors(result);
    expect(getterCalls).toBe(0);
    expect(errors.map(({ code }) => code)).toEqual(['INVALID_INPUT']);
    expect(JSON.stringify(errors)).not.toContain('top-level secret');
  });

  it('turns a revoked top-level input Proxy into a stable redacted error', async () => {
    const revocable = Proxy.revocable(exactInput(), {});
    revocable.revoke();
    const result = await planExactYamlCoreDbInverseMigration(
      revocable.proxy as PlanExactYamlCoreDbInverseMigrationInput
    );

    expect(expectInverseErrors(result).map(({ code }) => code)).toEqual(['INVALID_INPUT']);
  });

  it('rejects accessor-backed and extended snapshot arrays without executing accessors', async () => {
    const rawNodes = [canonicalNode('scenario-node', 'scenario')];
    let arrayGetterCalls = 0;
    Object.defineProperty(rawNodes, '0', {
      configurable: true,
      enumerable: true,
      get() {
        arrayGetterCalls += 1;
        throw new Error('snapshot secret');
      },
    });
    const nodeResult = await planExactYamlCoreDbInverseMigration(exactInput({ rawNodes }));
    const nodeErrors = expectInverseErrors(nodeResult);
    expect(arrayGetterCalls).toBe(0);
    expect(nodeErrors.map(({ code }) => code)).toEqual(['INVALID_RAW_NODES']);

    const rawJournalEntries = [exactJournal('scenario-node')];
    Object.defineProperty(rawJournalEntries, Symbol('journal-secret'), {
      configurable: true,
      enumerable: false,
      value: 'must-not-pass',
    });
    const journalResult = await planExactYamlCoreDbInverseMigration(
      exactInput({ rawJournalEntries })
    );
    const journalErrors = expectInverseErrors(journalResult);
    expect(journalErrors.map(({ code }) => code)).toEqual(['INVALID_RAW_JOURNAL']);
    expect(JSON.stringify([...nodeErrors, ...journalErrors])).not.toContain('secret');
  });

  it('rejects symbol fields on raw nodes and journals', async () => {
    const rawNode = canonicalNode('scenario-node', 'scenario');
    Object.defineProperty(rawNode, Symbol('node-secret'), {
      configurable: true,
      enumerable: false,
      value: 'must-not-pass',
    });
    const rawJournal = exactJournal('scenario-node');
    Object.defineProperty(rawJournal, Symbol('journal-secret'), {
      configurable: true,
      enumerable: false,
      value: 'must-not-pass',
    });
    const result = await planExactYamlCoreDbInverseMigration(
      exactInput({ rawNodes: [rawNode], rawJournalEntries: [rawJournal] })
    );
    const errors = expectInverseErrors(result);

    expect(errors.map(({ code }) => code)).toEqual([
      'INVALID_RAW_JOURNAL_ENTRY',
      'UNKNOWN_RAW_NODE_FIELD',
    ]);
    expect(JSON.stringify(errors)).not.toContain('must-not-pass');
  });

  it('does not execute raw node or journal accessors and redacts their thrown messages', async () => {
    let nodeGetterCalls = 0;
    const rawNode = canonicalNode('scenario-node', 'scenario');
    Object.defineProperty(rawNode, 'data', {
      configurable: true,
      enumerable: true,
      get() {
        nodeGetterCalls += 1;
        throw new Error('node YAML secret');
      },
    });
    let journalGetterCalls = 0;
    const journal = exactJournal('scenario-node');
    Object.defineProperty(journal, 'legacyName', {
      configurable: true,
      enumerable: true,
      get() {
        journalGetterCalls += 1;
        throw new Error('journal secret');
      },
    });

    const result = await planExactYamlCoreDbInverseMigration(
      exactInput({ rawNodes: [rawNode], rawJournalEntries: [journal] })
    );
    const errors = expectInverseErrors(result);
    expect(nodeGetterCalls).toBe(0);
    expect(journalGetterCalls).toBe(0);
    expect(errors.map(({ code }) => code)).toEqual([
      'UNSAFE_PROPERTY_DESCRIPTOR',
      'UNSAFE_PROPERTY_DESCRIPTOR',
    ]);
    expect(JSON.stringify(errors)).not.toMatch(/node YAML secret|journal secret/);
  });

  it('rejects raw node and journal Proxy failures without leaking trap messages', async () => {
    const rawNodeProxy = new Proxy(canonicalNode('scenario-node', 'scenario'), {
      ownKeys() {
        throw new Error('raw node proxy secret');
      },
    });
    const journalProxy = new Proxy(exactJournal('scenario-node'), {
      getPrototypeOf() {
        throw new Error('journal proxy secret');
      },
    });
    const result = await planExactYamlCoreDbInverseMigration(
      exactInput({ rawNodes: [rawNodeProxy], rawJournalEntries: [journalProxy] })
    );
    const errors = expectInverseErrors(result);

    expect(errors.map(({ code }) => code)).toEqual([
      'INVALID_RAW_JOURNAL_ENTRY',
      'RAW_RECORD_ACCESS_FAILED',
    ]);
    expect(JSON.stringify(errors)).not.toContain('secret');
  });

  it('rejects one invalid canonical payload without returning entries or guards', async () => {
    const invalid = {
      ...canonicalNode('invalid', 'scenario'),
      data: {
        subtype: 'scenario',
        schemaId: 'ide-gsm/scenario',
        content: 'private: [invalid YAML',
      },
    };
    const result = await planExactYamlCoreDbInverseMigration(
      exactInput({
        rawNodes: [canonicalNode('valid', 'scenario'), invalid],
        rawJournalEntries: [exactJournal('valid')],
      })
    );
    const errors = expectInverseErrors(result);

    expect(errors.map(({ code }) => code)).toContain('INVALID_YAML');
    expect(result).not.toHaveProperty('plan');
    expect(JSON.stringify(errors)).not.toContain('private');
  });

  it('uses only the injected digest port', async () => {
    const digestSha256Hex = vi.fn(async () => VALID_DIGEST);
    const plan = expectExactPlan(
      await planExactYamlCoreDbInverseMigration(exactInput({ digestSha256Hex }))
    );

    expect(plan.entries[0]?.action).toBe('restore-exact-legacy');
    expect(digestSha256Hex).toHaveBeenCalledTimes(1);
    expect(digestSha256Hex.mock.calls[0]?.[0]).toBeInstanceOf(Uint8Array);
  });
});
