import type { StorybookConfig } from '@storybook/react-vite';
import { join, dirname, resolve } from 'path';

/**
 * This function is used to resolve the absolute path of a package.
 * It is needed in projects that use Yarn PnP or are set up within a monorepo.
 */
function getAbsolutePath(value: string): any {
  return dirname(require.resolve(join(value, 'package.json')));
}

const config: StorybookConfig = {
  stories: ['../packages/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    getAbsolutePath('@storybook/addon-links'),
    getAbsolutePath('@storybook/addon-essentials'),
    getAbsolutePath('@storybook/addon-interactions'),
  ],
  framework: {
    name: getAbsolutePath('@storybook/react-vite'),
    options: {},
  },
  docs: {
    //autodocs: 'tag',
  },
  viteFinal: async (config) => {
    // カスタムVite設定をここに追加
    return {
      ...config,
      resolve: {
        ...config.resolve,
        alias: {
          ...config.resolve?.alias,
          '@deck.gl/core': resolve(__dirname, '../packages/node-type/linker-plugin/node_modules/@deck.gl/core'),
          '@deck.gl/layers': resolve(__dirname, '../packages/node-type/linker-plugin/node_modules/@deck.gl/layers'),
          '@deck.gl/geo-layers': resolve(__dirname, '../packages/node-type/linker-plugin/node_modules/@deck.gl/geo-layers'),
          '@deck.gl/mapbox': resolve(__dirname, '../packages/node-type/linker-plugin/node_modules/@deck.gl/mapbox'),
        },
      },
    };
  },
};

export default config;
