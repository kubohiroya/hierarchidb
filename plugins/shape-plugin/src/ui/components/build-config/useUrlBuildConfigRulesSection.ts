import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ShapeBuildConfig, ShapeBuildUrlRule, ShapeUrlMatchType } from '~/common/types/BuildTaskResult';

const VALID_MATCH_TYPES = new Set<ShapeUrlMatchType>(['default', 'regexp', 'prefix']);

const serializeRules = (rules?: ShapeBuildUrlRule[]): string =>
  rules && rules.length > 0 ? JSON.stringify(rules, null, 2) : '';

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
    if (
      buildConfig !== undefined &&
      (typeof buildConfig !== 'object' || buildConfig === null || Array.isArray(buildConfig))
    ) {
      return { error: `Rule ${index + 1}: buildConfig must be an object.` };
    }

    if (record.key !== undefined && typeof record.key !== 'string') {
      return { error: `Rule ${index + 1}: key must be a string.` };
    }

    rules.push(entry as ShapeBuildUrlRule);
  }

  return { value: rules };
};

type Args = {
  config: ShapeBuildConfig;
  onChange: (next: ShapeBuildConfig | ((prev: ShapeBuildConfig) => ShapeBuildConfig)) => void;
};

export const useUrlBuildConfigRulesSection = ({ config, onChange }: Args) => {
  const normalized = useMemo(
    () => serializeRules(config.urlBuildConfigRules),
    [config.urlBuildConfigRules]
  );
  const [text, setText] = useState(normalized);
  const [error, setError] = useState('');

  useEffect(() => {
    setText(normalized);
    setError('');
  }, [normalized]);

  const applyRules = useCallback(
    (nextRules?: ShapeBuildUrlRule[]) => {
      onChange((prevConfig) => ({
        ...prevConfig,
        urlBuildConfigRules: nextRules,
      }));
    },
    [onChange]
  );

  const handleBlur = useCallback(() => {
    const { value, error: nextError } = parseRules(text);
    if (nextError) {
      setError(nextError);
      return;
    }
    setError('');
    applyRules(value);
  }, [applyRules, text]);

  const flushPendingRules = useCallback(
    (options?: { emitError: boolean }) => {
      const emitError = options?.emitError ?? true;
      const { value, error: nextError } = parseRules(text);
      if (nextError) {
        if (emitError) {
          setError((prev) => prev || nextError);
        }
        return;
      }
      setError('');
      applyRules(value);
    },
    [applyRules, text]
  );

  useEffect(() => {
    return () => {
      flushPendingRules({ emitError: false });
    };
  }, [flushPendingRules]);

  const handleChange = useCallback(
    (nextText: string) => {
      setText(nextText);
      if (error) {
        setError('');
      }
    },
    [error]
  );

  return {
    error,
    text,
    handleBlur,
    handleChange,
  };
};
