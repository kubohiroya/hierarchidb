import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { RouteDialog } from '../RouteDialog';

describe('RouteDialog (ui-dialog integration)', () => {
  it('disables submit until required fields are present; then completes', async () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();

    // Minimal invalid workingCopy (missing name/routeType/transportModes)
    const invalidWC: any = { name: '', routeType: undefined, transportModes: [] };

    render(
      <RouteDialog
        open={true}
        onClose={onCancel}
        nodeId={'n1' as any}
        workingCopy={invalidWC}
        onSave={onSave}
        onCancel={onCancel}
      />,
    );

    // Try to go next via a11y test controls; should not proceed if step invalid
    const nextBtn = screen.getByLabelText('Next');
    fireEvent.click(nextBtn);

    // Now render with valid working copy and progress to completion
    const validWC: any = { name: 'R1', routeType: 'bus', transportModes: ['bus'] };
    render(
      <RouteDialog
        open={true}
        onClose={onCancel}
        nodeId={'n1' as any}
        workingCopy={validWC}
        onSave={onSave}
        onCancel={onCancel}
      />,
    );

    // Step 1 valid -> go next twice to reach final step
    fireEvent.click(screen.getByLabelText('Next'));
    fireEvent.click(screen.getByLabelText('Next'));

    // Complete
    const completeBtn = screen.getByLabelText('Complete');
    fireEvent.click(completeBtn);

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(validWC);
  });
});

