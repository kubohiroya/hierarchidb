declare module './packages/tools/vite-plugin-node-type-registry/src/alias' {
  import type { Alias } from 'vite';
  import type {
    AliasEntry,
    CreateAliasPluginOptions,
    PluginEntryKind,
  } from './packages/tools/vite-plugin-node-type-registry/src/types.js';

  export function collectAliasEntries(rootDir: string, kinds?: PluginEntryKind[]): AliasEntry[];

  export function createNodeTypeAliasPlugin(options?: CreateAliasPluginOptions): {
    name: string;
    enforce: 'pre';
    config(config: { resolve?: { alias?: Alias[] | Record<string, string> } }):
      | { resolve: { alias: Alias[] } }
      | void;
  };
}
