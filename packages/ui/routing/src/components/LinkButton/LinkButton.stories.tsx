import type { Meta, StoryObj } from '@storybook/react';
import { LinkButton } from './LinkButton';

const meta = {
  title: 'Routing/LinkButton',
  component: LinkButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    href: {
      control: 'text',
      description: 'External URL or internal route',
    },
    isExternal: {
      control: 'boolean',
      description: 'Whether the link is external',
    },
    variant: {
      control: 'select',
      options: ['contained', 'outlined', 'text'],
    },
    color: {
      control: 'select',
      options: ['primary', 'secondary', 'error', 'warning', 'info', 'success'],
    },
    disabled: {
      control: 'boolean',
    },
    showSpinner: {
      control: 'boolean',
      description: 'Show loading spinner',
    },
  },
} satisfies Meta<typeof LinkButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InternalLink: Story = {
  args: {
    href: '/dashboard',
    children: 'Go to Dashboard',
    variant: 'contained',
    color: 'primary',
    isExternal: false,
  },
};

export const ExternalLink: Story = {
  args: {
    href: 'https://example.com',
    children: 'Visit External Site',
    variant: 'outlined',
    color: 'primary',
    isExternal: true,
  },
};

export const WithConfirmDialog: Story = {
  args: {
    href: '/dangerous-action',
    children: 'Dangerous Action',
    variant: 'contained',
    color: 'error',
    confirmDialog: {
      enabled: true,
      title: 'Confirm Action',
      message: 'Are you sure you want to perform this action?',
      confirmText: 'Yes, Continue',
      cancelText: 'Cancel',
    },
  },
};

export const Loading: Story = {
  args: {
    href: '/loading-page',
    children: 'Loading Button',
    variant: 'contained',
    color: 'primary',
    showSpinner: true,
  },
};

export const Disabled: Story = {
  args: {
    href: '/disabled-link',
    children: 'Disabled Link',
    variant: 'contained',
    disabled: true,
  },
};

export const TextVariant: Story = {
  args: {
    href: '/text-link',
    children: 'Text Link',
    variant: 'text',
    color: 'primary',
  },
};
