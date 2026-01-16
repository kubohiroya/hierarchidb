/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom/vitest" />
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, it, expect } from 'vitest';
import { PluginDialogFooter } from '../../headless/components/PluginDialogFooter.js';
import { PluginDialogProvider } from '@hierarchidb/ui-dialog';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => () => Promise.resolve(),
  useLocation: () => ({ pathname: '/t/demo/root', searchStr: '', hash: '' }),
}));

afterEach(() => {
  cleanup();
});

function renderFooter({
  isDirty,
  validated = true,
}: {
  isDirty: boolean;
  validated?: boolean;
}) {
  const contextValue = {
    open: true,
    stepComponents: [
      { id: 'basic', label: 'Basic', component: () => null },
    ],
    stepData: {},
    onStepDataChange: () => {},
    activeStepIndex: 0,
    enabledStepIndices: [0],
    validatedStepIndices: validated ? [0] : [],
    committableStepIndices: [0],
    invalidMessageMap: {},
    isDirty,
    onStepNavigate: () => {},
    onRequestClose: () => {},
    onRequestCommit: () => {},
    displayMode: 'normal' as const,
    onDisplayModeChange: () => {},
    onDragHandlePointerDown: () => {},
  } satisfies Parameters<typeof PluginDialogProvider>[0]['value'];

  return render(
    <ThemeProvider theme={createTheme()}>
      <PluginDialogProvider value={contextValue}>
        <PluginDialogFooter mode="edit" canCommit={true} />
      </PluginDialogProvider>
    </ThemeProvider>
  );
}

describe('folder-save-disabled', () => {
  it('disables Save when dirty is false at initial render', () => {
    renderFooter({ isDirty: false });
    const saveButton = screen.getByRole('button', { name: 'Save' });
    expect(saveButton).toBeDisabled();
  });

  it('enables Save after dirty becomes true', () => {
    renderFooter({ isDirty: true });
    const saveButton = screen.getByRole('button', { name: 'Save' });
    expect(saveButton).not.toBeDisabled();
  });
});
