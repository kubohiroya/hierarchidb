/**
 * @file ResolverDialog.e2e.test.tsx
 * @description Integration test covering the headless multi-step dialog flow for ResolverDialog.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type React from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';

import type { NodeId } from '@hierarchidb/common-types';
import type { ResolverEntity } from '../../types/index.js';
import { ResolverDialog } from '../ResolverDialog.js';

const TestThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={createTheme()}>
    {children}
  </ThemeProvider>
);

describe.skip('ResolverDialog (ui-dialog integration)', () => {
  // TODO(hierarchidb): Re-enable once headless ResolverDialog E2E is stable under the proxy-based loader.
  it('walks through steps and saves when filled', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn();
    const onClose = vi.fn();

    const nodeId: NodeId = 'n1' as NodeId;
    const now = Date.now();
    const working: ResolverEntity = {
      id: nodeId,
      nodeId,
      name: 'resolver-1',
      description: 'Test resolver dialog',
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
      validationRules: [],
      duplicateResolution: { strategy: 'ignore' },
      dataTransformations: [],
      previewConfig: {
        sampleSize: 10,
        refreshInterval: 1000,
        highlightMappings: true,
        showValidationErrors: true,
      },
      isCompiled: false,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    render(
      <ResolverDialog
        open={true}
        nodeId={nodeId}
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
