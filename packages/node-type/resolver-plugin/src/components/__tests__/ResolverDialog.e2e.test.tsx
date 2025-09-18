/**
 * @file ResolverDialog.e2e.test.tsx
 * @description Integration test covering the headless multi-step dialog flow for ResolverDialog.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';

import { ResolverDialog } from '../ResolverDialog.js';

const TestThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={createTheme()}>
    {children}
  </ThemeProvider>
);

describe('ResolverDialog (ui-dialog integration)', () => {
  it('walks through steps and saves when filled', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn();
    const onClose = vi.fn();

    const working: any = {
      name: 'resolver-1',
      sourceSchema: JSON.stringify([{ id: 1, value: 'foo' }]),
      targetSchema: JSON.stringify([{ identifier: 1, transformed: 'foo' }]),
      mappingRules: [
        {
          id: 'rule-1',
          sourceProperty: 'value',
          targetProperty: 'transformed',
          transformFunction: 'uppercase',
          isRequired: false,
          description: 'Map value to transformed',
        },
      ],
      duplicateResolution: { strategy: 'ignore' },
      previewConfig: { sampleSize: 10 },
    };

    render(
      <ResolverDialog
        open={true}
        nodeId={'n1' as any}
        onClose={onClose}
        onSave={onSave}
        onCancel={onCancel}
        entity={working}
      />,
      { wrapper: TestThemeProvider },
    );

    for (let index = 0; index < 5; index += 1) {
      fireEvent.click(screen.getByLabelText('Next'));
    }

    fireEvent.click(screen.getByLabelText('Complete'));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'resolver-1',
        duplicateResolution: { strategy: 'ignore' },
      }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });
});
