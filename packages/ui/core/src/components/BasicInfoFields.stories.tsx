import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { Box } from '@mui/material';
import { BasicInfoFields } from './BasicInfoFields';

const meta: Meta<typeof BasicInfoFields> = {
  title: 'UI Core/Forms/BasicInfoFields',
  component: BasicInfoFields,
};

export default meta;

type Story = StoryObj<typeof BasicInfoFields>;

export const Playground: Story = {
  render: () => {
    const [value, setValue] = useState({ name: '', description: '' });
    return (
      <Box sx={{ p: 3, maxWidth: 600 }}>
        <BasicInfoFields value={value} onChange={(u) => setValue({ ...value, ...u })} />
      </Box>
    );
  },
};

export const WithLabels: Story = {
  render: () => {
    const [value, setValue] = useState({ name: '', description: '' });
    return (
      <Box sx={{ p: 3, maxWidth: 600 }}>
        <BasicInfoFields
          value={value}
          onChange={(u) => setValue({ ...value, ...u })}
          title="Basic Information"
          subtitle="Enter a name and optional description."
          nameLabel="Resource Name"
          descriptionLabel="Details"
        />
      </Box>
    );
  },
};

