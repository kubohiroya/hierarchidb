import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ShapeBuildProgressPanelLegacySessionRecoveryDialogView } from '../../../components/build-progress/ShapeBuildProgressPanel/ShapeBuildProgressPanelLegacySessionRecoveryDialogView';

const recovery = {
  code: 'LEGACY_BUILD_STAGE_INACTIVE_MS_MISSING' as const,
  recoverable: true as const,
  nodeId: 'node-1',
  table: 'buildStageStatuses' as const,
  field: 'inactiveMs' as const,
  fieldPath: 'buildStageStatuses.inactiveMs' as const,
  stageStatusId: 'node-1:source',
  stage: 'source' as const,
  received: 'undefined' as const,
  message: 'inactiveMs is missing',
};

const t = (_key: string, fallback?: string) => fallback ?? _key;

describe('ShapeBuildProgressPanelLegacySessionRecoveryDialogView', () => {
  it('cancels without invoking the recovery command', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn(async () => {});
    render(
      <ShapeBuildProgressPanelLegacySessionRecoveryDialogView
        open
        pending={false}
        error={recovery}
        failureMessage={null}
        onCancel={onCancel}
        onConfirm={onConfirm}
        t={t}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('requires the explicit confirm action and disables both actions while pending', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn(async () => {});
    const { rerender } = render(
      <ShapeBuildProgressPanelLegacySessionRecoveryDialogView
        open
        pending={false}
        error={recovery}
        failureMessage={null}
        onCancel={onCancel}
        onConfirm={onConfirm}
        t={t}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Recover session' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();

    rerender(
      <ShapeBuildProgressPanelLegacySessionRecoveryDialogView
        open
        pending
        error={recovery}
        failureMessage={null}
        onCancel={onCancel}
        onConfirm={onConfirm}
        t={t}
      />
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Recovering...' })).toBeDisabled();
  });
});
