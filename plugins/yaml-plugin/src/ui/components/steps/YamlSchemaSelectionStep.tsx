import type { PluginStepProps } from '@hierarchidb/plugin-base';
import { YAML_TEMPLATES } from '@hierarchidb/yaml-api';
import { List, ListItemButton, ListItemText } from '@mui/material';
import { type FC, useMemo } from 'react';
import type { YamlDraft } from '../../../common/types/yamlEntityTypes.js';

export const YamlSchemaSelectionStep: FC<PluginStepProps<YamlDraft>> = ({
  data,
  onChange,
  disabled,
}) => {
  const templates = useMemo(
    () => [...new Map(YAML_TEMPLATES.map((template) => [template.schemaId, template])).values()],
    []
  );

  return (
    <List>
      {templates.map((template) => (
        <ListItemButton
          key={template.schemaId}
          selected={data.schemaId === template.schemaId}
          onClick={() =>
            onChange({ ...data, schemaId: template.schemaId, subtype: template.subtype })
          }
          disabled={disabled}
        >
          <ListItemText primary={template.displayName} secondary={template.schemaId} />
        </ListItemButton>
      ))}
    </List>
  );
};
