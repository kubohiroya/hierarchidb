import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Grid,
  Typography,
  Stack,
  TextField,
} from '@mui/material';
import { Link as LinkIcon } from '@mui/icons-material';
import { BuildConfigSectionTitle } from '@hierarchidb/ui-accordion-config';
import { useTranslation } from '~/ui/i18n';
import type {
  ShapeBuildConfig,
  ShapeBuildUrlRule,
  ShapeUrlMatchType,
} from '~/common/types/index';

type Props = {
  config: ShapeBuildConfig;
  onChange: (next: ShapeBuildConfig | ((prev: ShapeBuildConfig) => ShapeBuildConfig)) => void;
  disabled?: boolean;
};

const VALID_MATCH_TYPES = new Set<ShapeUrlMatchType>(['default', 'regexp', 'prefix']);

const serializeRules = (rules?: ShapeBuildUrlRule[]): string => (
  rules && rules.length > 0
    ? JSON.stringify(rules, null, 2)
    : ''
);

const parseRules = (raw: string): { value?: ShapeBuildUrlRule[]; error?: string } => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { value: undefined };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Invalid JSON' };
  }

  if (!Array.isArray(parsed)) {
    return { error: 'The JSON must be an array of rule objects.' };
  }

  const rules: ShapeBuildUrlRule[] = [];
  for (let index = 0; index < parsed.length; index += 1) {
    const entry = parsed[index];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return { error: `Rule ${index + 1} is not an object.` };
    }

    const record = entry as Record<string, unknown>;
    const matchType = record.matchType;
    if (typeof matchType !== 'string' || !VALID_MATCH_TYPES.has(matchType as ShapeUrlMatchType)) {
      return { error: `Rule ${index + 1}: matchType must be default, regexp, or prefix.` };
    }

    if (matchType !== 'default') {
      const pattern = record.pattern;
      if (typeof pattern !== 'string' || pattern.length === 0) {
        return { error: `Rule ${index + 1}: pattern is required for matchType ${matchType}.` };
      }
    }

    const buildConfig = record.buildConfig;
    if (buildConfig !== undefined && (typeof buildConfig !== 'object' || buildConfig === null || Array.isArray(buildConfig))) {
      return { error: `Rule ${index + 1}: buildConfig must be an object.` };
    }

    if (record.key !== undefined && typeof record.key !== 'string') {
      return { error: `Rule ${index + 1}: key must be a string.` };
    }

    rules.push(entry as ShapeBuildUrlRule);
  }

  return { value: rules };
};

export const UrlBuildConfigRulesSection: React.FC<Props> = ({ config, onChange, disabled }) => {
  const { t } = useTranslation();
  const normalized = useMemo(
    () => serializeRules(config.urlBuildConfigRules),
    [config.urlBuildConfigRules],
  );
  const [text, setText] = useState(normalized);
  const [error, setError] = useState('');

  useEffect(() => {
    setText(normalized);
    setError('');
  }, [normalized]);

  const applyRules = useCallback((nextRules?: ShapeBuildUrlRule[]) => {
    onChange((prevConfig) => ({
      ...prevConfig,
      urlBuildConfigRules: nextRules,
    }));
  }, [onChange]);

  const handleBlur = useCallback(() => {
    const { value, error: nextError } = parseRules(text);
    if (nextError) {
      setError(nextError);
      return;
    }
    setError('');
    applyRules(value);
  }, [text, applyRules]);

  const flushPendingRules = useCallback((options?: { emitError: boolean }) => {
    const emitError = options?.emitError ?? true;
    const { value, error: nextError } = parseRules(text);
    if (nextError) {
      if (emitError) {
        setError((prev) => (prev || nextError));
      }
      return;
    }
    setError('');
    applyRules(value);
  }, [applyRules, text]);

  useEffect(() => {
    return () => {
      flushPendingRules({ emitError: false });
    };
  }, [flushPendingRules]);

  const handleChange = useCallback((nextText: string) => {
    setText(nextText);
    if (error) {
      setError('');
    }
  }, [error]);

  return (
    <Stack spacing={1.5} sx={{ opacity: disabled ? 0.6 : 1 }}>
      <BuildConfigSectionTitle
        icon={<LinkIcon fontSize="small" color="primary" />}
        title={t('processing.urlRules.sectionTitle', 'URL-specific rules')}
      />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            size="small"
            multiline
            minRows={8}
            value={text}
            disabled={disabled}
            onChange={(event) => handleChange(event.target.value)}
            onBlur={handleBlur}
            error={Boolean(error)}
            helperText={error}
            fullWidth
            sx={{
              '& .MuiInputBase-root': {
                alignItems: 'stretch',
                lineHeight: 1.5,
                fontFamily: 'monospace',
                overflow: 'auto',
              },
              '& textarea': {
                resize: 'both',
              },
            }}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Alert severity="info" sx={{ whiteSpace: 'pre-wrap', height: '100%' }}>
            {t(
              'processing.urlRules.example',
              `Example:
[
  { "key": "default", "matchType": "default", "buildConfig": { "transformConfig": { "toleranceByBand": [0.12, 0.11, 0.1, 0.09, 0.08] } } },
  { "key": "russia-coast", "matchType": "regexp", "pattern": "(?i).*russia.*", "buildConfig": { "transformConfig": { "toleranceByBand": [0.3, 0.25, 0.2, 0.18, 0.16] } }
]`,
            )}
          </Alert>
        </Grid>
      </Grid>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ whiteSpace: 'pre-wrap' }}
      >
        {t(
          'processing.urlRules.description',
          'Define per-URL overrides in JSON. This JSON is evaluated in order and each entry applies to matching URLs.',
        )}
      </Typography>
    </Stack>
  );
};
