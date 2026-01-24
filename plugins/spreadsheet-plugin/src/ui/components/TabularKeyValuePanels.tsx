import React, { useMemo, useRef, useEffect } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Divider,
  LinearProgress,
  Slider,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import PreviewIcon from '@mui/icons-material/Preview';
import KeyIcon from '@mui/icons-material/Key';
import { useTranslation } from '@hierarchidb/ui-i18n';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  binCountAtom,
  histogramStatsAtom,
  numericValuesAtom,
  tabularProcessingAtom,
} from '../state/tabularKeyValueAtoms.js';
import { KeyValueSourcePanel } from './KeyValueSourcePanel.js';
import { ValueHistogram } from './ValueHistogram.js';

type Props = {
  translationNamespace?: string;
  dialogRef?: React.RefObject<HTMLElement | null>;
  columns: string[];
  selectedKeyColumn: string;
  selectedValueColumn: string;
  onKeyColumnChange: (col: string) => void;
  onValueColumnChange: (col: string) => void;
  filterRulesSlot: React.ReactNode;
  previewSlot: React.ReactNode | null;
  errorSlot: React.ReactNode | null;
  previewDirty: boolean;
  showPreview?: boolean;
};

export const TabularKeyValuePanels: React.FC<Props> = ({
  translationNamespace = 'spreadsheet-plugin',
  dialogRef,
  columns,
  selectedKeyColumn,
  selectedValueColumn,
  onKeyColumnChange,
  onValueColumnChange,
  filterRulesSlot,
  previewSlot,
  errorSlot,
  previewDirty,
  showPreview = true,
}) => {
  const { t } = useTranslation(translationNamespace);
  const binCount = useAtomValue(binCountAtom);
  const setBinCount = useSetAtom(binCountAtom);
  const numericValues = useAtomValue(numericValuesAtom);
  const stats = useAtomValue(histogramStatsAtom);
  const isProcessing = useAtomValue(tabularProcessingAtom);
  const histogramContainerRef = useRef<HTMLDivElement | null>(null);
  const [histogramWidth, setHistogramWidth] = React.useState<number>(480);

  useEffect(() => {
    const el = histogramContainerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = (target: Element) => {
      const measured = target.getBoundingClientRect().width;
      if (measured > 0) {
        setHistogramWidth(measured);
      }
    };
    update(el);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      const target = entry?.target;
      if (target) {
        update(target);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const keyValueSection = useMemo(
    () => (
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          {t(
            'styleSettings.keyValuePair.description',
            'Select the key and value columns to drive calculations and review basic statistics.',
          )}
        </Typography>
        <KeyValueSourcePanel
          keyColumn={selectedKeyColumn}
          valueColumn={selectedValueColumn}
          onKeyColumnChange={onKeyColumnChange}
          onValueColumnChange={onValueColumnChange}
          menuContainer={(dialogRef?.current as Element | null) ?? null}
          columns={columns}
          translationNamespace={translationNamespace}
        />
        <Divider />
        {stats ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 2fr',
              gap: 2,
              alignItems: 'start',
            }}
          >
            <Box>
              <Stack spacing={1}>
                <Box component="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {[
                      { label: t('styleSettings.keyValuePair.stats.count', 'Count'), value: stats.count },
                      { label: t('styleSettings.keyValuePair.stats.min', 'Min'), value: stats.min },
                      { label: t('styleSettings.keyValuePair.stats.max', 'Max'), value: stats.max },
                      { label: t('styleSettings.keyValuePair.stats.mean', 'Average'), value: stats.mean },
                      { label: t('styleSettings.keyValuePair.stats.median', 'Median'), value: stats.median },
                      { label: t('styleSettings.keyValuePair.stats.stdDev', 'Std Dev'), value: stats.stdDev },
                    ].map(({ label, value }) => (
                      <tr key={label} style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                        <td style={{ padding: '4px 8px', whiteSpace: 'nowrap' }}>
                          <Typography variant="body2">{label}</Typography>
                        </td>
                        <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                          <Typography variant="body2">
                            {new Intl.NumberFormat('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }).format(value)}
                          </Typography>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Box>
              </Stack>
            </Box>
            <Box>
              <Stack spacing={1.5}>
                <Box px={2}>
                  <Typography variant="caption" color="text.secondary">
                    {t('styleSettings.keyValuePair.histogram.binCount', 'Number of bins')}
                  </Typography>
                  <Slider
                    value={binCount}
                    min={1}
                    max={256}
                    step={1}
                    marks={[
                      { value: 1, label: '1' },
                      { value: 64, label: '64' },
                      { value: 128, label: '128' },
                      { value: 256, label: '256' },
                    ]}
                    onChange={(_e, value) => setBinCount(value as number)}
                  />
                </Box>
                <Box ref={histogramContainerRef} sx={{ width: '100%' }}>
                  <ValueHistogram
                    values={numericValues}
                    binCount={binCount}
                    width={histogramWidth}
                    height={300}
                    min={stats.min}
                    max={stats.max}
                    mean={stats.mean}
                    valueLabel={
                      selectedValueColumn && typeof selectedValueColumn === 'string'
                        ? selectedValueColumn
                        : t('styleSettings.keyValuePair.value', 'Value') ?? undefined
                    }
                    keyLabel={t('styleSettings.keyValuePair.key', 'frequency') ?? undefined}
                  />
                </Box>
              </Stack>
            </Box>
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {t(
              'styleSettings.keyValuePair.stats.empty',
              'Select a value column with numeric values to view statistics.',
            )}
          </Typography>
        )}
      </Stack>
    ),
    [
      binCount,
      columns,
      dialogRef,
      onKeyColumnChange,
      onValueColumnChange,
      histogramWidth,
      numericValues,
      selectedKeyColumn,
      selectedValueColumn,
      setBinCount,
      stats,
      t,
      translationNamespace,
    ],
  );

  return (
    <Stack spacing={1}>
      <Box sx={{ px: 1, minHeight: 38 }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ visibility: isProcessing ? 'visible' : 'hidden' }}
        >
          {t('filtering.processing', 'Processing tabular data...')}
        </Typography>
        <LinearProgress
          sx={{ mt: 0.5, visibility: isProcessing ? 'visible' : 'hidden' }}
        />
      </Box>
      <Accordion defaultExpanded disableGutters square>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Stack direction="row" spacing={1} alignItems="center">
            <FilterAltIcon fontSize="small" />
            <Typography variant="subtitle1">
              {t('styleSettings.filterRules.title', 'Filter Rules')}
            </Typography>
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1.5}>
            {filterRulesSlot}
            {errorSlot}
          </Stack>
        </AccordionDetails>
      </Accordion>

      {showPreview && (
        <Accordion defaultExpanded disableGutters square>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
              <PreviewIcon fontSize="small" />
              <Typography variant="subtitle1">
                {t('styleSettings.previewTabular.title', 'Preview Tabular')}
              </Typography>
              <Box sx={{ flexGrow: 1, ml: 1, display: 'flex', alignItems: 'center' }}>
                <LinearProgress
                  variant="indeterminate"
                  sx={{ width: '100%', visibility: previewDirty ? 'visible' : 'hidden' }}
                />
              </Box>
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            {previewSlot ?? (
              <Typography variant="body2" color="text.secondary">
                {t('styleSettings.previewTabular.empty', 'Preview data will appear after filters are applied.')}
              </Typography>
            )}
          </AccordionDetails>
        </Accordion>
      )}

      <Accordion defaultExpanded disableGutters square>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Stack direction="row" spacing={1} alignItems="center">
            <KeyIcon fontSize="small" />
            <Typography variant="subtitle1">
              {t('styleSettings.accordion.previewStats', 'Preview Stats')}
            </Typography>
          </Stack>
        </AccordionSummary>
        <AccordionDetails>{keyValueSection}</AccordionDetails>
      </Accordion>
    </Stack>
  );
};
