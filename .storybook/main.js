import path from 'path';
import { fileURLToPath } from 'url';

/** @type {import('@storybook/react-vite').StorybookConfig} */
const config = {
  stories: ['../packages/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: ['@storybook/addon-links', '@storybook/addon-docs'],
  // Fix port to avoid interactive prompts when 6006 is taken in dev/smoke runs.
  port: 6006,
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  core: {
    disableTelemetry: true,
  },
  viteFinal: async (viteConfig) => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    return {
      ...viteConfig,
      resolve: {
        ...viteConfig.resolve,
        alias: {
          ...viteConfig.resolve?.alias,
          '@deck.gl/core': path.resolve(
            __dirname,
            '../packages/plugin-loader/linker-plugin/node_modules/@deck.gl/core',
          ),
          '@deck.gl/layers': path.resolve(
            __dirname,
            '../packages/plugin-loader/linker-plugin/node_modules/@deck.gl/layers',
          ),
          '@deck.gl/geo-layers': path.resolve(
            __dirname,
            '../packages/plugin-loader/linker-plugin/node_modules/@deck.gl/geo-layers',
          ),
          '@deck.gl/mapbox': path.resolve(
            __dirname,
            '../packages/plugin-loader/linker-plugin/node_modules/@deck.gl/mapbox',
          ),
        },
      },
    };
  },
};

export default config;
