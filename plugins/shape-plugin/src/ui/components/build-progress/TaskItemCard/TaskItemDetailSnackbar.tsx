import type React from 'react';
import { Box, Snackbar, Stack, Typography } from '@mui/material';
import type { TaskOutcomeSummary } from '~/ui/components/build-progress/TaskItem/TaskItem';

type TaskDetailPayload = {
  title: string;
  summary: TaskOutcomeSummary;
};

type Props = {
  detail: TaskDetailPayload | null;
};

const toFlagEmoji = (countryCode: string | null): string | null => {
  if (!countryCode) return null;
  const normalized = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return null;
  const base = 0x1f1e6;
  const first = normalized.charCodeAt(0) - 65 + base;
  const second = normalized.charCodeAt(1) - 65 + base;
  return String.fromCodePoint(first, second);
};

const extractCountryCodeFromTitle = (title: string): string | null => {
  const match = title.match(/\(([A-Za-z]{2})\)/);
  if (!match) return null;
  return match[1] ?? null;
};

const VERTEX_LIMIT = 6553;
const numberFormatter = new Intl.NumberFormat('en-US');

const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'N/A';
  return numberFormatter.format(Math.round(value));
};

const formatPercent = (ratio: number | null): string => {
  if (ratio === null || !Number.isFinite(ratio)) return 'N/A';
  return `${Math.round(ratio * 1000) / 10}%`;
};

const resolveRatio = (output: number | null | undefined, input: number | null | undefined): number | null => {
  if (output === null || output === undefined || input === null || input === undefined || input <= 0) return null;
  return Math.max(0, Math.min(1, output / input));
};

const renderVolumeRow = (
  label: string,
  output: number | null | undefined,
  input: number | null | undefined,
  colorToken: string,
  withVertexLimitLine: boolean,
): React.ReactNode => {
  const ratio = resolveRatio(output, input);
  const vertexLimitRatio = (
    withVertexLimitLine && input !== null && input !== undefined && input > 0
  )
    ? Math.max(0, Math.min(1, VERTEX_LIMIT / input))
    : null;

  const text = `${formatNumber(output)} / ${formatNumber(input)} (${formatPercent(ratio)})`;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography variant="caption" sx={{ width: 56, color: 'text.secondary' }}>
        {label}
      </Typography>
      <Box sx={{ position: 'relative', flex: 1, height: 20, bgcolor: 'grey.300', borderRadius: 0.75, overflow: 'hidden' }}>
        {ratio !== null ? (
          <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${ratio * 100}%`, bgcolor: colorToken }} />
        ) : null}
        {vertexLimitRatio !== null ? (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${vertexLimitRatio * 100}%`,
              width: '2px',
              background: (theme) => `linear-gradient(to right, ${theme.palette.warning.main} 0 1px, ${theme.palette.common.black} 1px 2px)`,
            }}
          />
        ) : null}
        <Typography
          variant="caption"
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'common.white',
            mixBlendMode: 'difference',
            px: 0.5,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {text}
        </Typography>
      </Box>
    </Box>
  );
};

export const TaskItemDetailSnackbar = ({ detail }: Props) => {
  const summary = detail?.summary;
  const title = detail?.title ?? '';
  const countryFlag = toFlagEmoji(summary?.fetchDetails?.countryCode ?? extractCountryCodeFromTitle(title));
  const detailColor = summary?.kind === 'failed' ? 'error.main' : 'text.secondary';
  const chartColor = summary?.kind === 'failed' ? 'error.main' : 'primary.main';
  const fetchFeaturesRatio = resolveRatio(summary?.fetchDetails?.features.output, summary?.fetchDetails?.features.input);
  const fetchPolygonsRatio = resolveRatio(summary?.fetchDetails?.polygons.output, summary?.fetchDetails?.polygons.input);

  return (
    <Snackbar
      open={Boolean(detail && summary)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
    >
      <Box
        sx={{
          width: 420,
          maxWidth: 'calc(100vw - 32px)',
          p: 1.25,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          boxShadow: 8,
        }}
      >
        <Typography variant="caption" color={detailColor} sx={{ fontWeight: 600 }}>
          <Box
            component="span"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.75,
              fontSize: 16,
              fontWeight: 700,
              color: summary?.kind === 'failed' ? 'error.light' : 'info.light',
              lineHeight: 1.25,
            }}
          >
            {countryFlag ? <span>{countryFlag}</span> : null}
            <span>{title}</span>
          </Box>
        </Typography>
        {summary?.visualization === 'transformMetrics' ? (
          <Stack spacing={0.5} sx={{ mt: 0.75 }}>
            <Typography variant="caption" color="text.secondary">
              Effective tolerance: {summary.effectiveTolerance ?? 'N/A'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Retry attempts: {summary.retryAttempt ?? 'N/A'} / {summary.retryMax ?? 'N/A'}
            </Typography>
            {renderVolumeRow(
              'Features',
              summary.metrics?.features.output,
              summary.metrics?.features.input,
              chartColor,
              false,
            )}
            {renderVolumeRow(
              'Polygons',
              summary.metrics?.polygons.output,
              summary.metrics?.polygons.input,
              chartColor,
              false,
            )}
            {renderVolumeRow(
              'Vertices',
              summary.metrics?.vertices.output,
              summary.metrics?.vertices.input,
              chartColor,
              true,
            )}
          </Stack>
        ) : null}
        {summary?.visualization === 'fetchMetrics' ? (
          <Stack spacing={0.5} sx={{ mt: 0.75 }}>
            <Typography variant="caption" color={detailColor} sx={{ fontWeight: 600 }}>
              URL: {summary.fetchDetails?.url ?? 'N/A'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Features: {formatNumber(summary.fetchDetails?.features.output)} / {formatNumber(summary.fetchDetails?.features.input)} ({formatPercent(fetchFeaturesRatio)})
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Polygons: {formatNumber(summary.fetchDetails?.polygons.output)} / {formatNumber(summary.fetchDetails?.polygons.input)} ({formatPercent(fetchPolygonsRatio)})
            </Typography>
          </Stack>
        ) : null}
      </Box>
    </Snackbar>
  );
};
