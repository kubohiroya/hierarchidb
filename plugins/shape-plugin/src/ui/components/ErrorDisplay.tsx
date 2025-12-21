import { Alert } from '@mui/material';
import { useErrorDisplay } from '../hooks/useErrorDisplay.js';

export interface ErrorDisplayProps {
  error?: Error | null;
}

export function ErrorDisplay({ error }: ErrorDisplayProps): JSX.Element | null {
  const { message } = useErrorDisplay(error);
  if (!message) return null;
  return <Alert severity="error">{message}</Alert>;
}
