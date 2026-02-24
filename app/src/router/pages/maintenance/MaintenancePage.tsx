import { useAuth } from '@hierarchidb/ui-plugin-shell/ui-auth';
import {
  Alert,
  Box,
  Button,
  Container,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useWorker } from '~/contexts/WorkerProvider';
import {
  executeIndexedDbMaintenance,
  type MaintenanceExecutionResult,
  type MaintenanceStepEvent,
} from '~/maintenance/maintenanceExecution';
import {
  clearMaintenanceSession,
  markMaintenanceSessionConsumed,
  validateMaintenanceSession,
} from '~/maintenance/maintenanceSession';

const invalidReasonMessage = (reason: string): string => {
  switch (reason) {
    case 'missing-params':
      return 'Maintenance URL is missing required parameters.';
    case 'missing-session':
      return 'Maintenance session was not found. Start again from the user menu.';
    case 'session-mismatch':
      return 'Maintenance session did not match this browser session.';
    case 'session-expired':
      return 'Maintenance session expired. Start again from the user menu.';
    case 'session-consumed':
      return 'This maintenance session has already been used.';
    default:
      return 'Maintenance session is invalid.';
  }
};

export default function MaintenancePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const worker = useWorker();
  const { user } = useAuth();

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const sessionId = searchParams.get('msid');
  const sessionSecret = searchParams.get('msk');

  const validation = useMemo(
    () => validateMaintenanceSession({ sessionId, sessionSecret }),
    [sessionId, sessionSecret]
  );

  const [confirmationInput, setConfirmationInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [execution, setExecution] = useState<MaintenanceExecutionResult | null>(null);
  const [executionSteps, setExecutionSteps] = useState<MaintenanceStepEvent[]>([]);
  const [running, setRunning] = useState(false);

  const expectedPhrase = validation.ok ? `DELETE ${validation.session.confirmationCode}` : '';
  const expectedEmail = validation.ok ? validation.session.expectedEmail : null;
  const loggedInEmail = user?.profile?.email?.trim() || '';

  const emailMatched =
    !expectedEmail || emailInput.trim().toLowerCase() === expectedEmail.trim().toLowerCase();
  const confirmationMatched =
    validation.ok && confirmationInput.trim().toUpperCase() === expectedPhrase;

  const canExecute = validation.ok && confirmationMatched && emailMatched && !running;

  const startExecution = async () => {
    if (!validation.ok || !canExecute) return;

    markMaintenanceSessionConsumed(validation.session.sessionId);
    setRunning(true);
    setExecution(null);
    setExecutionSteps([]);

    const result = await executeIndexedDbMaintenance({
      sessionId: validation.session.sessionId,
      initializeWorker: worker.initialize,
      onStep: (step) => {
        setExecutionSteps((prev) => [...prev, step]);
      },
    });

    if (result.success) {
      clearMaintenanceSession();
    }

    setExecution(result);
    setRunning(false);

    if (result.success && typeof window !== 'undefined') {
      window.setTimeout(() => {
        window.location.reload();
      }, 0);
    }
  };

  if (!validation.ok) {
    return (
      <Container maxWidth="sm" sx={{ py: 6 }}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom>
            IndexedDB Maintenance
          </Typography>
          <Alert severity="error" sx={{ mb: 3 }}>
            {invalidReasonMessage(validation.reason)}
          </Alert>
          <Button variant="contained" onClick={() => navigate({ to: '/' })}>
            Back to Home
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 5 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          IndexedDB Maintenance
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          This flow stops worker runtimes, deletes IndexedDB databases, and reinitializes worker
          services to run schema upgrades. This action is destructive.
        </Typography>

        <Alert severity="warning" sx={{ mb: 2 }}>
          Continue only if you explicitly intend to reset local IndexedDB state.
        </Alert>

        <Stack spacing={2} sx={{ mb: 2 }}>
          <TextField
            label="Confirmation phrase"
            value={confirmationInput}
            onChange={(event) => setConfirmationInput(event.target.value)}
            placeholder={expectedPhrase}
            helperText={`Type exactly: ${expectedPhrase}`}
            fullWidth
          />

          {expectedEmail ? (
            <TextField
              label="Account email confirmation"
              value={emailInput}
              onChange={(event) => setEmailInput(event.target.value)}
              placeholder={expectedEmail}
              helperText={`Type the account email to continue${
                loggedInEmail ? ` (signed-in: ${loggedInEmail})` : ''
              }.`}
              fullWidth
            />
          ) : null}
        </Stack>

        <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
          <Button variant="contained" color="error" disabled={!canExecute} onClick={startExecution}>
            {running ? 'Running…' : 'Run Maintenance'}
          </Button>
          <Button variant="outlined" onClick={() => navigate({ to: '/' })} disabled={running}>
            Cancel
          </Button>
        </Stack>

        {executionSteps.length > 0 ? (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Progress
            </Typography>
            <List dense>
              {executionSteps.map((step, index) => (
                <ListItem key={`${step.step}-${index}`} disableGutters>
                  <ListItemText primary={step.message} secondary={step.step} />
                </ListItem>
              ))}
            </List>
          </Box>
        ) : null}

        {execution ? (
          <Alert severity={execution.success ? 'success' : 'error'} sx={{ mb: 2 }}>
            {execution.message}
          </Alert>
        ) : null}

        {execution && execution.blockedDatabases.length > 0 ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Blocked databases: {execution.blockedDatabases.join(', ')}. Close other tabs and retry
            from the user menu.
          </Alert>
        ) : null}

        {execution && execution.failedDatabases.length > 0 ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Failed databases: {execution.failedDatabases.map((item) => item.name).join(', ')}
          </Alert>
        ) : null}

        {execution?.success ? (
          <Button variant="contained" onClick={() => navigate({ to: '/' })}>
            Return to Home
          </Button>
        ) : null}
      </Paper>
    </Container>
  );
}
