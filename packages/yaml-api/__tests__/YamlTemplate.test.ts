import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { YAML_TEMPLATES, findYamlTemplate } from '../src/YamlTemplate.js';

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
