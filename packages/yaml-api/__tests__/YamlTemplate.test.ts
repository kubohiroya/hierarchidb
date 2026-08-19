import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { YAML_SUBTYPES } from '../src/YamlSubtype.js';
import {
  findYamlTemplate,
  YAML_CANONICAL_TEMPLATES,
  YAML_TEMPLATE_REGISTRY,
  YAML_TEMPLATES,
} from '../src/YamlTemplate.js';

const EXPECTED_TEMPLATE_CONTRACT = [
  ['sources', 'ide-gsm/sources', 'sources.yml'],
  ['scenario', 'ide-gsm/scenario', 'scenario.yml'],
  ['scenario-base', 'ide-gsm/scenario', 'scenario-base.yml'],
  ['calib', 'ide-gsm/calib', 'calib.yml'],
  ['remote', 'ide-gsm/remote', 'remote.yml'],
  ['remote-base', 'ide-gsm/remote', 'remote-base.yml'],
  ['ssh', 'ide-gsm/ssh', 'ssh.yml'],
  ['ssh-base', 'ide-gsm/ssh', 'ssh-base.yml'],
  ['ec2', 'ide-gsm/ec2', 'ec2.yml'],
  ['ec2-base', 'ide-gsm/ec2', 'ec2-base.yml'],
  ['rsync', 'ide-gsm/rsync', 'rsync.yml'],
  ['git', 'ide-gsm/git', 'git.yml'],
] as const;

describe('canonical YAML template contract', () => {
  it('defines all 12 subtype/schema/filename rows exactly once', () => {
    expect(YAML_CANONICAL_TEMPLATES).toHaveLength(12);
    expect(Object.keys(YAML_TEMPLATE_REGISTRY)).toEqual(YAML_SUBTYPES);
    expect(
      YAML_CANONICAL_TEMPLATES.map((template) => [
        template.subtype,
        template.schemaId,
        template.fileName,
      ])
    ).toEqual(EXPECTED_TEMPLATE_CONTRACT);
  });

  it('keeps the existing runtime template list at 10 entries', () => {
    expect(YAML_TEMPLATES).toHaveLength(10);
    expect(YAML_TEMPLATES.map((template) => template.subtype)).not.toContain('rsync');
    expect(YAML_TEMPLATES.map((template) => template.subtype)).not.toContain('git');
  });
});

// Feature: yaml-file-node, Property 1: YAML_TEMPLATES uniqueness invariant
describe('Property 1: YAML_TEMPLATES uniqueness invariant', () => {
  it('all templateId values are unique', () => {
    const ids = YAML_TEMPLATES.map((t) => t.templateId);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('all fileName values are unique', () => {
    const names = YAML_TEMPLATES.map((t) => t.fileName);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it('for any two distinct entries, templateId and fileName differ', () => {
    for (let i = 0; i < YAML_TEMPLATES.length; i++) {
      for (let j = i + 1; j < YAML_TEMPLATES.length; j++) {
        const a = YAML_TEMPLATES[i];
        const b = YAML_TEMPLATES[j];
        expect(a.templateId).not.toBe(b.templateId);
        expect(a.fileName).not.toBe(b.fileName);
      }
    }
  });
});

// Feature: yaml-file-node, Property 2: Unknown templateId lookup returns undefined
describe('Property 2: Unknown templateId lookup returns undefined', () => {
  const knownIds = new Set(YAML_TEMPLATES.map((t) => t.templateId));

  it('findYamlTemplate returns undefined for any string not in YAML_TEMPLATES', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !knownIds.has(s)),
        (unknownId) => {
          const result = findYamlTemplate(unknownId);
          expect(result).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});
