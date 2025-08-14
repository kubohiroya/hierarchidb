import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { Stack } from '@mui/material';
import { SelectField } from './SelectField';

const meta = {
  title: 'Core/SelectField',
  component: SelectField,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['outlined', 'filled', 'standard'],
    },
    size: {
      control: 'select',
      options: ['small', 'medium'],
    },
    multiple: {
      control: 'boolean',
    },
    disabled: {
      control: 'boolean',
    },
    required: {
      control: 'boolean',
    },
    error: {
      control: 'boolean',
    },
  },
} satisfies Meta<typeof SelectField>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleOptions = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
  { value: 'date', label: 'Date' },
  { value: 'elderberry', label: 'Elderberry' },
];

const sampleCountries = [
  { value: 'us', label: '🇺🇸 United States' },
  { value: 'jp', label: '🇯🇵 Japan' },
  { value: 'uk', label: '🇬🇧 United Kingdom' },
  { value: 'de', label: '🇩🇪 Germany' },
  { value: 'fr', label: '🇫🇷 France' },
];

export const Default: Story = {
  args: {
    label: 'Choose a fruit',
    options: sampleOptions,
    placeholder: 'Select a fruit...',
  },
};

export const WithDefaultValue: Story = {
  args: {
    label: 'Favorite Fruit',
    options: sampleOptions,
    defaultValue: 'banana',
  },
};

export const Multiple: Story = {
  args: {
    label: 'Select Multiple Fruits',
    options: sampleOptions,
    multiple: true,
    defaultValue: ['apple', 'cherry'],
  },
};

export const Required: Story = {
  args: {
    label: 'Required Field',
    options: sampleOptions,
    required: true,
    helperText: 'This field is required',
  },
};

export const WithError: Story = {
  args: {
    label: 'Field with Error',
    options: sampleOptions,
    error: true,
    helperText: 'Please select a valid option',
  },
};

export const Disabled: Story = {
  args: {
    label: 'Disabled Field',
    options: sampleOptions,
    disabled: true,
    defaultValue: 'apple',
  },
};

export const SmallSize: Story = {
  args: {
    label: 'Small Select',
    options: sampleOptions,
    size: 'small',
  },
};

export const FilledVariant: Story = {
  args: {
    label: 'Filled Variant',
    options: sampleOptions,
    variant: 'filled',
  },
};

export const StandardVariant: Story = {
  args: {
    label: 'Standard Variant',
    options: sampleOptions,
    variant: 'standard',
  },
};

export const WithIcons: Story = {
  args: {
    label: 'Select Country',
    options: sampleCountries,
    helperText: 'Choose your country',
  },
};

export const Interactive: Story = {
  render: () => {
    const [value, setValue] = useState<string>('');
    const [multiValue, setMultiValue] = useState<string[]>([]);

    return (
      <Stack spacing={3} sx={{ minWidth: 300 }}>
        <SelectField
          label="Single Select"
          options={sampleOptions}
          value={value}
          onChange={(newValue) => setValue(newValue as string)}
          helperText={`Selected: ${value || 'None'}`}
        />

        <SelectField
          label="Multiple Select"
          options={sampleOptions}
          multiple
          value={multiValue}
          onChange={(newValue) => setMultiValue(newValue as string[])}
          helperText={`Selected: ${multiValue.length} items`}
        />
      </Stack>
    );
  },
};
