import type { Meta, StoryObj } from '@storybook/react';
import { Stack, Paper, Box } from '@mui/material';
import { LanguageProvider } from '../provider/LanguageProvider';
import { LanguageSelector } from './LanguageSelector';

const meta = {
  title: 'I18n/LanguageSelector',
  component: LanguageSelector,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <LanguageProvider>
        <Paper sx={{ p: 3, minWidth: 200 }}>
          <Story />
        </Paper>
      </LanguageProvider>
    ),
  ],
  argTypes: {
    variant: {
      control: 'select',
      options: ['dropdown', 'buttons', 'compact'],
    },
    size: {
      control: 'select',
      options: ['small', 'medium'],
    },
    showFlags: {
      control: 'boolean',
    },
    showNativeNames: {
      control: 'boolean',
    },
    disabled: {
      control: 'boolean',
    },
    label: {
      control: 'text',
    },
  },
} satisfies Meta<typeof LanguageSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    variant: 'dropdown',
    showFlags: true,
    showNativeNames: true,
    label: 'Language',
    size: 'medium',
  },
};

export const WithoutFlags: Story = {
  args: {
    ...Default.args,
    showFlags: false,
  },
};

export const EnglishNames: Story = {
  args: {
    ...Default.args,
    showNativeNames: false,
  },
};

export const Small: Story = {
  args: {
    ...Default.args,
    size: 'small',
  },
};

export const Disabled: Story = {
  args: {
    ...Default.args,
    disabled: true,
  },
};

export const CustomLabel: Story = {
  args: {
    ...Default.args,
    label: '言語 / Language',
  },
};

// Multiple instances to show different configurations
export const Comparison: Story = {
  render: () => (
    <LanguageProvider>
      <Stack spacing={3} sx={{ minWidth: 300 }}>
        <Box>
          <h3>Default</h3>
          <LanguageSelector />
        </Box>

        <Box>
          <h3>Small, No Flags</h3>
          <LanguageSelector size="small" showFlags={false} />
        </Box>

        <Box>
          <h3>English Names Only</h3>
          <LanguageSelector showNativeNames={false} />
        </Box>
      </Stack>
    </LanguageProvider>
  ),
};
