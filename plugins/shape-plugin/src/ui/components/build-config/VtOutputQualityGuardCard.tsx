import {
  FormControl,
  FormControlLabel,
  MenuItem,
  Paper,
  Select,
  Slider,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  Layers as LayersIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
} from '@mui/icons-material';
import { BuildConfigSectionTitle, getBuildConfigHoverCardSx } from '@hierarchidb/ui-accordion-config';
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
  const hoverCardSx = getBuildConfigHoverCardSx(disabled);
  const resolvedGuard = {
    enabled: guard?.enabled ?? false,
    minZoom: guard?.minZoom ?? 0,
    maxZoom: guard?.maxZoom ?? 22,
    actionOnAnomaly: guard?.actionOnAnomaly ?? 'mark_warning',
    enablePreviewOverlay: guard?.enablePreviewOverlay ?? false,
    scoreThreshold: guard?.scoreThreshold ?? 2.5,
    minTriangleAngleDeg: guard?.minTriangleAngleDeg ?? 12,
    minEdgeToBaseRatio: guard?.minEdgeToBaseRatio ?? 2.8,
    maxAreaToBBoxRatio: guard?.maxAreaToBBoxRatio ?? 0.18,
    minSpanRatio: guard?.minSpanRatio ?? 0.03,
    minBoundaryVertexCount: guard?.minBoundaryVertexCount ?? 1,
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
  const zoomRange: [number, number] = [
    Math.max(0, Math.min(resolvedGuard.minZoom, resolvedGuard.maxZoom)),
    Math.min(22, Math.max(resolvedGuard.minZoom, resolvedGuard.maxZoom)),
  ];

  return (
    <Paper variant="outlined" sx={{ p: 2, ...hoverCardSx }}>
      <Stack spacing={2} sx={{ opacity: disabled ? 0.6 : 1 }}>
        <BuildConfigSectionTitle
          icon={<LayersIcon fontSize="small" color="primary" />}
          title={t('processing.vt.outputQualityGuard.title', 'Tile Output Quality Guard')}
        />
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
        <Stack spacing={1}>
          <Typography variant="body2" fontWeight={600}>
            {t('processing.vt.outputQualityGuard.zoomRange', 'Zoom range')}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <ZoomOutIcon fontSize="small" color="action" />
            <Slider
              sx={{ flex: 1 }}
              value={zoomRange}
              min={0}
              max={22}
              step={1}
              marks
              disableSwap
              valueLabelDisplay="auto"
              onChange={(_, value) => {
                if (!Array.isArray(value) || value.length < 2) return;
                const [rawMin, rawMax] = value;
                if (typeof rawMin !== 'number' || typeof rawMax !== 'number') return;
                if (!Number.isFinite(rawMin) || !Number.isFinite(rawMax)) return;
                const minZoom = Math.max(0, Math.min(22, Math.floor(Math.min(rawMin, rawMax))));
                const maxZoom = Math.max(0, Math.min(22, Math.floor(Math.max(rawMin, rawMax))));
                updateGuard({ minZoom, maxZoom });
              }}
              disabled={disabled || !resolvedGuard.enabled}
              getAriaLabel={() => t('processing.vt.outputQualityGuard.zoomRange', 'Zoom range')}
            />
            <ZoomInIcon fontSize="small" color="action" />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {t(
              'processing.vt.outputQualityGuard.zoomRangeValue',
              'z{{min}} - z{{max}}',
              { min: zoomRange[0], max: zoomRange[1] },
            )}
          </Typography>
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
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary" fontWeight={600}>
            {t('processing.vt.outputQualityGuard.thresholds.title', 'Anomaly thresholds')}
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              size="small"
              type="number"
              label={t('processing.vt.outputQualityGuard.thresholds.scoreThreshold', 'Score threshold')}
              value={resolvedGuard.scoreThreshold}
              disabled={disabled || !resolvedGuard.enabled}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (!Number.isFinite(value)) return;
                updateGuard({ scoreThreshold: Math.max(0.1, value) });
              }}
            />
            <TextField
              size="small"
              type="number"
              label={t('processing.vt.outputQualityGuard.thresholds.minTriangleAngleDeg', 'Max acute angle (deg)')}
              value={resolvedGuard.minTriangleAngleDeg}
              disabled={disabled || !resolvedGuard.enabled}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (!Number.isFinite(value)) return;
                updateGuard({ minTriangleAngleDeg: Math.max(0.1, Math.min(89, value)) });
              }}
            />
            <TextField
              size="small"
              type="number"
              label={t('processing.vt.outputQualityGuard.thresholds.minBoundaryVertexCount', 'Min boundary vertices')}
              value={resolvedGuard.minBoundaryVertexCount}
              disabled={disabled || !resolvedGuard.enabled}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (!Number.isFinite(value)) return;
                updateGuard({ minBoundaryVertexCount: Math.max(0, Math.min(3, Math.floor(value))) });
              }}
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              size="small"
              type="number"
              label={t('processing.vt.outputQualityGuard.thresholds.minEdgeToBaseRatio', 'Min edge/base ratio')}
              value={resolvedGuard.minEdgeToBaseRatio}
              disabled={disabled || !resolvedGuard.enabled}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (!Number.isFinite(value)) return;
                updateGuard({ minEdgeToBaseRatio: Math.max(1, value) });
              }}
            />
            <TextField
              size="small"
              type="number"
              label={t('processing.vt.outputQualityGuard.thresholds.maxAreaToBBoxRatio', 'Max area/BBox ratio')}
              value={resolvedGuard.maxAreaToBBoxRatio}
              disabled={disabled || !resolvedGuard.enabled}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (!Number.isFinite(value)) return;
                updateGuard({ maxAreaToBBoxRatio: Math.max(0.0001, Math.min(1, value)) });
              }}
            />
            <TextField
              size="small"
              type="number"
              label={t('processing.vt.outputQualityGuard.thresholds.minSpanRatio', 'Min span ratio')}
              value={resolvedGuard.minSpanRatio}
              disabled={disabled || !resolvedGuard.enabled}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (!Number.isFinite(value)) return;
                updateGuard({ minSpanRatio: Math.max(0.0001, Math.min(1, value)) });
              }}
            />
          </Stack>
        </Stack>
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
    </Paper>
  );
};
