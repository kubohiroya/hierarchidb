import { loadEnv } from 'vite';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';
import type { Config } from '@react-router/dev/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mode = process.env.NODE_ENV ?? 'development';
const env = loadEnv(mode, __dirname, '');

const appName = env.VITE_APP_NAME || '';
const basename = appName ? `/${appName}/` : '/';
const useHashRouting = env.VITE_USE_HASH_ROUTING !== 'false';

const config: Config = {
  appDirectory: 'src',
  prerender: false,
  ssr: false,
  basename,
  async buildEnd(args) {
    if (!args.viteConfig.isProduction) return;
    const buildPath = args.viteConfig.build.outDir;

    if (useHashRouting) {
      console.log('Hash routing enabled - skipping 404.html generation');
      return;
    }

    const notFoundHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>HierarchiDB</title>
    <script type="text/javascript">
      var pathSegmentsToKeep = 1;
      var l = window.location;
      l.replace(
        l.protocol + '//' + l.hostname + (l.port ? ':' + l.port : '') +
        l.pathname.split('/').slice(0, 1 + pathSegmentsToKeep).join('/') + '/?/' +
        l.pathname.slice(1).split('/').slice(pathSegmentsToKeep).join('/').replace(/&/g, '~and~') +
        (l.search ? '&' + l.search.slice(1).replace(/&/g, '~and~') : '') +
        l.hash
      );
    </script>
  </head>
  <body>
  </body>
</html>`;

    await fs.writeFile(join(buildPath, '404.html'), notFoundHtml);
  },
};

export default config;
