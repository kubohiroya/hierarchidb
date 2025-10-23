/**
 * Script: fix-spa-build
 * Purpose: Post-process the Vite SPA build so GitHub Pages deployments behave correctly.
 * Invocation: run via `pnpm --filter @hierarchidb/tools run fix-spa-build` after `pnpm -C app build`.
 * Output: Writes `.nojekyll`, updates `dist/index.html`, and maintains `dist/404.html` in `app/dist`.
 */
import { access, readFile, unlink, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(toolsDir, '..', '..');
const appDir = path.join(repoRoot, 'app');
const distDir = path.join(appDir, 'dist');
const indexPath = path.join(distDir, 'index.html');
const nojekyllPath = path.join(distDir, '.nojekyll');
const notFoundPath = path.join(distDir, '404.html');

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function injectHashRouting(html: string, basePath: string): string {
  if (html.includes('hash-routing handler for GitHub Pages')) {
    return html;
  }

  const script = `    <script type="text/javascript">
      // Hash routing handler for GitHub Pages
      (function() {
        if (typeof window === 'undefined') return;
        if (sessionStorage.getItem('hash-routing-processed')) {
          return;
        }

        var path = window.location.pathname;
        var base = '${basePath}';

        if (path !== base + '/' && path.startsWith(base + '/') && !window.location.hash) {
          sessionStorage.setItem('hash-routing-processed', 'true');
          var hashPath = path.substring(base.length);
          window.location.replace(base + '/#' + hashPath + window.location.search);
        } else if (path === base + '/') {
          sessionStorage.setItem('hash-routing-processed', 'true');
        }
      })();
    </script>`;

  if (!html.includes('</head>')) {
    console.warn('[fix-spa-build] </head> not found; prepending hash routing snippet.');
    return `${script}\n${html}`;
  }

  return html.replace('</head>', `${script}\n</head>`);
}

function createNotFoundHtml(basePath: string): string {
  const segmentsToKeep = basePath === '' ? 0 : 1;
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>HierarchiDB</title>
    <script type="text/javascript">
      var pathSegmentsToKeep = ${segmentsToKeep};
      var l = window.location;
      l.replace(
        l.protocol + '//' + l.hostname + (l.port ? ':' + l.port : '') +
        l.pathname.split('/').slice(0, 1 + pathSegmentsToKeep).join('/') + '/?/' +
        l.pathname
          .slice(1)
          .split('/')
          .slice(pathSegmentsToKeep)
          .join('/')
          .replaceAll('&', '~and~') +
        (l.search ? '&' + l.search.slice(1).replaceAll('&', '~and~') : '') +
        l.hash
      );
    </script>
  </head>
  <body></body>
</html>`;
}

async function main(): Promise<void> {
  await writeFile(nojekyllPath, '', 'utf8').catch((error) => {
    console.warn('[fix-spa-build] Failed to create .nojekyll:', error);
  });

  let indexHtml: string;
  try {
    indexHtml = await readFile(indexPath, 'utf8');
  } catch (error) {
    console.error('[fix-spa-build] Unable to read dist/index.html:', error);
    process.exitCode = 1;
    return;
  }

  const env = loadEnv('production', appDir, '');
  const appName = env.VITE_APP_NAME || '';
  const basePath = appName ? `/${appName}` : '';
  const useHashRouting = env.VITE_USE_HASH_ROUTING !== 'false';

  if (useHashRouting) {
    console.log('[fix-spa-build] Hash routing enabled; injecting redirect snippet.');
    const updatedHtml = injectHashRouting(indexHtml, basePath);
    if (updatedHtml !== indexHtml) {
      await writeFile(indexPath, updatedHtml, 'utf8').catch((error) => {
        console.warn('[fix-spa-build] Failed to update index.html:', error);
      });
    }
    if (await exists(notFoundPath)) {
      await unlink(notFoundPath).catch((error) => {
        console.warn('[fix-spa-build] Failed to remove 404.html:', error);
      });
    }
    return;
  }

  console.log('[fix-spa-build] Hash routing disabled; ensuring 404.html exists.');
  const html = createNotFoundHtml(basePath);
  await writeFile(notFoundPath, html, 'utf8').catch((error) => {
    console.warn('[fix-spa-build] Failed to write 404.html:', error);
  });
}

await main();
