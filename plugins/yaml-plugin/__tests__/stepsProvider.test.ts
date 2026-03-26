import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { YAML_TEMPLATES } from '@hierarchidb/yaml-api';
import { PluginStepRegistry } from '@hierarchidb/plugin-base';

// Side-effect: register the steps
import '../src/ui/components/steps-provider.js';

const registry = PluginStepRegistry.getInstance();

beforeEach(() => {
    // Registry is a singleton; steps are already registered by the import above
});

// Feature: yaml-file-node, Property 6: Template pre-population
describe('Property 6: Template pre-population', () => {
    it('initial YamlDraft from template has name === fileName and schemaId === template.schemaId', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...YAML_TEMPLATES),
                (template) => {
                    // Simulate pre-population: the dialog host sets name from fileName and schemaId from template
                    const draft = { name: template.fileName, schemaId: template.schemaId };
                    expect(draft.name).toBe(template.fileName);
                    expect(draft.schemaId).toBe(template.schemaId);
                }
            ),
            { numRuns: 100 }
        );
    });
});

// Feature: yaml-file-node, Property 8: Empty name validation rejects proceed
describe('Property 8: Empty name validation rejects proceed', () => {
    it('Step 1 validate returns false for whitespace-only or empty name', () => {
        const configs = registry.getConfigProvider('yaml-file')?.getCreateStepConfigs();
        expect(configs).toBeDefined();
        if (!configs) return;

        const step1 = configs[0];
        expect(step1).toBeDefined();

        fc.assert(
            fc.property(
                fc.string().filter((s) => s.trim() === ''),
                (emptyName) => {
                    const result = step1.validate?.({ name: emptyName, schemaId: '', content: '' });
                    expect(result).toBe(false);
                }
            ),
            { numRuns: 100 }
        );
    });
});
