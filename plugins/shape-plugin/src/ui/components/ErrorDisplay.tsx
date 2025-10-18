import { Alert } from '@mui/material';

export interface ErrorDisplayProps {
  error?: Error | null;
}

export function ErrorDisplay({ error }: ErrorDisplayProps): JSX.Element | null {
  if (!error) return null;
  return <Alert severity="error">{error.message}</Alert>;
}
