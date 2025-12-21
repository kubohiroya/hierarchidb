import {
  Box,
  FormControlLabel,
  FormGroup,
  FormHelperText,
  Slider,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import type {
  ProcessingConfig,
  SimplificationProcessingConfig,
} from '../../../common/types/index.js';
import { useTranslation } from '../../i18n.js';

type Props = {
  baseSimplificationConfig: SimplificationProcessingConfig;
  disabled?: boolean;
  update: (partial: Partial<ProcessingConfig>) => void;
};

export const SimplificationPanel: React.FC<Props> = ({
  baseSimplificationConfig,
  disabled,
  update,
}) => {
  const { t } = useTranslation();

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2">
        {t('processing.filter.simplificationTitle', 'Simplification')}
      </Typography>
      <div>
        <Typography gutterBottom>
          {t('processing.filter.tolerance', 'Simplification Tolerance (degrees)')}
        </Typography>
        <Box sx={{ px: 2 }}>
          <Slider
            value={baseSimplificationConfig.tolerance ?? 0.01}
            onChange={(_, value) => {
              const tolerance = value as number;
              update({
                simplificationConfig: {
                  ...baseSimplificationConfig,
                  tolerance,
                },
              });
            }}
            min={0.001}
            max={0.1}
            step={0.001}
            marks={[
              { value: 0.001, label: '0.001' },
              { value: 0.1, label: '0.1' },
            ]}
            valueLabelDisplay="auto"
            track="inverted"
            disabled={disabled}
          />
        </Box>
        <Typography variant="caption" color="text.secondary">
          {t('processing.filter.toleranceHelp', 'Higher values simplify geometry more aggressively.')}
        </Typography>
      </div>
      <FormGroup>
        <FormControlLabel
          control={
            <Switch
              checked={Boolean(baseSimplificationConfig.enablePerFeatureSimplification)}
              onChange={(event) => {
                update({
                  simplificationConfig: {
                    ...baseSimplificationConfig,
                    enablePerFeatureSimplification: event.target.checked,
                  },
                });
              }}
              disabled={disabled}
            />
          }
          label={t('processing.filter.enablePerFeatureSimplification', 'Enable per-feature simplification')}
        />
        <FormHelperText>
          {t('processing.filter.enablePerFeatureSimplificationHelp', 'Apply tolerance per feature instead of globally.')}
        </FormHelperText>
      </FormGroup>
    </Stack>
  );
};
