import { useMemo, type FC } from 'react';
import type { PluginStepProps } from '@hierarchidb/plugin-base';
import { List, ListItemButton, ListItemText } from '@mui/material';
import { YAML_TEMPLATES } from '@hierarchidb/yaml-api';
import type { YamlDraft } from '../../../common/types/yamlEntityTypes.js';

export const YamlSchemaSelectionStep: FC<PluginStepProps<YamlDraft>> = ({
    data,
    onChange,
    disabled,
}) => {
    return (
        <List>
            {useMemo(() => [...new Map(YAML_TEMPLATES.map((t) => [t.schemaId, t])).values()], []).map((template) => (
                <ListItemButton
                    key={template.schemaId}
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

