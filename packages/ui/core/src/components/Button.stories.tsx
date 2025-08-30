import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '@mui/material';

const meta = {
  title: 'UI Core/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['contained', 'outlined', 'text'],
    },
    color: {
      control: 'select',
      options: ['primary', 'secondary', 'success', 'error', 'info', 'warning'],
    },
    size: {
      control: 'select',
      options: ['small', 'medium', 'large'],
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    variant: 'contained',
    children: 'Primary Button',
    color: 'primary',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'contained',
    children: 'Secondary Button',
    color: 'secondary',
  },
};

export const Outlined: Story = {
  args: {
    variant: 'outlined',
    children: 'Outlined Button',
  },
};

export const Text: Story = {
  args: {
    variant: 'text',
    children: 'Text Button',
  },
};

export const Small: Story = {
  args: {
    size: 'small',
    variant: 'contained',
    children: 'Small Button',
  },
};

export const Large: Story = {
  args: {
    size: 'large',
    variant: 'contained',
    children: 'Large Button',
  },
};