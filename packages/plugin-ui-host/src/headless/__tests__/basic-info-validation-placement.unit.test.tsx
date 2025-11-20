import { render, screen } from '@testing-library/react';
import React from 'react';
import { BasicInfoStep } from '@hierarchidb/ui-plugin-basic-info';

describe('BasicInfoStep validation placement', () => {
  it('shows name conflict helper directly under the Name field', () => {
    render(
      <BasicInfoStep
        name="New Folder"
        description=""
        tags={[]}
        mode="create"
        onChange={() => {}}
        validate={() => 'A node with this name already exists in this folder'}
      />
    );

    const nameField = screen.getByLabelText(/Name/i);
    const helper =
      nameField.closest('.MuiFormControl-root')?.querySelector('.MuiFormHelperText-root');

    expect(helper?.textContent).toContain(
      'A node with this name already exists in this folder'
    );
  });
});
