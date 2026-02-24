import type { TreeNodeData } from '@hierarchidb/tree-api';
import { GEOBOUNDARIES_COUNTRIES_BY_LEVEL } from './generated/geoboundaries-shape-presets.generated.ts';

export const SHAPE_CREATE_PRESET_IDS = [
  'japan-level0-1',
  'world-level0',
  'world-level1-cn-in-level12',
] as const;

export type ShapeCreatePresetId = (typeof SHAPE_CREATE_PRESET_IDS)[number];

export type TranslateWithFallback = (key: string, fallback: string) => string;

type ShapeCreatePresetDefinition = {
  id: ShapeCreatePresetId;
  labelKey: string;
  labelFallback: string;
  descriptionKey: string;
  descriptionFallback: string;
  nodeNameTemplateKey: string;
  nodeNameTemplateFallback: string;
  nodeDescriptionKey: string;
  nodeDescriptionFallback: string;
  buildConfigPatch: Record<string, unknown>;
  processingConfigPatch: Record<string, unknown>;
  buildSelection: () => Record<string, boolean[]>;
};

export interface ShapePresetMenuEntry {
  key: string;
  nodeType: 'shape';
  createType: string;
  labelKey: string;
  label: string;
  descriptionKey: string;
  description: string;
}

const CREATE_ACTION_PREFIX = 'create:';
const SHAPE_PRESET_MARKER = '::preset:';
const SHAPE_DEFAULT_PRESET_ID = 'default';

type GeoboundariesLevel = 0 | 1;

const FALLBACK_WORLD_ISO2_CODES = [
  'AD',
  'AE',
  'AF',
  'AG',
  'AL',
  'AM',
  'AO',
  'AR',
  'AT',
  'AU',
  'AZ',
  'BA',
  'BB',
  'BD',
  'BE',
  'BF',
  'BG',
  'BH',
  'BI',
  'BJ',
  'BN',
  'BO',
  'BR',
  'BS',
  'BT',
  'BW',
  'BY',
  'BZ',
  'CA',
  'CF',
  'CG',
  'CH',
  'CI',
  'CL',
  'CM',
  'CN',
  'CO',
  'CR',
  'CU',
  'CV',
  'CY',
  'CZ',
  'DE',
  'DJ',
  'DK',
  'DM',
  'DO',
  'DZ',
  'EC',
  'EE',
  'EG',
  'ER',
  'ES',
  'ET',
  'FI',
  'FJ',
  'FM',
  'FR',
  'GA',
  'GB',
  'GD',
  'GE',
  'GH',
  'GL',
  'GM',
  'GN',
  'GQ',
  'GR',
  'GT',
  'GW',
  'GY',
  'HN',
  'HR',
  'HT',
  'HU',
  'ID',
  'IE',
  'IL',
  'IN',
  'IQ',
  'IR',
  'IS',
  'IT',
  'JM',
  'JO',
  'JP',
  'KE',
  'KG',
  'KH',
  'KI',
  'KM',
  'KN',
  'KP',
  'KR',
  'KW',
  'KZ',
  'LA',
  'LB',
  'LC',
  'LI',
  'LK',
  'LR',
  'LS',
  'LT',
  'LU',
  'LV',
  'LY',
  'MA',
  'MC',
  'ME',
  'MG',
  'MH',
  'MK',
  'ML',
  'MM',
  'MN',
  'MR',
  'MT',
  'MU',
  'MV',
  'MW',
  'MX',
  'MY',
  'MZ',
  'NA',
  'NE',
  'NG',
  'NI',
  'NL',
  'NO',
  'NP',
  'NR',
  'NZ',
  'OM',
  'PA',
  'PE',
  'PG',
  'PH',
  'PK',
  'PL',
  'PT',
  'PW',
  'PY',
  'QA',
  'RO',
  'RS',
  'RU',
  'RW',
  'SA',
  'SB',
  'SC',
  'SD',
  'SE',
  'SG',
  'SI',
  'SK',
  'SL',
  'SN',
  'SO',
  'SR',
  'SS',
  'ST',
  'SV',
  'SY',
  'SZ',
  'TD',
  'TG',
  'TH',
  'TJ',
  'TL',
  'TM',
  'TN',
  'TO',
  'TR',
  'TT',
  'TV',
  'UA',
  'UG',
  'UM',
  'US',
  'UY',
  'UZ',
  'VC',
  'VE',
  'VN',
  'VU',
  'WF',
  'WS',
  'YE',
  'ZA',
  'ZM',
  'ZW',
] as const;

const normalizeIso2 = (value: string): string | null => {
  const trimmed = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(trimmed) ? trimmed : null;
};

const getPresetCountries = (level: GeoboundariesLevel): Set<string> => {
  const generated =
    level === 0 ? GEOBOUNDARIES_COUNTRIES_BY_LEVEL.level0 : GEOBOUNDARIES_COUNTRIES_BY_LEVEL.level1;
  const source = generated.length > 0 ? generated : FALLBACK_WORLD_ISO2_CODES;
  const normalized = new Set<string>();
  for (const country of source) {
    const iso2 = normalizeIso2(country);
    if (iso2) normalized.add(iso2);
  }
  if (normalized.size > 0) {
    return normalized;
  }
  return new Set(FALLBACK_WORLD_ISO2_CODES);
};

