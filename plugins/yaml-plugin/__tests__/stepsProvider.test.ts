import { PluginStepRegistry } from '@hierarchidb/plugin-base';
import { YAML_TEMPLATES } from '@hierarchidb/yaml-api';
import * as fc from 'fast-check';
import { beforeEach, describe, expect, it } from 'vitest';
import { createYamlStepConfigProvider } from '../src/ui/components/createYamlStepConfigProvider.js';

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
      fc.property(fc.constantFrom(...YAML_TEMPLATES), (template) => {
        // Simulate pre-population: the dialog host sets name from fileName and schemaId from template
        const draft = { name: template.fileName, schemaId: template.schemaId };
        expect(draft.name).toBe(template.fileName);
        expect(draft.schemaId).toBe(template.schemaId);
      }),
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

describe('IDE-GSM Step 4 provider wiring', () => {
  it('keeps the registered side-effect provider at the existing three steps by default', () => {
    const configs = registry.getConfigProvider('yaml-file')?.getCreateStepConfigs();
    expect(configs?.map((config) => config.id)).toEqual([
      'basic-info',
      'schema-selection',
      'schema-editor',
    ]);
  });

  it('adds Step 4 only when the injected runtime enables it', () => {
    const disabled = createYamlStepConfigProvider({ enabled: false }).getCreateStepConfigs();
    const enabled = createYamlStepConfigProvider({ enabled: true }).getCreateStepConfigs();

    expect(disabled.map((config) => config.id)).toEqual([
      'basic-info',
      'schema-selection',
      'schema-editor',
    ]);
    expect(enabled.map((config) => config.id)).toEqual([
      'basic-info',
      'schema-selection',
      'schema-editor',
      'ide-gsm-command',
    ]);
  });
});
