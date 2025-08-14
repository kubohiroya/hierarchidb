import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { Button, Stack, TextField, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { AriaLiveRegion, announceToScreenReader } from './AriaLiveRegion';

const AriaLiveDemo: React.FC = () => {
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<'polite' | 'assertive'>('polite');

  const handleAnnounce = () => {
    if (message) {
      announceToScreenReader(message, mode);
      setMessage('');
    }
  };

  const quickAnnouncements = [
    'Form submitted successfully!',
    'Error: Please check your input',
    'Loading complete',
    'New notification received',
    'Settings saved',
  ];

  return (
    <Stack spacing={3} sx={{ maxWidth: 400 }}>
      <TextField
        label="Custom Message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Enter a message to announce"
        multiline
        rows={2}
      />

      <FormControl size="small">
        <InputLabel>Mode</InputLabel>
        <Select
          value={mode}
          label="Mode"
          onChange={(e) => setMode(e.target.value as 'polite' | 'assertive')}
        >
          <MenuItem value="polite">Polite (non-interrupting)</MenuItem>
          <MenuItem value="assertive">Assertive (interrupting)</MenuItem>
        </Select>
      </FormControl>

      <Button variant="contained" onClick={handleAnnounce} disabled={!message}>
        Announce Message
      </Button>

      <Stack spacing={1}>
        <strong>Quick Announcements:</strong>
        {quickAnnouncements.map((msg, index) => (
          <Button
            key={index}
            variant="outlined"
            size="small"
            onClick={() => announceToScreenReader(msg, mode)}
          >
            {msg}
          </Button>
        ))}
      </Stack>

      <AriaLiveRegion />
    </Stack>
  );
};

const meta = {
  title: 'Core/AriaLiveRegion',
  component: AriaLiveRegion,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A component that provides screen reader announcements using ARIA live regions. Use the demo below to test announcements.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof AriaLiveRegion>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <AriaLiveDemo />,
};

export const BasicUsage: Story = {
  render: () => (
    <Stack spacing={2}>
      <Button onClick={() => announceToScreenReader('Hello, screen reader users!')}>
        Announce Politely
      </Button>
      <Button onClick={() => announceToScreenReader('Important alert!', 'assertive')}>
        Announce Assertively
      </Button>
      <AriaLiveRegion />
    </Stack>
  ),
};