const createWorldSelection = (
  countries: Set<string>,
  rowTemplate: readonly [boolean, boolean, boolean]
): Record<string, boolean[]> => {
  const selection: Record<string, boolean[]> = {};
  for (const country of countries) {
    const normalized = country.trim().toUpperCase();
    if (normalized.length !== 2) continue;
    selection[normalized] = Array.from(rowTemplate);
  }
  return selection;
};

const createSelectionRow = (
  level0: boolean,
  level1: boolean,
  level2 = false
): boolean[] => [level0, level1, level2];

const buildJapanLevel01Selection = (): Record<string, boolean[]> => ({
  JP: createSelectionRow(true, true, false),
});

const buildWorldLevel0Selection = (): Record<string, boolean[]> => {
  return createWorldSelection(getPresetCountries(0), [true, false, false]);
};

const buildWorldLevel1CnInLevel12Selection = (): Record<string, boolean[]> => {
  const selection = createWorldSelection(getPresetCountries(1), [false, true, false]);
  selection.CN = createSelectionRow(false, true, true);
  selection.IN = createSelectionRow(false, true, true);
  return selection;
};

const SHAPE_CREATE_PRESET_DEFINITIONS: readonly ShapeCreatePresetDefinition[] = [
  {
    id: 'japan-level0-1',
    labelKey: 'treeConsole.shapePresets.japanLevel01.name',
    labelFallback: 'Japan ADM0+1',
    descriptionKey: 'treeConsole.shapePresets.japanLevel01.description',
    descriptionFallback:
      'Select Japan admin level 0+1 boundaries.',
    nodeNameTemplateKey: 'treeConsole.shapePresets.japanLevel01.nodeNameTemplate',
    nodeNameTemplateFallback: 'Japan ADM0+1',
    nodeDescriptionKey: 'treeConsole.shapePresets.japanLevel01.nodeDescriptionTemplate',
    nodeDescriptionFallback:
      'Preset: Japan admin level 0+1 boundaries. Includes tuned simplify settings.',
    buildConfigPatch: {
      dataSourceName: 'geoboundaries',
      transformConfig: {
        toleranceByBand: [0.12],
        omitDetailsConfig: { level: 'weak' },
        boundaryDisableAtZoomOrAbove: 5,
      },
      vtConfig: {
        tolerance: 0,
        tileExpandFactor: 1,
      },
    },
    processingConfigPatch: {
      transform: { maxConcurrent: 3 },
      vt: { maxConcurrent: 2 },
    },
    buildSelection: buildJapanLevel01Selection,
  },
  {
    id: 'world-level0',
    labelKey: 'treeConsole.shapePresets.worldLevel0.name',
    labelFallback: 'World countries ADM0',
    descriptionKey: 'treeConsole.shapePresets.worldLevel0.description',
    descriptionFallback:
      'Select all countries at admin level 0 for compact global coverage.',
    nodeNameTemplateKey: 'treeConsole.shapePresets.worldLevel0.nodeNameTemplate',
    nodeNameTemplateFallback: 'World ADM0',
    nodeDescriptionKey: 'treeConsole.shapePresets.worldLevel0.nodeDescriptionTemplate',
    nodeDescriptionFallback:
      'Preset: world countries admin level 0. Prioritizes compact simplification.',
    buildConfigPatch: {
      dataSourceName: 'geoboundaries',
      transformConfig: {
        toleranceByBand: [0.9],
        omitDetailsConfig: { level: 'strong' },
        boundaryDisableAtZoomOrAbove: 2,
      },
      vtConfig: {
        tolerance: 1,
        tileExpandFactor: 1,
      },
    },
    processingConfigPatch: {
      transform: { maxConcurrent: 4 },
      vt: { maxConcurrent: 2 },
    },
    buildSelection: buildWorldLevel0Selection,
  },
  {
    id: 'world-level1-cn-in-level12',
    labelKey: 'treeConsole.shapePresets.worldLevel1CnInLevel12.name',
    labelFallback: 'World countries ADM1, China/India ADM1+2',
    descriptionKey: 'treeConsole.shapePresets.worldLevel1CnInLevel12.description',
    descriptionFallback:
      'Select ADM1 globally; extend China and India to ADM2.',
    nodeNameTemplateKey: 'treeConsole.shapePresets.worldLevel1CnInLevel12.nodeNameTemplate',
    nodeNameTemplateFallback: 'World countries ADM1, CN/IN ADM1+2',
    nodeDescriptionKey: 'treeConsole.shapePresets.worldLevel1CnInLevel12.nodeDescriptionTemplate',
    nodeDescriptionFallback:
      'Preset: world level 1, plus China/India level 2 with balanced simplify settings.',
    buildConfigPatch: {
      dataSourceName: 'geoboundaries',
      transformConfig: {
        toleranceByBand: [0.45],
        omitDetailsConfig: { level: 'medium' },
        boundaryDisableAtZoomOrAbove: 3,
      },
      vtConfig: {
        tolerance: 0,
        tileExpandFactor: 1,
      },
    },
    processingConfigPatch: {
      transform: { maxConcurrent: 3 },
      vt: { maxConcurrent: 1 },
    },
    buildSelection: buildWorldLevel1CnInLevel12Selection,
  },
] as const;

