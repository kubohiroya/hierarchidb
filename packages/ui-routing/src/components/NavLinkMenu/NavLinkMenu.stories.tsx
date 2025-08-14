import type { Meta, StoryObj } from '@storybook/react';
import { NavLinkMenu } from './NavLinkMenu';

const meta = {
  title: 'Routing/NavLinkMenu',
  component: NavLinkMenu,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    items: {
      control: 'object',
      description: 'Navigation menu items',
    },
  },
} satisfies Meta<typeof NavLinkMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleMenuItems = [
  {
    name: 'Dashboard',
    url: '/dashboard',
    icon: '📊',
  },
  {
    name: 'Projects',
    url: '/projects',
    icon: '📁',
  },
  {
    name: 'Settings',
    url: '/settings',
    icon: '⚙️',
  },
  {
    name: 'Profile',
    url: '/profile',
    icon: '👤',
  },
];

export const HorizontalTabs: Story = {
  args: {
    items: sampleMenuItems,
  },
};

export const VerticalPills: Story = {
  args: {
    items: sampleMenuItems,
  },
  decorators: [
    (Story) => (
      <div style={{ height: '300px', width: '200px' }}>
        <Story />
      </div>
    ),
  ],
};

export const TextLinks: Story = {
  args: {
    items: sampleMenuItems,
  },
};

export const WithSubItems: Story = {
  args: {
    items: [
      {
        name: 'Dashboard',
        url: '/dashboard',
        icon: '📊',
      },
      {
        name: 'Projects',
        url: '/projects',
        icon: '📁',
      },
      {
        name: 'Settings',
        url: '/settings',
        icon: '⚙️',
      },
    ],
  },
  decorators: [
    (Story) => (
      <div style={{ height: '400px', width: '250px' }}>
        <Story />
      </div>
    ),
  ],
};
