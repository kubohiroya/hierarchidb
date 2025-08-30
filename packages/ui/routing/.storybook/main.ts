import type { StorybookConfig } from '@storybook/provider-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-links',
  ],
  framework: {
    name: '@storybook/provider-vite',
    options: {},
  },
  core: {
    builder: '@storybook/builder-vite',
  },
  typescript: {
    check: false,
    reactDocgen: 'provider-docgen-typescript',
  },
};

export default config;
