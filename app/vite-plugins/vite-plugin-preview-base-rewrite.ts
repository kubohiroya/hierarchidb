import type { Plugin } from 'vite';

const normalizeBasePath = (base: string): string => {
  const trimmed = base.trim();
  if (!trimmed || trimmed === '/') return '';
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeading.endsWith('/') ? withLeading.slice(0, -1) : withLeading;
};

const rewritePreviewUrl = (url: string, basePath: string): string | null => {
  const [path, query = ''] = url.split('?', 2);
  if (path === basePath || path === `${basePath}/`) {
    return `/${query ? `?${query}` : ''}`;
  }
  if (path.startsWith(`${basePath}/`)) {
    const rest = path.slice(basePath.length) || '/';
    return `${rest}${query ? `?${query}` : ''}`;
  }
  return null;
};

export const previewBaseRewritePlugin = (base: string): Plugin => {
  const basePath = normalizeBasePath(base);
  return {
    name: 'hierarchidb:preview-base-rewrite',
    apply: 'preview',
    configurePreviewServer(server) {
      if (!basePath) return;
      server.middlewares.use((req, _res, next) => {
        const nextUrl = rewritePreviewUrl(req.url ?? '', basePath);
        if (nextUrl) {
          req.url = nextUrl;
        }
        next();
      });
    },
  };
};
