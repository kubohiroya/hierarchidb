import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import type React from 'react';
import { useMemo } from 'react';
import { BUILT_IN_STYLES } from '../../../common/constants/builtInStyles.js';
import type { MapStyle } from '../../../common/types/BaseMapEntity.js';

export interface MapStyleStepProps {
  value: MapStyle | undefined;
  onChange: (next: MapStyle) => void;
}

export const MapStyleStep: React.FC<MapStyleStepProps> = ({ value, onChange }) => {
  const style = value?.style || '';
  const url = value?.customStyleUrl || '';

  const presets = useMemo(
    () =>
      (['streets', 'satellite', 'terrain', 'dark', 'light'] as const).map((key) => ({
        key,
        label: BUILT_IN_STYLES[key].name,
        description: BUILT_IN_STYLES[key].description,
      })),
    []
  );

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Choose one of the bundled MapLibre styles or switch to “Custom” to reference your own style
        JSON.
      </Typography>

      <Stack spacing={2}>
        <ToggleButtonGroup
          exclusive
          fullWidth
          value={style && style !== 'custom' ? style : null}
          onChange={(_e, next) => {
            if (!next) return;
            onChange({
              ...(value || { style: next }),
              style: next,
              customStyleUrl: undefined,
              customStyleConfig: undefined,
            });
          }}
          sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}
        >
          {presets.map((preset) => (
            <ToggleButton
              key={preset.key}
              value={preset.key}
              sx={{
                flex: '1 1 160px',
                textTransform: 'none',
                borderRadius: 2,
                '&.Mui-selected': {
                  borderColor: 'primary.main',
                  backgroundColor: 'primary.main',
                  color: 'primary.contrastText',
                },
              }}
            >
              <Stack spacing={0.5} alignItems="flex-start">
                <Typography variant="subtitle2">{preset.label}</Typography>
                <Typography variant="caption" sx={{ textAlign: 'left' }}>
                  {preset.description}
                </Typography>
              </Stack>
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Card
          variant={style === 'custom' ? 'outlined' : undefined}
          sx={{
            borderColor: style === 'custom' ? 'primary.main' : 'divider',
            borderWidth: 2,
            borderRadius: 2,
          }}
        >
          <CardActionArea
            onClick={() =>
              onChange({
                ...(value || { style: 'custom' }),
                style: 'custom',
              })
            }
            disableRipple
          >
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                Custom Style
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Reference your own MapLibre style JSON (hosted URL or inline config). Ideal when you
                need branded colors or licensed tile providers.
              </Typography>
              {style === 'custom' && (
                <TextField
                  sx={{ mt: 2 }}
                  label="Custom Style URL"
                  placeholder="https://example.com/style.json"
                  value={url}
                  onChange={(e) =>
                    onChange({
                      ...(value || { style: 'custom' }),
                      style: 'custom',
                      customStyleUrl: e.target.value,
                    })
                  }
                  fullWidth
                />
              )}
            </CardContent>
          </CardActionArea>
        </Card>
      </Stack>
    </Box>
  );
};
