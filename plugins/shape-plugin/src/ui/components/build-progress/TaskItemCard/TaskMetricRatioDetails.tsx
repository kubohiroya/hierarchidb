import { Box, Stack, Typography } from '@mui/material';
import { StackedBarChart100 } from '@hierarchidb/ui-stacked-barchart';
import type { TaskSummaryMetricEntry } from '~/ui/components/build-progress/taskDisplayText';

type Translate = (key: string, fallback?: string, options?: Record<string, unknown>) => string;

type TaskMetricRatioDetailsProps = {
  metrics: TaskSummaryMetricEntry[];
  t: Translate;
};

const numberFormatter = new Intl.NumberFormat('en-US');

const formatNumber = (value: number): string => numberFormatter.format(Math.round(value));

const toSafeRatio = (input: number, output: number): number => {
  if (!Number.isFinite(input) || input <= 0) return 0;
  const ratio = (output / input) * 100;
  if (!Number.isFinite(ratio)) return 0;
  return Math.max(0, ratio);
};

export const TaskMetricRatioDetails = ({ metrics, t }: TaskMetricRatioDetailsProps) => {
  if (metrics.length === 0) return null;

  return (
    <Box sx={{ minWidth: 320, maxWidth: 440, p: 0.5 }}>
      <Stack spacing={1.25}>
        {metrics.map(({ key, metric }) => {
          const input = Math.max(0, Number.isFinite(metric.input) ? metric.input : 0);
          const output = Math.max(0, Number.isFinite(metric.output) ? metric.output : 0);
          const baseTotal = Math.max(1, input);
          const kept = Math.min(baseTotal, output);
          const removed = Math.max(0, baseTotal - kept);
          const ratio = toSafeRatio(input, output);
          const label = t(`stage.taskSummary.${key}Label`, key);
          const text = `${formatNumber(output)} / ${formatNumber(input)} (${ratio.toFixed(1)}%)`;

          return (
            <Stack key={key} spacing={0.5}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 700 }}>
                  {label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {text}
                </Typography>
              </Box>
              <StackedBarChart100
                total={baseTotal}
                height={10}
                ariaLabel={`${label}: ${text}`}
                segments={[
                  {
                    id: `${key}-processed`,
                    value: kept,
                    color: '#1976d2',
                    title: t('stage.taskSummary.processed', 'Processed'),
                  },
                  {
                    id: `${key}-remaining`,
                    value: removed,
                    color: 'rgba(100, 116, 139, 0.35)',
                    title: t('stage.taskSummary.remaining', 'Remaining'),
                  },
                ]}
              />
            </Stack>
          );
        })}
      </Stack>
    </Box>
  );
};
