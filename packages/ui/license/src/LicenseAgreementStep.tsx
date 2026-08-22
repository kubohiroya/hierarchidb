import { Alert, AlertTitle, Box, Button, Stack, Typography } from '@mui/material';
import type React from 'react';

export interface LicenseDetails {
  licenseName: string;
  attribution?: string;
  url?: string;
}

export interface LicenseAgreementState {
  agreed: boolean;
  agreedAt?: string;
}

export interface LicenseAgreementStepProps {
  sourceName: string;
  details: LicenseDetails;
  state: LicenseAgreementState;
  onAgree: () => void;
  disabled?: boolean;
  renderExtra?: React.ReactNode;
}

export const LicenseAgreementStep: React.FC<LicenseAgreementStepProps> = ({
  sourceName,
  details,
  state,
  onAgree,
  disabled,
  renderExtra,
}) => (
  <Box display="flex" flexDirection="column" gap={3}>
    <Typography variant="body2" color="text.secondary">
      Please review and agree to the licensing requirements for {sourceName}.
    </Typography>

    <Alert severity="info">
      <AlertTitle>{sourceName} License</AlertTitle>
      <Stack spacing={1.5}>
        <Typography variant="body2">
          <strong>License:</strong> {details.licenseName}
        </Typography>
        {details.attribution && (
          <Typography variant="body2">
            <strong>Attribution:</strong> {details.attribution}
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary">
          By clicking the button below, you acknowledge that you have read and agree to comply with
          the licensing requirements.
        </Typography>
        <Button
          variant={state.agreed ? 'outlined' : 'contained'}
          color={state.agreed ? 'success' : 'warning'}
          disabled={disabled}
          onClick={onAgree}
          startIcon={details.url ? undefined : undefined}
        >
          {state.agreed ? 'License Agreed - View Details' : 'View License Terms & Agree'}
        </Button>
      </Stack>
    </Alert>

    {state.agreed && (
      <Alert severity="success">
        <Stack spacing={0.5}>
          <Typography variant="body2">
            ✓ You have agreed to the {details.licenseName} terms.
          </Typography>
          {state.agreedAt && (
            <Typography variant="caption" color="text.secondary">
              Agreed on: {new Date(state.agreedAt).toLocaleString()}
            </Typography>
          )}
        </Stack>
      </Alert>
    )}

    {renderExtra}
  </Box>
);
