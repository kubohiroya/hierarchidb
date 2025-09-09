import { loadEnv } from 'vite';
import { dirname } from 'path';
import * as path from 'node:path';

//const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

//  NODE_ENVdevelopment
const mode = process.env.NODE_ENV || 'development';

//  .env.*
//  2packages/app
const env = loadEnv(mode, __dirname, '');

//  VITE_APP_NAMEvite.config.ts
const appName = env.VITE_APP_NAME || '';

//  basename
//  React Router'/'
//  basenameReact Router
const basename = appName ? `/${appName}/` : '/';

//  Hash routingbuildEnd
//  true
const useHashRouting = env.VITE_USE_HASH_ROUTING !== 'false';

// React Router config type
interface ReactRouterConfig {
  appDirectory: string;
  prerender: boolean;
  ssr: boolean;
  basename: string;
  buildEnd?: (args: { viteConfig: any }) => Promise<void>;
}

/*
  buildEnd?: (args: { viteConfig: any }) => Promise<void>;
async buildEnd(args): Promise<void> {
  if (!args.viteConfig.isProduction) return;
const buildPath = args.viteConfig.build.outDir;
await copyFile(path.join(buildPath, 'index.html'), path.join(buildPath, '404.html'));
},
 */

const config: ReactRouterConfig = {
  appDirectory: 'src',
  prerender: false,
  ssr: false, //  SSR
  basename,
  async buildEnd(args): Promise<void> {
    if (!args.viteConfig.isProduction) return;
    const buildPath = args.viteConfig.build.outDir;

    //  Hash routing404.html
    if (useHashRouting) {
      console.log('Hash routing enabled - skipping 404.html generation');
      return;
    }

    //  GitHub Pages404.htmlSPA
    const notFoundHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>HierarchiDB</title>
    <script type="text/javascript">
      // GitHub Pages用のSPA対応スクリプト
      // 404ページから正しいパスにリダイレクト
      var pathSegmentsToKeep = 1; // hierarchidbという1つのセグメントを保持

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

    const fs = await import('node:fs/promises');
    await fs.writeFile(path.join(buildPath, '404.html'), notFoundHtml);
  },
};

export default config;
