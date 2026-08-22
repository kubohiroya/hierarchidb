import Ajv from 'ajv';
import type { FeatureCollection, Geometry } from 'geojson';

type ProviderGeoJsonFeatureCollection = FeatureCollection<Geometry, Record<string, unknown>>;

type ProviderValidator = (value: unknown) => boolean;

const ajv = new Ajv({
  allErrors: true,
  strict: true,
  coerceTypes: false,
  useDefaults: false,
  removeAdditional: false,
});

const jsonPropertyValueSchema = {
  anyOf: [
    { type: 'string' },
    { type: 'number' },
    { type: 'boolean' },
    { type: 'null' },
    {
      type: 'array',
      items: { $ref: '#/$defs/jsonPropertyValue' },
    },
    {
      type: 'object',
      additionalProperties: { $ref: '#/$defs/jsonPropertyValue' },
    },
  ],
} as const;

const geometrySchema = {
  type: 'object',
  required: ['type'],
  additionalProperties: true,
  properties: {
    type: { type: 'string' },
  },
} as const;

const featureBaseSchema = {
  type: 'object',
  required: ['type', 'geometry', 'properties'],
  additionalProperties: true,
  properties: {
    type: { const: 'Feature' },
    geometry: {
      anyOf: [geometrySchema, { type: 'null' }],
    },
    properties: {
      type: 'object',
      additionalProperties: { $ref: '#/$defs/jsonPropertyValue' },
    },
  },
} as const;

const createFeatureCollectionSchema = (id: string, featureSchema: object): object => ({
  $id: `https://hierarchidb.dev/schemas/shape-plugin/${id}.json`,
  type: 'object',
  required: ['type', 'features'],
  additionalProperties: true,
  properties: {
    type: { const: 'FeatureCollection' },
    features: {
      type: 'array',
      items: featureSchema,
    },
  },
  $defs: {
    jsonPropertyValue: jsonPropertyValueSchema,
  },
});

export const genericGeoJsonSourcePayloadSchema = createFeatureCollectionSchema(
  'generic-geojson-source-payload',
  {
    type: 'object',
    additionalProperties: true,
  }
);

const createProviderFeatureSchema = (propertiesSchema: object): object => ({
  ...featureBaseSchema,
  properties: {
    ...featureBaseSchema.properties,
    properties: propertiesSchema,
  },
});

const stringFieldSchema = { type: 'string', minLength: 1 } as const;

export const naturalEarthGeoJsonSourcePayloadSchema = createFeatureCollectionSchema(
  'natural-earth-geojson-source-payload',
  createProviderFeatureSchema({
    type: 'object',
    additionalProperties: { $ref: '#/$defs/jsonPropertyValue' },
    anyOf: [
      { required: ['ISO_A3'], properties: { ISO_A3: stringFieldSchema } },
      { required: ['ISO_3166_1'], properties: { ISO_3166_1: stringFieldSchema } },
      { required: ['adm0_a3'], properties: { adm0_a3: stringFieldSchema } },
      { required: ['NAME'], properties: { NAME: stringFieldSchema } },
      { required: ['NAME_EN'], properties: { NAME_EN: stringFieldSchema } },
      { required: ['name'], properties: { name: stringFieldSchema } },
    ],
  })
);

export const geoBoundariesGeoJsonSourcePayloadSchema = createFeatureCollectionSchema(
  'geoboundaries-geojson-source-payload',
  createProviderFeatureSchema({
    type: 'object',
    required: ['shapeName'],
    additionalProperties: { $ref: '#/$defs/jsonPropertyValue' },
    properties: {
      shapeName: stringFieldSchema,
      shapeID: stringFieldSchema,
      shapeGroup: stringFieldSchema,
      shapeISO: stringFieldSchema,
    },
  })
);

const createGadmGeoJsonSourcePayloadSchema = (level: number): object => {
  const levelSpecificRequired = level === 0 ? [] : [`GID_${level}`, `NAME_${level}`];
  const levelSpecificProperties = Object.fromEntries(
    levelSpecificRequired.map((field) => [field, stringFieldSchema])
  );
  return createFeatureCollectionSchema(
    `gadm-geojson-source-payload-adm${level}`,
    createProviderFeatureSchema({
      type: 'object',
      required: ['GID_0', 'NAME_0', ...levelSpecificRequired],
      additionalProperties: { $ref: '#/$defs/jsonPropertyValue' },
      properties: {
        GID_0: stringFieldSchema,
        NAME_0: stringFieldSchema,
        ...levelSpecificProperties,
      },
    })
  );
};

const validateGenericGeoJsonSourcePayload = ajv.compile(genericGeoJsonSourcePayloadSchema);
const validateNaturalEarthGeoJsonSourcePayload = ajv.compile(
  naturalEarthGeoJsonSourcePayloadSchema
);
const validateGeoBoundariesGeoJsonSourcePayload = ajv.compile(
  geoBoundariesGeoJsonSourcePayloadSchema
);
const validateGadmGeoJsonSourcePayloadByLevel = new Map<number, ProviderValidator>(
  [0, 1, 2, 3, 4, 5].map((level) => [
    level,
    ajv.compile(createGadmGeoJsonSourcePayloadSchema(level)) as ProviderValidator,
  ])
);

const formatValidationErrors = (validate: ProviderValidator): string => {
  const errors = 'errors' in validate ? validate.errors : undefined;
  if (!Array.isArray(errors) || errors.length === 0) {
    return 'unknown schema violation';
  }
  return errors
    .map((error) => {
      const path = error.instancePath || '/';
      return `${path} ${error.message ?? 'is invalid'}`;
    })
    .join('; ');
};

const validateWithValidator = (
  value: unknown,
  validate: ProviderValidator,
  schemaName: string
): ProviderGeoJsonFeatureCollection => {
  if (validate(value) !== true) {
    throw new Error(`${schemaName}-invalid: ${formatValidationErrors(validate)}`);
  }
  return value as ProviderGeoJsonFeatureCollection;
};

export const assertGenericGeoJsonSourcePayload = (
  value: unknown
): ProviderGeoJsonFeatureCollection => {
  return validateWithValidator(
    value,
    validateGenericGeoJsonSourcePayload,
    'generic-geojson-source-payload'
  );
};

export const assertNaturalEarthGeoJsonSourcePayload = (
  value: unknown
): ProviderGeoJsonFeatureCollection => {
  assertGenericGeoJsonSourcePayload(value);
  return validateWithValidator(
    value,
    validateNaturalEarthGeoJsonSourcePayload,
    'natural-earth-geojson-source-payload'
  );
};

export const assertGadmGeoJsonSourcePayload = (
  value: unknown,
  level: number
): ProviderGeoJsonFeatureCollection => {
  assertGenericGeoJsonSourcePayload(value);
  const validate = validateGadmGeoJsonSourcePayloadByLevel.get(level);
  if (!validate) {
    throw new Error(`gadm-geojson-source-payload-invalid-level: ${level}`);
  }
  return validateWithValidator(value, validate, 'gadm-geojson-source-payload');
};

export const assertGeoBoundariesGeoJsonSourcePayload = (
  value: unknown
): ProviderGeoJsonFeatureCollection => {
  assertGenericGeoJsonSourcePayload(value);
  return validateWithValidator(
    value,
    validateGeoBoundariesGeoJsonSourcePayload,
    'geoboundaries-geojson-source-payload'
  );
};
