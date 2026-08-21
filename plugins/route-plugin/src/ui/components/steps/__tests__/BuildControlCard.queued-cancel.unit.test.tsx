// @vitest-environment jsdom

import { BuildControlCard } from '@hierarchidb/ui-build-progress';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@hierarchidb/ui-i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('BuildControlCard queued cancellation', () => {
  it('shows the canonical cancel action while a build is queued', () => {
    const onCancel = vi.fn();
    render(
      <BuildControlCard
        status="idle"
        startPending
        onResume={vi.fn()}
        onCancel={onCancel}
        cancelLabel="Cancel queued build"
      />
    );

    const cancelButton = screen.getByRole('button', { name: 'Cancel queued build' });
    expect(cancelButton).toBeEnabled();
    fireEvent.click(cancelButton);
    expect(onCancel).toHaveBeenCalledOnce();
    expect(screen.queryByTestId('build-control-pause-button')).not.toBeInTheDocument();
  });
});
