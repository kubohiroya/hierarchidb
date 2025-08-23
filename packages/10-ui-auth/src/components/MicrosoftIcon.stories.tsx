import type { Meta, StoryObj } from '@storybook/react';
import { MicrosoftIcon } from './MicrosoftIcon';

const meta = {
  title: 'Auth/MicrosoftIcon',
  component: MicrosoftIcon,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: { type: 'number', min: 16, max: 128, step: 4 },
      description: 'Icon size in pixels',
    },
    color: {
      control: 'color',
      description: 'Icon color',
    },
  },
} satisfies Meta<typeof MicrosoftIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    size: 24,
  },
};

export const Small: Story = {
  args: {
    size: 16,
  },
};

export const Medium: Story = {
  args: {
    size: 32,
  },
};

export const Large: Story = {
  args: {
    size: 64,
  },
};

export const CustomColor: Story = {
  args: {
    size: 32,
    color: '#0078d4',
  },
};

export const InButtonContext: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
      <button style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}>
        <MicrosoftIcon size={20} />
        Sign in with Microsoft
      </button>
      <button
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 24px',
          fontSize: '18px',
        }}
      >
        <MicrosoftIcon size={24} />
        Microsoft Login
      </button>
    </div>
  ),
};
