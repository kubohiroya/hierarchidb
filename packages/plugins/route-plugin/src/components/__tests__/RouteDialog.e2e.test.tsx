import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RouteDialog } from '../RouteDialog.js';
import type { NodeId } from '@hierarchidb/common-types';

describe('RouteDialog (ui-dialog integration)', () => {
  it('completes the dialog flow and calls onClose', async () => {
    const onClose = vi.fn();

    render(
      <RouteDialog
        open={true}
        onClose={onClose}
        mode={'create'}
        parentId={'p1' as NodeId}
      />,
    );

    // Navigate through steps; initial data is empty so Next may be gated
    // but buttons exist for a11y; click through to simulate user flow after form filled
    const nextBtn = screen.getByLabelText('Next');
    fireEvent.click(nextBtn);
    fireEvent.click(nextBtn);

    // Complete should close the dialog (calls onClose internally)
    const completeBtn = screen.getByLabelText('Complete');
    fireEvent.click(completeBtn);

    expect(onClose).toHaveBeenCalled();
  });
});
