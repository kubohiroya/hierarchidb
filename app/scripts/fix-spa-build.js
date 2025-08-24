#!/usr/bin/env node

/**
 * Fix React Router v7 SPA build for GitHub Pages
 *
 * React Router v7 in SPA mode generates an index.html with streaming scripts
 * that can cause issues on static hosts like GitHub Pages.
 * This script creates a proper SPA index.html with the required initialization.
 */

import { readFile, writeFile, copyFile, readdir, unlink } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const buildDir = join(__dirname, '..', 'build', 'client');

async function fixSpaBuild() {
  // Create .nojekyll file for GitHub Pages to serve files starting with _
  const nojekyllPath = join(buildDir, '.nojekyll');
  await writeFile(nojekyllPath, '', 'utf-8');
  console.log('✅ Created .nojekyll file for GitHub Pages');

  // Load environment variables
  const { loadEnv } = await import('vite');
  const env = loadEnv('production', process.cwd(), '');
  // Default to hash routing unless explicitly disabled
  const useHashRouting = env.VITE_USE_HASH_ROUTING !== 'false';

  // Get _app name from environment for dynamic path generation
  const appName = env.VITE_APP_NAME || '';
  const basePath = appName ? `/${appName}` : '';

  // Find actual asset files in build directory
  const assetsDir = join(buildDir, 'assets');
  const assetFiles = await readdir(assetsDir);

  // Find manifest and entry files dynamically
  const manifestFile = assetFiles.find((f) => f.startsWith('manifest-') && f.endsWith('.js'));
  const entryFile = assetFiles.find((f) => f === 'entry.client.js');
  const rootFile = assetFiles.find((f) => f === 'root.js');

  // Check for required files (manifest is optional for Vite builds)
  if (!entryFile || !rootFile) {
    throw new Error(`Missing required asset files. Found: entry=${entryFile}, root=${rootFile}`);
  }

  // Use main entry file if manifest is not available
  const mainFile =
    manifestFile || assetFiles.find((f) => f.startsWith('index-') && f.endsWith('.js'));

  console.log(
    `Using asset files: manifest=${manifestFile || 'none'}, main=${mainFile}, entry=${entryFile}, root=${rootFile}`
  );

  try {
    // Check if hash routing is enabled
    if (useHashRouting) {
      console.log('✅ Hash routing enabled - generating hash-based index.html');

      // Create hash-routing compatible index.html
      const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" href="${basePath}/favicon.svg" />
    <title>HierarchiDB</title>
    <script type="text/javascript">
      // Hash routing handler for GitHub Pages
      // Convert path-based URLs to hash-based URLs - run only once on page load
      (function() {
        // Check if we already processed this page
        if (sessionStorage.getItem('hash-routing-processed')) {
          return;
        }
        
        var path = window.location.pathname;
        var base = '${basePath}';
        
        // Only redirect if we're on a sub-path (not the root)
        // and we don't already have a hash fragment
        if (path !== base + '/' && path.startsWith(base + '/') && !window.location.hash) {
          sessionStorage.setItem('hash-routing-processed', 'true');
          var hashPath = path.substring(base.length);
          window.location.replace(base + '/#' + hashPath + window.location.search);
        } else if (path === base + '/') {
          // Mark as processed for root path too
          sessionStorage.setItem('hash-routing-processed', 'true');
        }
      })();
    </script>
</head>
<body>
<div id="root"></div>
<script>
  // React Router SPA mode initialization with hash routing support
  window.__reactRouterContext = {
    "basename": "${basePath}/",
    "future": {
      "unstable_middleware": false,
      "unstable_optimizeDeps": false,
      "unstable_splitRouteModules": false,
      "unstable_subResourceIntegrity": false,
      "unstable_viteEnvironmentApi": false
    },
    "routeDiscovery": {"mode": "initial"},
    "ssr": false,
    "isSpaMode": true
  };
  
  // Intercept navigation to add hash prefix - disabled for now to prevent loops
  // This approach can cause conflicts with React Router's internal navigation
  /*
  var originalPushState = history.pushState;
  var originalReplaceState = history.replaceState;
  
  history.pushState = function() {
    var url = arguments[2];
    if (url && !url.startsWith('#') && !url.startsWith('${basePath}/#')) {
      arguments[2] = '${basePath}/#' + url.replace('${basePath}', '');
    }
    return originalPushState.apply(history, arguments);
  };
  
  history.replaceState = function() {
    var url = arguments[2];
    if (url && !url.startsWith('#') && !url.startsWith('${basePath}/#')) {
      arguments[2] = '${basePath}/#' + url.replace('${basePath}', '');
    }
    return originalReplaceState.apply(history, arguments);
  };
  */
  
  // Create a minimal stream for SPA mode
  window.__reactRouterContext.stream = new ReadableStream({
    start(controller) {
      window.__reactRouterContext.streamController = controller;
      controller.enqueue('[{"_1":2,"_3":-5,"_4":-5},"loaderData",{},"actionData","errors"]' + String.fromCharCode(10));
      controller.close();
    }
  }).pipeThrough(new TextEncoderStream());
</script>
<script type="module">
  ${manifestFile ? `import "${basePath}/assets/${manifestFile}";` : ''}
  import * as route0 from "${basePath}/assets/${rootFile}";
  import * as indexRoute from "${basePath}/assets/_index.js";
  
  window.__reactRouterRouteModules = {
    "root": route0,
    "routes/_index": indexRoute
  };
  
  import("${basePath}/assets/${entryFile}");
</script>
</body>
</html>`;

      // Write the hash-routing index.html
      const dest = join(buildDir, 'index.html');
      await writeFile(dest, indexHtml, 'utf-8');

      // Remove 404.html if it exists (conflicts with hash routing)
      const notFoundPath = join(buildDir, '404.html');
      try {
        await readFile(notFoundPath);
        await unlink(notFoundPath);
        console.log('✅ Removed conflicting 404.html for hash routing');
      } catch {
        // 404.html doesn't exist, which is good for hash routing
      }

      console.log('✅ Hash routing build complete - 404.html not needed');
      return;
    }

    // Original browser routing index.html
    const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" href="${basePath}/favicon.svg" />
    <title>HierarchiDB</title>
    ${
      useHashRouting
        ? ''
        : `<script type="text/javascript">
      // Handle GitHub Pages SPA redirect
      // This script processes the redirect from 404.html
      (function(l) {
        if (l.search[1] === '/' ) {
          var decoded = l.search.slice(1).split('&').map(function(s) { 
            return s.replace(/~and~/g, '&')
          }).join('?');
          window.history.replaceState(null, null,
              l.pathname.slice(0, -1) + decoded + l.hash
          );
        }
      }(window.location))
    </script>`
    }
</head>
<body>
<div id="root"></div>
<script>
  // React Router SPA mode initialization
  window.__reactRouterContext = {
    "basename": "${basePath}/",
    "future": {
      "unstable_middleware": false,
      "unstable_optimizeDeps": false,
      "unstable_splitRouteModules": false,
      "unstable_subResourceIntegrity": false,
      "unstable_viteEnvironmentApi": false
    },
    "routeDiscovery": {"mode": "initial"},
    "ssr": false,
    "isSpaMode": true
  };
  
  // Create a minimal stream for SPA mode
  window.__reactRouterContext.stream = new ReadableStream({
    start(controller) {
      window.__reactRouterContext.streamController = controller;
      // Immediately provide empty loader data for SPA mode
      controller.enqueue('[{"_1":2,"_3":-5,"_4":-5},"loaderData",{},"actionData","errors"]\n');
      controller.close();
    }
  }).pipeThrough(new TextEncoderStream());
</script>
<script type="module">
  ${manifestFile ? `import "${basePath}/assets/${manifestFile}";` : ''}
  import * as route0 from "${basePath}/assets/${rootFile}";
  import * as indexRoute from "${basePath}/assets/_index.js";
  
  window.__reactRouterRouteModules = {
    "root": route0,
    "routes/_index": indexRoute
  };
  
  import("${basePath}/assets/${entryFile}");
</script>
</body>
</html>`;

    // Write the fixed index.html
    const dest = join(buildDir, 'index.html');
    await writeFile(dest, indexHtml, 'utf-8');

    // Create 404.html for GitHub Pages SPA routing with redirection script
    const notFoundHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>HierarchiDB</title>
    <script type="text/javascript">
      // GitHub Pages SPA redirect script
      // This script takes the current location and replaces it with the base URL
      // plus a query parameter to preserve the path for the SPA router
      var pathSegmentsToKeep = 1; // Keep "hierarchidb" segment

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

    const dest404 = join(buildDir, '404.html');
    await writeFile(dest404, notFoundHtml, 'utf-8');

    console.log('✅ Fixed SPA build: Created proper index.html with React Router initialization');
  } catch (error) {
    console.error('❌ Error fixing SPA build:', error);
    process.exit(1);
  }
}

fixSpaBuild();
