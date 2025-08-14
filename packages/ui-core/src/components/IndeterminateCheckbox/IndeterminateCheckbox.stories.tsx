import type { Meta, StoryObj } from '@storybook/react';
import { IndeterminateCheckbox } from './IndeterminateCheckbox';
import { useState } from 'react';

const meta = {
  title: 'Core/IndeterminateCheckbox',
  component: IndeterminateCheckbox,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    checked: {
      control: 'boolean',
      description: 'Whether the checkbox is checked',
    },
    indeterminate: {
      control: 'boolean',
      description: 'Whether the checkbox is in indeterminate state',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the checkbox is disabled',
    },
    label: {
      control: 'text',
      description: 'Label for the checkbox',
    },
    size: {
      control: 'select',
      options: ['small', 'medium', 'large'],
      description: 'Size of the checkbox',
    },
  },
} satisfies Meta<typeof IndeterminateCheckbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: 'Default Checkbox',
  },
};

export const Checked: Story = {
  args: {
    checked: true,
    label: 'Checked Checkbox',
  },
};

export const Indeterminate: Story = {
  args: {
    indeterminate: true,
    label: 'Indeterminate Checkbox',
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    label: 'Disabled Checkbox',
  },
};

export const DisabledChecked: Story = {
  args: {
    checked: true,
    disabled: true,
    label: 'Disabled Checked',
  },
};

export const SmallSize: Story = {
  args: {
    size: 'small',
    label: 'Small Checkbox',
  },
};

export const LargeSize: Story = {
  args: {
    size: 'large',
    label: 'Large Checkbox',
  },
};

export const Interactive: Story = {
  render: () => {
    const [checked, setChecked] = useState(false);
    const [indeterminate, setIndeterminate] = useState(false);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <IndeterminateCheckbox
          checked={checked}
          indeterminate={indeterminate}
          onChange={(e) => {
            setChecked(e.target.checked);
            setIndeterminate(false);
          }}
          label="Interactive Checkbox"
        />
        <button onClick={() => setIndeterminate(!indeterminate)}>Toggle Indeterminate</button>
      </div>
    );
  },
};
