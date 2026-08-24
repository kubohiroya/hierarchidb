import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BasicInfoStep } from './BasicInfoStep.js';

describe('BasicInfoStep field edit locks', () => {
  it('disables only the locked metadata field and shows its reason', () => {
    render(
      <BasicInfoStep
        name="Locked name"
        description="Editable description"
        tags={[]}
        mode="edit"
        onChange={() => {}}
        fieldEditLocks={{
          name: {
            locked: true,
            reason: 'Build session is running',
          },
        }}
      />
    );

    expect(screen.getByLabelText(/Name/i)).toBeDisabled();
    expect(screen.getByLabelText(/Description/i)).toBeEnabled();
    expect(screen.getByText('Build session is running')).toBeInTheDocument();
  });

  it('prevents locked tag suggestion changes', () => {
    const onChange = vi.fn();
    render(
      <BasicInfoStep
        name="Node"
        description=""
        tags={[]}
        tagSuggestions={['alpha']}
        mode="edit"
        onChange={onChange}
        fieldEditLocks={{
          tags: {
            locked: true,
            reason: 'Tags are locked by an active build session',
          },
        }}
      />
    );

    expect(screen.getByRole('textbox', { name: /Tags/i })).toBeDisabled();
    expect(screen.getByText('Tags are locked by an active build session')).toBeInTheDocument();
    fireEvent.click(screen.getByText('+ alpha'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
