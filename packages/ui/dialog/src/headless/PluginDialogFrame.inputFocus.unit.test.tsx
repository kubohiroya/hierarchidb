import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { PluginDialogFrame } from './PluginDialogFrame.js';
import type { HeadlessDialogProps } from './types.js';

describe('PluginDialogFrame input focus', () => {
  it('keeps input focusable by click inside dialog content', async () => {
    const StepComponent = () => (
      <input aria-label="dialog-input" name="dialog-input" />
    );

    const headlessProps: HeadlessDialogProps<Record<string, unknown>> = {
      open: true,
      stepComponents: [
        {
          id: 'step-1',
          label: 'Step 1',
          component: StepComponent,
        },
      ],
      stepData: {},
      onStepDataChange: () => {},
      activeStepIndex: 0,
      enabledStepIndices: [0],
      validatedStepIndices: [0],
      committableStepIndices: [0],
      invalidMessageMap: {},
      isDirty: false,
      onStepNavigate: () => {},
      onRequestClose: () => {},
      onRequestCommit: () => {},
    };

    render(createElement(PluginDialogFrame<Record<string, unknown>>, {
      headlessProps,
      disablePortal: true,
    }));

    const input = screen.getByLabelText('dialog-input') as HTMLInputElement;
    const user = userEvent.setup();
    await user.click(input);

    expect(document.activeElement).toBe(input);
  });
});
