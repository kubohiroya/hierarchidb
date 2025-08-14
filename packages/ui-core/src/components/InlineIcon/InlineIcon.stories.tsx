import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Stack, Typography, Button } from '@mui/material';
import { InlineIcon } from './InlineIcon';
import FavoriteIcon from '@mui/icons-material/Favorite';
import StarIcon from '@mui/icons-material/Star';
import HomeIcon from '@mui/icons-material/Home';
import SettingsIcon from '@mui/icons-material/Settings';

const meta = {
  title: 'Core/InlineIcon',
  component: InlineIcon,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['inherit', 'small', 'medium', 'large'],
    },
    color: {
      control: 'select',
      options: ['inherit', 'primary', 'secondary', 'action', 'error', 'warning', 'info', 'success'],
    },
    verticalAlign: {
      control: 'select',
      options: ['baseline', 'top', 'middle', 'bottom', 'text-top', 'text-bottom'],
    },
  },
} satisfies Meta<typeof InlineIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: <FavoriteIcon />,
  },
  render: (args) => (
    <Typography variant="body1">
      I love <InlineIcon {...args} /> React components!
    </Typography>
  ),
};

export const DifferentSizes: Story = {
  render: () => (
    <Stack spacing={2}>
      <Typography variant="h6">
        Small{' '}
        <InlineIcon size="small">
          <StarIcon />
        </InlineIcon>{' '}
        icon
      </Typography>
      <Typography variant="h6">
        Medium{' '}
        <InlineIcon size="medium">
          <StarIcon />
        </InlineIcon>{' '}
        icon
      </Typography>
      <Typography variant="h6">
        Large{' '}
        <InlineIcon size="large">
          <StarIcon />
        </InlineIcon>{' '}
        icon
      </Typography>
      <Typography variant="h6">
        Inherit{' '}
        <InlineIcon size="inherit">
          <StarIcon />
        </InlineIcon>{' '}
        icon
      </Typography>
    </Stack>
  ),
};

export const DifferentColors: Story = {
  render: () => (
    <Stack spacing={1}>
      <Typography>
        Primary:{' '}
        <InlineIcon color="primary">
          <HomeIcon />
        </InlineIcon>
      </Typography>
      <Typography>
        Secondary:{' '}
        <InlineIcon color="secondary">
          <HomeIcon />
        </InlineIcon>
      </Typography>
      <Typography>
        Error:{' '}
        <InlineIcon color="error">
          <HomeIcon />
        </InlineIcon>
      </Typography>
      <Typography>
        Warning:{' '}
        <InlineIcon color="warning">
          <HomeIcon />
        </InlineIcon>
      </Typography>
      <Typography>
        Success:{' '}
        <InlineIcon color="success">
          <HomeIcon />
        </InlineIcon>
      </Typography>
    </Stack>
  ),
};

export const VerticalAlignment: Story = {
  render: () => (
    <Stack spacing={2}>
      <Typography variant="h5">
        Baseline:{' '}
        <InlineIcon verticalAlign="baseline">
          <SettingsIcon />
        </InlineIcon>{' '}
        alignment
      </Typography>
      <Typography variant="h5">
        Middle:{' '}
        <InlineIcon verticalAlign="middle">
          <SettingsIcon />
        </InlineIcon>{' '}
        alignment
      </Typography>
      <Typography variant="h5">
        Top:{' '}
        <InlineIcon verticalAlign="top">
          <SettingsIcon />
        </InlineIcon>{' '}
        alignment
      </Typography>
      <Typography variant="h5">
        Bottom:{' '}
        <InlineIcon verticalAlign="bottom">
          <SettingsIcon />
        </InlineIcon>{' '}
        alignment
      </Typography>
    </Stack>
  ),
};

export const InButtons: Story = {
  render: () => (
    <Stack direction="row" spacing={2}>
      <Button variant="contained">
        <InlineIcon>
          <HomeIcon />
        </InlineIcon>
        Home
      </Button>
      <Button variant="outlined">
        <InlineIcon color="primary">
          <StarIcon />
        </InlineIcon>
        Favorite
      </Button>
      <Button variant="text">
        Settings
        <InlineIcon>
          <SettingsIcon />
        </InlineIcon>
      </Button>
    </Stack>
  ),
};

export const InText: Story = {
  render: () => (
    <Stack spacing={2}>
      <Typography variant="body1">
        Click the{' '}
        <InlineIcon>
          <HomeIcon />
        </InlineIcon>{' '}
        home button to navigate back.
      </Typography>
      <Typography variant="body1">
        Your{' '}
        <InlineIcon color="error">
          <FavoriteIcon />
        </InlineIcon>{' '}
        favorite items are saved automatically.
      </Typography>
      <Typography variant="body1">
        Adjust{' '}
        <InlineIcon color="action">
          <SettingsIcon />
        </InlineIcon>{' '}
        settings in the control panel.
      </Typography>
    </Stack>
  ),
};
