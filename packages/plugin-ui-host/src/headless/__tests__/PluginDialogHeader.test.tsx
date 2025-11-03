import { MultiStepDialogProvider } from '@hierarchidb/ui-dialog';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { vi } from 'vitest';
import { PluginDialogHeader } from '../components/PluginDialogHeader.js';

const headerLocationRef = {
  pathname: '/dialog',
  searchStr: '',
  hash: '',
};

type MockLinkProps = ComponentProps<'a'> & {
  to?: string | { to?: string };
};

vi.mock('@tanstack/react-router', () => {
  const React = require('react') as typeof import('react');
  return {
    useNavigate: () => () => Promise.resolve(),
    useLocation: () => headerLocationRef,
    Link: React.forwardRef<HTMLAnchorElement, MockLinkProps>(({ to, children, ...rest }, ref) => {
      const href = typeof to === 'string' ? to : (to?.to ?? '#');
      return React.createElement('a', { ref, href, ...rest }, children);
    }),
  };
});

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

    headerLocationRef.pathname = '/dialog';
    headerLocationRef.searchStr = '';
    headerLocationRef.hash = '';

    render(
      <ThemeProvider theme={createTheme()}>
        <MultiStepDialogProvider value={contextValue}>
          <PluginDialogHeader title="Create Folder" mode="create" />
        </MultiStepDialogProvider>
      </ThemeProvider>
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
