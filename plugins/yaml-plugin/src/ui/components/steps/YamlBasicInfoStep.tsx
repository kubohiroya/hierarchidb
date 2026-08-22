import type { PluginStepProps } from '@hierarchidb/plugin-base';
import { TextField } from '@mui/material';
import type { FC } from 'react';
import type { YamlDraft } from '../../../common/types/yamlEntityTypes.js';

export const YamlBasicInfoStep: FC<PluginStepProps<YamlDraft>> = ({ data, onChange, disabled }) => {
  return (
    <TextField
      label="File Name"
      value={data.name ?? ''}
      onChange={(e) => onChange({ ...data, name: e.target.value })}
      disabled={disabled}
      fullWidth
      required
      placeholder="e.g. scenario.yml"
    />
  );
};
