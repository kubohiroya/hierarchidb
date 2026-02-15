import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  FormControl,
  FormControlLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Layers as LayersIcon,
} from '@mui/icons-material';
import { useTranslation } from '../../i18n.js';
import type { ShapeBuildConfig } from '../../../common/types/index.js';
import { mergeBuildConfig } from '../../../common/types/index.js';

type Props = {
  config: ShapeBuildConfig;
  onChange: (next: ShapeBuildConfig) => void;
  disabled?: boolean;
};

export const VtOutputQualityGuardCard: React.FC<Props> = ({ config, onChange, disabled }) => {
  const { t } = useTranslation();
  const guard = config.vtConfig.outputQualityGuard;
  const resolvedGuard = {
    enabled: guard?.enabled ?? false,
    minZoom: guard?.minZoom ?? 0,
    maxZoom: guard?.maxZoom ?? 22,
    actionOnAnomaly: guard?.actionOnAnomaly ?? 'mark_warning',
    enablePreviewOverlay: guard?.enablePreviewOverlay ?? false,
  } as const;

  const updateGuard = (partial: Partial<typeof resolvedGuard>) => {
    onChange(mergeBuildConfig(config, {
      vtConfig: {
        ...config.vtConfig,
        outputQualityGuard: {
          ...resolvedGuard,
          ...partial,
        },
      },
    }));
  };

  return (
    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={2} alignItems="center">
          <LayersIcon color="primary" />
          <Typography variant="subtitle1">
            {t('processing.vt.outputQualityGuard.title', 'Tile Output Quality Guard')}
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 3 }}>
        <Stack spacing={2} sx={{ opacity: disabled ? 0.6 : 1 }}>
          <Typography variant="body2" color="text.secondary">
            {t(
              'processing.vt.outputQualityGuard.description',
              'Flag potentially unstable tile output ranges and choose anomaly handling behavior in VT stage.',
            )}
          </Typography>
          <FormControlLabel
            control={(
              <Switch
                checked={resolvedGuard.enabled}
                onChange={(event) => updateGuard({ enabled: event.target.checked })}
              />
            )}
            disabled={disabled}
            label={t('processing.vt.outputQualityGuard.enabled', 'Enable tile quality guard')}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              size="small"
              type="number"
              label={t('processing.vt.outputQualityGuard.minZoom', 'Min zoom')}
              value={resolvedGuard.minZoom}
              disabled={disabled || !resolvedGuard.enabled}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (!Number.isFinite(value)) return;
                updateGuard({ minZoom: Math.max(0, Math.floor(value)) });
              }}
            />
            <TextField
              size="small"
              type="number"
              label={t('processing.vt.outputQualityGuard.maxZoom', 'Max zoom')}
              value={resolvedGuard.maxZoom}
              disabled={disabled || !resolvedGuard.enabled}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (!Number.isFinite(value)) return;
                updateGuard({ maxZoom: Math.max(0, Math.floor(value)) });
              }}
            />
          </Stack>
          <FormControl fullWidth disabled={disabled || !resolvedGuard.enabled}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {t('processing.vt.outputQualityGuard.actionOnAnomaly', 'When anomaly is detected')}
            </Typography>
            <Select
              size="small"
              value={resolvedGuard.actionOnAnomaly}
              onChange={(event) => {
                const value = event.target.value;
                if (value !== 'mark_warning' && value !== 'fallback_less_simplified' && value !== 'drop_tile') {
                  return;
                }
                updateGuard({ actionOnAnomaly: value });
              }}
            >
              <MenuItem value="mark_warning">
                {t('processing.vt.outputQualityGuard.action.markWarning', 'Mark warning')}
              </MenuItem>
              <MenuItem value="fallback_less_simplified">
                {t('processing.vt.outputQualityGuard.action.fallback', 'Fallback to less simplified')}
              </MenuItem>
              <MenuItem value="drop_tile">
                {t('processing.vt.outputQualityGuard.action.dropTile', 'Drop tile')}
              </MenuItem>
            </Select>
          </FormControl>
          <FormControlLabel
            control={(
              <Switch
                checked={resolvedGuard.enablePreviewOverlay}
                onChange={(event) => updateGuard({ enablePreviewOverlay: event.target.checked })}
              />
            )}
            disabled={disabled || !resolvedGuard.enabled}
            label={t('processing.vt.outputQualityGuard.enablePreviewOverlay', 'Show warning overlay in preview')}
          />
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};
