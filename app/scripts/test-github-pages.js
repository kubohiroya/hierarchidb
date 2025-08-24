#!/usr/bin/env node

/**
 * Test GitHub Pages SPA routing locally
 * Simulates GitHub Pages behavior with base path
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const buildDir = path.join(__dirname, '..', 'build', 'client');
const BASE_PATH = '/hierarchidb'; // GitHub Pages base path

const app = express();
const PORT = 8080;

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Serve static files under the base path
app.use(BASE_PATH, express.static(buildDir));

// Catch all routes and serve 404.html (GitHub Pages behavior)
app.get('*', (req, res) => {
  if (!req.url.startsWith(BASE_PATH)) {
    console.log(`Redirecting to ${BASE_PATH}${req.url}`);
    return res.redirect(BASE_PATH + req.url);
  }

  console.log('Serving 404.html for SPA routing');
  res.sendFile(path.join(buildDir, '404.html'));
});

app.listen(PORT, () => {
  console.log(`
=================================================
GitHub Pages Test Server Running
=================================================
URL: http://localhost:${PORT}${BASE_PATH}
Build Dir: ${buildDir}

This server simulates GitHub Pages behavior:
- Serves files under ${BASE_PATH}
- Returns 404.html for unknown routes
- Logs all requests for debugging

Press Ctrl+C to stop
=================================================
  `);
});
