#!/usr/bin/env node

/**
 * Post-process Vite SPA builds without clobbering the generated markup.
 *
 * Responsibilities:
 * - create `.nojekyll` so GitHub Pages serves underscored assets
 * - optionally inject a hash-routing redirect snippet when `VITE_USE_HASH_ROUTING` is enabled
 * - manage 404.html for non-hash routing deployments
 */

import { access, readFile, unlink, writeFile } from 'fs/promises';
import { constants as fsConstants } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { loadEnv } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const buildDir = join(__dirname, '..', 'dist');
const indexPath = join(buildDir, 'index.html');
const nojekyllPath = join(buildDir, '.nojekyll');
const notFoundPath = join(buildDir, '404.html');

const exists = async (path) => {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
};

const injectHashRouting = (html, basePath) => {
  if (html.includes('hash-routing handler for GitHub Pages')) {
    return html;
  }

  const hashScript = `    <script type="text/javascript">
      // Hash routing handler for GitHub Pages
      // Convert path-based URLs to hash-based URLs - run only once on page load
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
    console.warn('[fix-spa-build] Could not find </head> in index.html; hash routing redirect will be appended to the top.');
    return `${hashScript}\n${html}`;
  }

  return html.replace('</head>', `${hashScript}\n</head>`);
};

const createNotFoundHtml = (basePath) => `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>HierarchiDB</title>
    <script type="text/javascript">
      // GitHub Pages SPA redirect script
      var pathSegmentsToKeep = ${basePath === '' ? 0 : 1};
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
  <body>
  </body>
</html>`;

async function main() {
  try {
    await writeFile(nojekyllPath, '', 'utf-8');
    console.log('✅ Created .nojekyll file for GitHub Pages');
  } catch (error) {
    console.warn('⚠️  Failed to create .nojekyll file:', error);
  }

  const env = loadEnv('production', process.cwd(), '');
  const appName = env.VITE_APP_NAME || '';
  const basePath = appName ? `/${appName}` : '';
  const useHashRouting = env.VITE_USE_HASH_ROUTING !== 'false';

  let indexHtml;
  try {
    indexHtml = await readFile(indexPath, 'utf-8');
  } catch (error) {
    console.error('❌ Unable to read dist/index.html:', error);
    process.exitCode = 1;
    return;
  }

  if (useHashRouting) {
    console.log('ℹ️  Hash routing is enabled; injecting client-side redirect snippet.');
    const updatedHtml = injectHashRouting(indexHtml, basePath);
    if (updatedHtml !== indexHtml) {
      try {
        await writeFile(indexPath, updatedHtml, 'utf-8');
        console.log('✅ Injected hash routing bootstrap script into index.html');
      } catch (error) {
        console.warn('⚠️  Failed to update index.html for hash routing:', error);
      }
    } else {
      console.log('ℹ️  Hash routing script already present; no changes applied to index.html');
    }

    if (await exists(notFoundPath)) {
      try {
        await unlink(notFoundPath);
        console.log('✅ Removed 404.html (hash routing does not require it)');
      } catch (error) {
        console.warn('⚠️  Failed to remove existing 404.html:', error);
      }
    }
    return;
  }

  console.log('ℹ️  Hash routing is disabled; ensuring 404.html is present for SPA redirects.');
  try {
    await writeFile(notFoundPath, createNotFoundHtml(basePath), 'utf-8');
    console.log('✅ 404.html written for non-hash routing deployment');
  } catch (error) {
    console.warn('⚠️  Failed to write 404.html:', error);
  }
}

await main();
