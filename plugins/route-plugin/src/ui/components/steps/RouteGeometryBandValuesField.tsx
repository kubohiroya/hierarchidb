import { useTranslation } from '@hierarchidb/ui-i18n';
import { TextField } from '@mui/material';
import type React from 'react';
import { useEffect, useState } from 'react';
import {
  parseRouteGeometryBandValues,
  type RouteGeometryBandValuesParseError,
} from './parseRouteGeometryBandValues.js';

export interface RouteGeometryBandValuesFieldProps {
  label: string;
  values: number[];
  bandCount: number;
  onValuesChange: (values: number[]) => void;
  disabled?: boolean;
}

export const RouteGeometryBandValuesField: React.FC<RouteGeometryBandValuesFieldProps> = ({
  label,
  values,
  bandCount,
  onValuesChange,
  disabled,
}) => {
  const { t } = useTranslation('route-plugin');
  const serializedValues = values.join(', ');
  const initialResult = parseRouteGeometryBandValues(serializedValues, bandCount);
  const [rawValue, setRawValue] = useState(serializedValues);
  const [parseError, setParseError] = useState<RouteGeometryBandValuesParseError | null>(
    initialResult.ok ? null : initialResult.error
  );

  useEffect(() => {
    setRawValue(serializedValues);
    const result = parseRouteGeometryBandValues(serializedValues, bandCount);
    setParseError(result.ok ? null : result.error);
  }, [bandCount, serializedValues]);

  let helperText: string | undefined;
  switch (parseError?.kind) {
    case 'bandCount': {
      const fallback = 'Configure at least one valid zoom band first.';
      const translated = t('processing.routeTransform.errors.bandCount', fallback);
      helperText = typeof translated === 'string' ? translated : fallback;
      break;
    }
    case 'valueCount': {
      const fallback = `Enter exactly ${String(parseError.expectedCount)} comma-separated values.`;
      const translated = t('processing.routeTransform.errors.valueCount', fallback);
      helperText = typeof translated === 'string' ? translated : fallback;
      break;
    }
    case 'invalidValue': {
      const fallback = `Value ${String(parseError.index + 1)} must be a finite non-negative number.`;
      const translated = t('processing.routeTransform.errors.invalidValue', fallback);
      helperText = typeof translated === 'string' ? translated : fallback;
      break;
    }
  }

  return (
    <TextField
      label={label}
      value={rawValue}
      onChange={(event) => {
        const nextRawValue = event.target.value;
        setRawValue(nextRawValue);
        const result = parseRouteGeometryBandValues(nextRawValue, bandCount);
        if (!result.ok) {
          setParseError(result.error);
          return;
        }
        setParseError(null);
        onValuesChange(result.values);
      }}
      error={parseError !== null}
      helperText={helperText}
      disabled={disabled}
      fullWidth
    />
  );
};