const SHAPE_CREATE_PRESET_MAP = new Map<ShapeCreatePresetId, ShapeCreatePresetDefinition>(
  SHAPE_CREATE_PRESET_DEFINITIONS.map((preset) => [preset.id, preset])
);

export function isShapeCreatePresetId(value: string): value is ShapeCreatePresetId {
  return SHAPE_CREATE_PRESET_MAP.has(value as ShapeCreatePresetId);
}

export function buildCreateType(nodeType: string, presetId?: ShapeCreatePresetId): string {
  if (presetId && nodeType === 'shape') {
    return `${nodeType}${SHAPE_PRESET_MARKER}${presetId}`;
  }
  return nodeType;
}

export function buildCreateAction(nodeType: string, presetId?: ShapeCreatePresetId): string {
  return `${CREATE_ACTION_PREFIX}${buildCreateType(nodeType, presetId)}`;
}

export function parseCreateAction(action: string): {
  nodeType: string;
  shapePresetId?: ShapeCreatePresetId;
} | null {
  if (!action.startsWith(CREATE_ACTION_PREFIX)) return null;
  const createType = action.slice(CREATE_ACTION_PREFIX.length).trim();
  if (!createType) return null;

  const [nodeType, presetRaw] = createType.split(SHAPE_PRESET_MARKER);
  const normalizedNodeType = nodeType?.trim().toLowerCase();
  if (!normalizedNodeType) return null;

  if (!presetRaw) {
    return { nodeType: normalizedNodeType };
  }
  if (normalizedNodeType !== 'shape') {
    return null;
  }
  const presetId = presetRaw.trim();
  if (presetId === SHAPE_DEFAULT_PRESET_ID) {
    return { nodeType: normalizedNodeType };
  }
  if (!isShapeCreatePresetId(presetId)) {
    return null;
  }
  return { nodeType: normalizedNodeType, shapePresetId: presetId };
}

export function getShapePresetMenuEntries(): readonly ShapePresetMenuEntry[] {
  const defaultEntry: ShapePresetMenuEntry = {
    key: 'shape-preset-default',
    nodeType: 'shape',
    createType: buildCreateType('shape'),
    labelKey: 'treeConsole.shapePresets.default.name',
    label: 'Default',
    descriptionKey: 'treeConsole.shapePresets.default.description',
    description: 'Create a shape with no countries selected.',
  };

  return [
    defaultEntry,
    ...SHAPE_CREATE_PRESET_DEFINITIONS.map((preset): ShapePresetMenuEntry => ({
      key: `shape-preset-${preset.id}`,
      nodeType: 'shape',
      createType: buildCreateType('shape', preset.id),
      labelKey: preset.labelKey,
      label: preset.labelFallback,
      descriptionKey: preset.descriptionKey,
      description: preset.descriptionFallback,
    })),
  ];
}

export function buildShapePresetDraftDataPatch(
  presetId: ShapeCreatePresetId
): Partial<TreeNodeData> {
  const preset = SHAPE_CREATE_PRESET_MAP.get(presetId);
  if (!preset) {
    return {};
  }

  const selectedArrayByCountries = preset.buildSelection();
  return {
    buildConfig: preset.buildConfigPatch,
    processingConfig: preset.processingConfigPatch,
    selectedArrayByCountries,
  };
}

function applyTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_-]+)\s*}}/g, (_, key: string) => values[key] ?? '');
}

function buildDateStamp(now: Date = new Date()): string {
  const yyyy = `${now.getFullYear()}`;
  const mm = `${now.getMonth() + 1}`.padStart(2, '0');
  const dd = `${now.getDate()}`.padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function resolveShapePresetNodeDefaults(
  presetId: ShapeCreatePresetId,
  translateWithFallback: TranslateWithFallback
): { name: string; description: string } {
  const preset = SHAPE_CREATE_PRESET_MAP.get(presetId);
  if (!preset) {
    return { name: '', description: '' };
  }
  const date = buildDateStamp();
  const presetName = translateWithFallback(preset.labelKey, preset.labelFallback);
  const nameTemplate = translateWithFallback(
    preset.nodeNameTemplateKey,
    preset.nodeNameTemplateFallback
  );
  const descriptionTemplate = translateWithFallback(
    preset.nodeDescriptionKey,
    preset.nodeDescriptionFallback
  );
  return {
    name: applyTemplate(nameTemplate, { date, preset: presetName }).trim(),
    description: applyTemplate(descriptionTemplate, { date, preset: presetName }).trim(),
  };
}
