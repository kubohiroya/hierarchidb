import { describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PluginStepRegistry } from '@hierarchidb/plugin-base';
import type { ShapeEntity } from '../../../common/types/index.js';
import { DEFAULT_BUILD_CONFIG, summarizeCheckboxState, validateBatchConfig } from '../../../common/types/index.js';
import '../../components/steps-provider.tsx';

vi.mock('../../i18n.js', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    i18n: {},
  }),
}));

vi.mock('../../components/data-source/ShapeDataSourceStep.tsx', () => ({
  ShapeDataSourceStep: () => null,
}));
vi.mock('../../components/build-config/ShapeBuildConfigStep.tsx', () => ({
  ShapeBuildConfigStep: () => null,
}));
vi.mock('../../components/country-selection/ShapeCountrySelectionStep.tsx', () => ({
  ShapeCountrySelectionStep: () => null,
}));
vi.mock('../../components/preview/ShapePreviewStep.tsx', () => ({
  ShapePreviewStep: () => null,
}));
vi.mock('../../components/build-progress/ShapeBuildStep.tsx', () => ({
  ShapeBuildStep: () => null,
}));

type TemplateNode = {
  nodeType?: string;
  draftData?: Partial<ShapeEntity>;
  children?: TemplateNode[];
};

type TemplateFile = {
  nodes?: TemplateNode[];
};

const findShapeNode = (node: TemplateNode): TemplateNode | undefined => {
  if (node.nodeType === 'shape') return node;
  for (const child of node.children ?? []) {
    const found = findShapeNode(child);
    if (found) return found;
  }
  return undefined;
};

const loadTemplateShapeDraft = async (): Promise<Partial<ShapeEntity>> => {
  const templatePath = resolve(
    process.cwd(),
    '../../app/public/templates/population-2023/population-by-countries-2023.json'
  );
  const raw = await readFile(templatePath, 'utf-8');
  const payload = JSON.parse(raw) as TemplateFile;
  const roots = payload.nodes ?? [];
  for (const root of roots) {
    const shapeNode = findShapeNode(root);
    if (shapeNode?.draftData) return shapeNode.draftData;
  }
  throw new Error('Shape node not found in template');
};

const getShapeStepConfigs = () => {
  const provider = PluginStepRegistry.getInstance().getConfigProvider('shape');
  if (!provider) throw new Error('Shape step provider not registered');
  return provider.getCreateStepConfigs();
};

const resolveStepValidities = async (data: Partial<ShapeEntity>) => {
  const configs = getShapeStepConfigs();
  const result: Record<string, boolean> = {};
  for (const config of configs) {
    if (!config.validate) continue;
    result[config.id] = Boolean(await config.validate(data));
  }
  return result;
};

describe('shape dialog initial draft data', () => {
  it('seeds default build config on create and validates initial steps', async () => {
    const createDraft: Partial<ShapeEntity> = { buildConfig: DEFAULT_BUILD_CONFIG };
    expect(createDraft.buildConfig).toEqual(DEFAULT_BUILD_CONFIG);
    expect(createDraft.selectedArrayByCountries).toBeUndefined();

    const validities = await resolveStepValidities(createDraft);
    expect(validities['data-source']).toBe(true);
    expect(validities['country-selection']).toBe(false);
    expect(validities['processing-configuration']).toBe(true);
    expect(validities['build']).toBe(false);
    expect(validities['preview']).toBe(false);
  });

  it('uses template draft data and validates selection/processing as ready', async () => {
    const templateDraft = await loadTemplateShapeDraft();
    const selection = summarizeCheckboxState(templateDraft.selectedArrayByCountries);

    expect(templateDraft.buildConfig?.dataSourceName).toBe('geoboundaries');
    expect(selection.hasSelection).toBe(true);

    const processingValidation = validateBatchConfig(templateDraft.buildConfig ?? DEFAULT_BUILD_CONFIG);

    const validities = await resolveStepValidities(templateDraft);
    expect(validities['data-source']).toBe(true);
    expect(validities['country-selection']).toBe(true);
    expect(processingValidation.isValid).toBe(false);
    expect(validities['processing-configuration']).toBe(processingValidation.isValid);
    expect(validities['build']).toBe(false);
    expect(validities['preview']).toBe(false);
  });
});
