import type { ReactElement } from 'react';
import { Alert, Snackbar } from '@mui/material';

export type RoutePreviewHoverSnackbarProps = {
  open: boolean;
  message: string;
};

export const RoutePreviewHoverSnackbar = ({
  open,
  message,
}: RoutePreviewHoverSnackbarProps): ReactElement => (
  <Snackbar
    open={open}
    message={message}
    anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
    autoHideDuration={2000}
  />
);

export type RoutePreviewEmptyContentProps = {
  message: string;
};

export const RoutePreviewEmptyContent = ({ message }: RoutePreviewEmptyContentProps): ReactElement => (
  <Alert severity="info" sx={{ m: 2 }}>
    {message}
  </Alert>
);
