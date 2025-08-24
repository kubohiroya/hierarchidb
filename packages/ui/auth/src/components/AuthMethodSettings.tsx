/**
 * @file AuthMethodSettings.tsx
 * @description Authentication method settings component (currently disabled)
 */

// import React from 'react'; // RemovedProperties: unused import
import {
  Alert,
  Box,
  FormControl,
  FormControlLabel,
  FormLabel,
  Paper,
  Radio,
  RadioGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { Info as InfoIcon } from '@mui/icons-material';
// import { AuthService } from "@/shared/auth/services/AuthService"; // TODO: Implement AuthService
const AuthService = {
  getInstance: () => ({
    getAuthMethod: () => 'google' as const,
  }),
};

export function AuthMethodSettings() {
  const authService = AuthService.getInstance();
  const currentMethod = authService.getAuthMethod();

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Box display="flex" alignItems="center" mb={2}>
        <Typography variant="h6" component="h2">
          Authentication Method
        </Typography>
        <Tooltip title="Authentication method selection is currently locked to popup mode for the best user experience">
          <InfoIcon sx={{ ml: 1, fontSize: 20, color: 'text.secondary' }} />
        </Tooltip>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        Popup authentication is currently the only supported method to maintain your work context
        during login.
      </Alert>

      <FormControl component="fieldset" disabled>
        <FormLabel component="legend">Select authentication method</FormLabel>
        <RadioGroup
          value={currentMethod}
          onChange={() => {
            // No-op as changing is disabled
          }}
        >
          <FormControlLabel
            value="popup"
            control={<Radio />}
            label={
              <Box>
                <Typography>Popup Window (Recommended)</Typography>
                <Typography variant="caption" color="text.secondary">
                  Maintains your current work state during authentication
                </Typography>
              </Box>
            }
          />
          <FormControlLabel
            value="redirect"
            control={<Radio />}
            label={
              <Box>
                <Typography>Page Redirect</Typography>
                <Typography variant="caption" color="text.secondary">
                  Requires saving and restoring your work state (Coming soon)
                </Typography>
              </Box>
            }
          />
        </RadioGroup>
      </FormControl>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
        Note: Page redirect option will be available in a future update with full state persistence
        support.
      </Typography>
    </Paper>
  );
}
