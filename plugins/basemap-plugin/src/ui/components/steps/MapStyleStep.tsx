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
import { useId } from 'react';
import { useMapStyleStep } from '../../hooks/useMapStyleStep.js';
import type { MapStyle } from '../../../common/types/BaseMapEntity.js';

export interface MapStyleStepProps {
  value: MapStyle | undefined;
  onChange: (next: MapStyle) => void;
}

export const MapStyleStep: React.FC<MapStyleStepProps> = ({ value, onChange }) => {
  const { t, presets, style, url, selectPreset, activateCustom, updateCustomUrl } = useMapStyleStep({
    value,
    onChange,
  });
  const controlId = useId();

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t(
          'mapStyle.description',
          'Choose one of the bundled MapLibre styles or switch to “Custom” to reference your own style JSON.'
        )}
      </Typography>

      <Stack spacing={2}>
        <ToggleButtonGroup
          exclusive
          fullWidth
          value={style && style !== 'custom' ? style : null}
          onChange={selectPreset}
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
                <Typography variant="subtitle2">
                  {t(`mapStyle.presets.${preset.key}.label`, preset.label)}
                </Typography>
                <Typography variant="caption" sx={{ textAlign: 'left' }}>
                  {t(`mapStyle.presets.${preset.key}.description`, preset.description)}
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
            onClick={activateCustom}
            disableRipple
            >
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>
                  {t('mapStyle.custom.title', 'Custom Style')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t(
                    'mapStyle.custom.description',
                    'Reference your own MapLibre style JSON (hosted URL or inline config). Ideal when you need branded colors or licensed tile providers.'
                  )}
                </Typography>
                {style === 'custom' && (
                  <TextField
                    sx={{ mt: 2 }}
                    label={String(t('mapStyle.custom.urlLabel', 'Custom Style URL'))}
                    id={`${controlId}-custom-style-url`}
                    name="custom-style-url"
                    placeholder={String(
                      t('mapStyle.custom.urlPlaceholder', 'https://example.com/style.json')
                    )}
                    value={url}
                    onChange={updateCustomUrl}
                    fullWidth
                    inputProps={{ id: `${controlId}-custom-style-url`, name: 'custom-style-url' }}
                  />
                )}
              </CardContent>
            </CardActionArea>
          </Card>
        </Stack>
      </Box>
    );
};
