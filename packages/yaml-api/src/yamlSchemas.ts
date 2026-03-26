/**
 * JSON Schema objects for each IDE-GSM schemaId.
 * These are minimal but structurally valid JSON Schemas used by the rjsf form editor.
 */
export const YAML_SCHEMAS: Record<string, object> = {
    'ide-gsm/sources': {
        $schema: 'http://json-schema.org/draft-07/schema#',
        title: 'Sources',
        type: 'object',
        properties: {
            sources: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        name: { type: 'string', title: 'Name' },
                        url: { type: 'string', title: 'URL' },
                    },
                    required: ['name', 'url'],
                },
            },
        },
    },

    'ide-gsm/scenario': {
        $schema: 'http://json-schema.org/draft-07/schema#',
        title: 'Scenario',
        type: 'object',
        properties: {
            name: { type: 'string', title: 'Name' },
            description: { type: 'string', title: 'Description' },
            steps: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        action: { type: 'string', title: 'Action' },
                        target: { type: 'string', title: 'Target' },
                    },
                    required: ['action'],
                },
            },
        },
        required: ['name'],
    },

    'ide-gsm/calib': {
        $schema: 'http://json-schema.org/draft-07/schema#',
        title: 'Calibration',
        type: 'object',
        properties: {
            calibrationId: { type: 'string', title: 'Calibration ID' },
            parameters: {
                type: 'object',
                additionalProperties: { type: 'number' },
                title: 'Parameters',
            },
        },
        required: ['calibrationId'],
    },

    'ide-gsm/remote': {
        $schema: 'http://json-schema.org/draft-07/schema#',
        title: 'Remote',
        type: 'object',
        properties: {
            host: { type: 'string', title: 'Host' },
            port: { type: 'integer', title: 'Port', minimum: 1, maximum: 65535 },
            username: { type: 'string', title: 'Username' },
        },
        required: ['host'],
    },

    'ide-gsm/ssh': {
        $schema: 'http://json-schema.org/draft-07/schema#',
        title: 'SSH',
        type: 'object',
        properties: {
            host: { type: 'string', title: 'Host' },
            port: { type: 'integer', title: 'Port', minimum: 1, maximum: 65535 },
            username: { type: 'string', title: 'Username' },
            privateKey: { type: 'string', title: 'Private Key' },
        },
        required: ['host', 'username'],
    },

    'ide-gsm/ec2': {
        $schema: 'http://json-schema.org/draft-07/schema#',
        title: 'EC2',
        type: 'object',
        properties: {
            instanceId: { type: 'string', title: 'Instance ID' },
            region: { type: 'string', title: 'Region' },
            instanceType: { type: 'string', title: 'Instance Type' },
        },
        required: ['instanceId', 'region'],
    },
};

/**
 * Retrieve the JSON Schema object for a given schemaId.
 * Returns undefined when the schemaId is not registered.
 */
export function getYamlSchema(schemaId: string): object | undefined {
    return YAML_SCHEMAS[schemaId];
}
