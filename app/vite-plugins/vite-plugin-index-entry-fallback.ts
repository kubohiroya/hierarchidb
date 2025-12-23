import type { Plugin } from 'vite';

const hasModuleScript = (html: string): boolean =>
  /<script\s+[^>]*type=["']module["'][^>]*>/i.test(html);

export const indexEntryFallbackPlugin = (base: string): Plugin => {
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const entryPath = `${normalizedBase}assets/index.js`;
  return {
    name: 'hierarchidb:index-entry-fallback',
    apply: 'build',
    transformIndexHtml(html) {
      if (hasModuleScript(html)) {
        return html;
      }
      return {
        html,
        tags: [
          {
            tag: 'script',
            attrs: { type: 'module', src: entryPath },
            injectTo: 'body',
          },
        ],
      };
    },
  };
};
