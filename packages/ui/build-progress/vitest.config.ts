import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@hierarchidb/components': new URL('../../components/src/index.ts', import.meta.url).pathname,
      '@hierarchidb/ui-dialog': new URL('../dialog/src/index.ts', import.meta.url).pathname,
      '@hierarchidb/ui-i18n': new URL('../i18n/src/index.ts', import.meta.url).pathname,
      '@hierarchidb/ui-lru-splitview': new URL('../lru-splitview/src/index.ts', import.meta.url)
        .pathname,
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
