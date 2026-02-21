import { Alert } from '@mui/material';
import { useErrorDisplay } from '~/ui/hooks/useErrorDisplay';
import type { ReactElement } from 'react';

export interface ErrorDisplayProps {
  error?: Error | null;
}

export function ErrorDisplay({ error }: ErrorDisplayProps): ReactElement | null {
  const { message } = useErrorDisplay(error);
  if (!message) return null;
  return <Alert severity="error">{message}</Alert>;
}
