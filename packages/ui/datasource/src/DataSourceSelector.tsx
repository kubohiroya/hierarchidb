import type React from 'react';
import { Box, Typography } from '@mui/material';

export interface DataSourceOption {
  id: string;
  name: string;
  description?: string;
  icon?: React.ReactNode;
  metadata?: Record<string, unknown>;
}

export interface DataSourceSelectorProps {
  options: DataSourceOption[];
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  renderOption?: (option: DataSourceOption, active: boolean) => React.ReactNode;
}

export const DataSourceSelector: React.FC<DataSourceSelectorProps> = ({
  options,
  value,
  onChange,
  disabled,
  renderOption,
}) => (
  <Box display="flex" flexDirection="column" gap={2}>
    {options.map((option) => {
      const active = option.id === value;
      return (
        <Box
          key={option.id}
          onClick={() => !disabled && onChange(option.id)}
          sx={{
            p: 2,
            borderRadius: 1,
            border: 2,
            cursor: disabled ? 'default' : 'pointer',
            borderColor: active ? 'primary.main' : 'divider',
            bgcolor: active ? 'action.selected' : 'background.paper',
            '&:hover': disabled ? {} : { bgcolor: 'action.hover' },
          }}
        >
          {renderOption ? (
            renderOption(option, active)
          ) : (
            <Box display="flex" flexDirection="column" gap={0.5}>
              <Typography variant="subtitle1">
                {option.icon} {option.name}
              </Typography>
              {option.description && (
                <Typography variant="body2" color="text.secondary">
                  {option.description}
                </Typography>
              )}
            </Box>
          )}
        </Box>
      );
    })}
  </Box>
);
