import type { FC } from 'react';
import type { PluginStepProps } from '@hierarchidb/plugin-base';
import { List, ListItemButton, ListItemText } from '@mui/material';
import { YAML_TEMPLATES } from '@hierarchidb/yaml-api';
import type { YamlDraft } from '../../../common/types/YamlEntity.js';

export const YamlSchemaSelectionStep: FC<PluginStepProps<YamlDraft>> = ({
    data,
    onChange,
    disabled,
}) => {
    return (
        <List>
            {YAML_TEMPLATES.map((template) => (
                <ListItemButton
                    key={template.templateId}
                    selected={data.schemaId === template.schemaId}
                    onClick={() => onChange({ ...data, schemaId: template.schemaId })}
                    disabled={disabled}
                >
                    <ListItemText
                        primary={template.displayName}
                        secondary={template.schemaId}
                    />
                </ListItemButton>
            ))}
        </List>
    );
};
