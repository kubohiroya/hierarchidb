import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BasicInfoFields } from './BasicInfoFields.js';

describe('BasicInfoFields', () => {
  it('renders name and description with defaults', () => {
    const onChange = vi.fn();
    render(
      <BasicInfoFields
        value={{ name: '', description: '' }}
        onChange={onChange}
      />,
    );

    // Default labels
    expect(screen.getByLabelText(/Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/)).toBeInTheDocument();
  });

  it('shows required helper text when name is empty', () => {
    const onChange = vi.fn();
    render(
      <BasicInfoFields
        value={{ name: '', description: '' }}
        onChange={onChange}
      />,
    );

    expect(screen.getByText('Name is required')).toBeInTheDocument();
  });

  it('calls onChange when typing', () => {
    const onChange = vi.fn();
    render(
      <BasicInfoFields
        value={{ name: '', description: '' }}
        onChange={onChange}
      />,
    );

    const nameInput = screen.getByLabelText(/Name/) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'My Name' } });
    expect(onChange).toHaveBeenCalledWith({ name: 'My Name' });

    const descInput = screen.getByLabelText(/Description/) as HTMLInputElement;
    fireEvent.change(descInput, { target: { value: 'Desc' } });
    expect(onChange).toHaveBeenCalledWith({ description: 'Desc' });
  });
});
