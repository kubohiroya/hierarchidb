import { FormControlLabel, Switch } from '@mui/material';

type Props = {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  switchId: string;
  label: string;
};

export const DownloadRetentionToggle: React.FC<Props> = ({
  checked,
  onChange,
  disabled,
  switchId,
  label,
}) => (
  <FormControlLabel
    control={
      <Switch
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        inputProps={{
          id: `${switchId}-retain-downloaded-files`,
          name: 'retain-downloaded-files',
        }}
      />
    }
    label={label}
  />
);
