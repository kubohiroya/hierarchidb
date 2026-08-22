import type { PluginStepProps } from '@hierarchidb/plugin-base';
import { getYamlSchema } from '@hierarchidb/yaml-api';
import { Typography } from '@mui/material';
// Lazy import Form to avoid SSR issues
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import type { FC } from 'react';
import { parse, stringify } from 'yaml';
import type { YamlDraft } from '../../../common/types/yamlEntityTypes.js';

export const YamlSchemaEditorStep: FC<PluginStepProps<YamlDraft>> = ({
  data,
  onChange,
  disabled,
}) => {
  const schemaId = data.schemaId;
  if (!schemaId) {
    return <Typography color="error">No schema selected. Go back to Step 2.</Typography>;
  }

  const schema = getYamlSchema(schemaId);
  if (!schema) {
    return <Typography color="error">Unknown schema: {schemaId}</Typography>;
  }

  // Parse existing YAML content to formData, or use empty object
  let formData: Record<string, unknown> = {};
  if (data.content) {
    try {
      const parsed = parse(data.content);
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        formData = parsed as Record<string, unknown>;
      }
    } catch {
      // If YAML is invalid, start with empty form
    }
  }

  return (
    <Form
      schema={schema as object}
      validator={validator}
      formData={formData}
      disabled={disabled}
      onChange={(e) => {
        const yamlText = stringify(e.formData);
        onChange({ ...data, content: yamlText });
      }}
    />
  );
};
