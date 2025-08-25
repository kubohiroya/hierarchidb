import { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';

/**
 * Vite plugin to serve favicon.ico at root path
 * This solves the issue where browsers automatically request /favicon.ico
 * even when the app is served from a subpath like /hierarchidb/
 */
export function faviconPlugin(): Plugin {
  return {
    name: 'vite-plugin-favicon',
    configureServer(server) {
      // Intercept requests for /favicon.ico
      server.middlewares.use((req, res, next) => {
        if (req.url === '/favicon.ico' || req.url === '/favicon.svg') {
          const ext = path.extname(req.url);
          const faviconPath = path.join(process.cwd(), 'public', `favicon${ext}`);
          
          // Check if favicon exists
          if (fs.existsSync(faviconPath)) {
            const favicon = fs.readFileSync(faviconPath);
            const contentType = ext === '.ico' ? 'image/x-icon' : 'image/svg+xml';
            
            res.writeHead(200, {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=3600',
            });
            res.end(favicon);
            return;
          }
        }
        next();
      });
    },
  };
}