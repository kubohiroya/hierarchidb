/**
 * @file LinkButtonExample.tsx
 * @description Examples of LinkButton usage with toast notifications
 */

import { Box, Stack, Typography } from '@mui/material';
import { LinkButton } from './LinkButton';
import { useState } from 'react';

/**
 * Examples demonstrating LinkButton with toast notifications
 */
export function LinkButtonExample() {
  const [isValid, setIsValid] = useState(true);

  return (
    <Stack spacing={3} p={3}>
      <Typography variant="h5">LinkButton Toast Examples</Typography>

      <Box>
        <Typography variant="h6" gutterBottom>
          Basic Success Toast
        </Typography>
        <LinkButton
          variant="contained"
          to="/dashboard"
          successToast={{
            message: 'Navigation successful!',
            severity: 'success',
          }}
        >
          Go to Dashboard
        </LinkButton>
      </Box>

      <Box>
        <Typography variant="h6" gutterBottom>
          Save with Toast
        </Typography>
        <LinkButton
          variant="contained"
          color="primary"
          onSave={async () => {
            // Simulate save operation
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }}
          successToast={{
            message: 'Changes saved successfully!',
            severity: 'success',
            duration: 3000,
          }}
          errorToast={{
            message: 'Failed to save: {error}',
            severity: 'error',
          }}
        >
          Save Changes
        </LinkButton>
      </Box>

      <Box>
        <Typography variant="h6" gutterBottom>
          Validation Example
        </Typography>
        <LinkButton
          variant="contained"
          color="secondary"
          validate={async () => isValid}
          onSave={async () => {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }}
          successToast={{
            message: 'Form submitted successfully!',
            severity: 'success',
          }}
        >
          Submit Form
        </LinkButton>
        <Typography variant="caption" display="block" mt={1}>
          Validation is {isValid ? 'passing' : 'failing'}
          <button onClick={() => setIsValid(!isValid)}>Toggle</button>
        </Typography>
      </Box>

      <Box>
        <Typography variant="h6" gutterBottom>
          Multi-Step Workflow
        </Typography>
        <LinkButton
          variant="contained"
          color="primary"
          steps={[
            {
              execute: async () => {
                await new Promise((resolve) => setTimeout(resolve, 500));
              },
              successToast: {
                message: 'Step 1: Data validated',
                severity: 'info',
                duration: 2000,
              },
            },
            {
              execute: async () => {
                await new Promise((resolve) => setTimeout(resolve, 500));
              },
              successToast: {
                message: 'Step 2: Data processed',
                severity: 'info',
                duration: 2000,
              },
            },
            {
              execute: async () => {
                await new Promise((resolve) => setTimeout(resolve, 500));
              },
              successToast: {
                message: 'Step 3: Database updated',
                severity: 'info',
                duration: 2000,
              },
            },
          ]}
          successToast={{
            message: 'All steps completed successfully!',
            severity: 'success',
            action: {
              label: 'View Results',
              onClick: () => console.log('View results clicked'),
            },
          }}
        >
          Run Workflow
        </LinkButton>
      </Box>

      <Box>
        <Typography variant="h6" gutterBottom>
          Confirmation with Toast
        </Typography>
        <LinkButton
          variant="contained"
          color="error"
          confirmDialog={{
            enabled: true,
            title: 'Delete Confirmation',
            message: 'Are you sure you want to delete this item? This action cannot be undone.',
            confirmText: 'Delete',
            cancelText: 'Cancel',
          }}
          onSave={async () => {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }}
          successToast={{
            message: 'Item deleted successfully',
            severity: 'success',
          }}
          errorToast={{
            message: 'Failed to delete item: {error}',
            severity: 'error',
          }}
        >
          Delete Item
        </LinkButton>
      </Box>

      <Box>
        <Typography variant="h6" gutterBottom>
          Custom Toast Handler
        </Typography>
        <LinkButton
          variant="contained"
          onToast={(config) => {
            // Custom toast handling logic
            console.log('Custom toast:', config);
            // You could dispatch to a global notification system here
          }}
          onSave={async () => {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }}
          successToast={{
            message: 'Custom toast handled externally',
            severity: 'success',
          }}
        >
          Custom Toast
        </LinkButton>
      </Box>

      <Box>
        <Typography variant="h6" gutterBottom>
          Legacy Props Support
        </Typography>
        <LinkButton
          variant="outlined"
          showSuccessMessage
          successMessage="Legacy success message displayed!"
          onSave={async () => {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }}
        >
          Legacy Toast
        </LinkButton>
      </Box>

      <Box>
        <Typography variant="h6" gutterBottom>
          Error Simulation
        </Typography>
        <LinkButton
          variant="contained"
          color="warning"
          onSave={async () => {
            await new Promise((resolve) => setTimeout(resolve, 500));
            throw new Error('Network connection failed');
          }}
          errorToast={{
            message: 'Operation failed: {error}',
            severity: 'error',
            duration: 5000,
            action: {
              label: 'Retry',
              onClick: () => console.log('Retry clicked'),
            },
          }}
        >
          Simulate Error
        </LinkButton>
      </Box>

      <Box>
        <Typography variant="h6" gutterBottom>
          Disabled Toast
        </Typography>
        <LinkButton
          variant="contained"
          to="/silent"
          successToast={{
            message: 'This toast will not show',
            severity: 'success',
            enabled: false,
          }}
        >
          Silent Navigation
        </LinkButton>
      </Box>
    </Stack>
  );
}
