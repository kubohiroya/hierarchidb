import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { MultiStepDialogProvider } from '@hierarchidb/ui-dialog';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { PluginDialogHeader } from '../components/PluginDialogHeader.js';

describe('PluginDialogHeader', () => {
  it('uses MUI buttons and triggers navigation callbacks', () => {
    const onStepNavigate = vi.fn();
    const onRequestClose = vi.fn();
    const contextValue = {
      open: true,
      stepComponents: [
        { id: 'basic', label: 'Basic', component: () => null },
        { id: 'details', label: 'Details', component: () => null },
      ],
      stepData: {},
      onStepDataChange: vi.fn(),
      activeStepIndex: 0,
      enabledStepIndices: [0, 1],
      validatedStepIndices: [],
      committableStepIndices: [1],
      invalidMessageMap: {},
      isDirty: true,
      onStepNavigate,
      onRequestClose,
      onRequestCommit: vi.fn(),
      displayMode: 'normal' as const,
      onDisplayModeChange: vi.fn(),
    };

    render(
      <MemoryRouter initialEntries={['/dialog']}> 
        <ThemeProvider theme={createTheme()}>
          <MultiStepDialogProvider value={contextValue}>
            <PluginDialogHeader title="Create Folder" mode="create" />
          </MultiStepDialogProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    const detailsStepButton = screen.getByRole('link', { name: /Details/i });
    fireEvent.click(detailsStepButton);
    expect(onStepNavigate).toHaveBeenCalledWith({ type: 'direct', targetIndex: 1 });

    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();

    const closeButton = screen.getByLabelText('Close dialog');
    fireEvent.click(closeButton);
    expect(onRequestClose).toHaveBeenCalledWith('close');
  });
});
