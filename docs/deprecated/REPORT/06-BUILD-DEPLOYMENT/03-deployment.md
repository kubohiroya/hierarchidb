# Deployment

## Overview

This document covers deployment strategies for HierarchiDB, including GitHub Pages deployment for the frontend application and environment-specific configurations.

## Prerequisites

- GitHub account with repository access
- Understanding of static site hosting
- Basic knowledge of environment variables

## When to Read This Document

- Before deploying to production
- When setting up CI/CD pipelines
- When configuring new environments

## Deployment Environments

### Development Environment

```bash
# Local development
VITE_APP_NAME=""  # No base path
pnpm dev
# Runs on http://localhost:5173
```

### Staging Environment

```bash
# Preview build
VITE_APP_NAME="hierarchidb-staging"
pnpm build
pnpm preview
# Runs on http://localhost:4173/hierarchidb-staging
```

### Production Environment

```bash
# Production build
VITE_APP_NAME="hierarchidb"
pnpm build
# Deployed to https://[username].github.io/hierarchidb
```

## GitHub Pages Deployment

### Repository Configuration

1. **Settings > Pages**
   ```yaml
   Source: Deploy from a branch
   Branch: gh-pages
   Folder: / (root)
   ```

2. **Base Path Configuration**
   ```typescript
   // vite.config.ts
   export default defineConfig({
     base: process.env.VITE_APP_NAME 
       ? `/${process.env.VITE_APP_NAME}/` 
       : '/'
   });
   ```

### Manual Deployment

```bash
# Build application
pnpm build

# Create gh-pages branch
git checkout -b gh-pages

# Copy build output
cp -r packages/app/dist/* .

# Add nojekyll file
touch .nojekyll

# Commit and push
git add .
git commit -m "Deploy to GitHub Pages"
git push origin gh-pages
```

### Automated Deployment (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Build application
        run: pnpm build
        env:
          VITE_APP_NAME: hierarchidb
      
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: packages/app/dist
  
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

## Environment Configuration

### Environment Variables

```bash
# .env.production
VITE_APP_NAME=hierarchidb
VITE_API_URL=https://api.example.com
VITE_PUBLIC_URL=https://username.github.io/hierarchidb
```

### Build-time Configuration

```typescript
// config/production.ts
export const config = {
  appName: import.meta.env.VITE_APP_NAME,
  apiUrl: import.meta.env.VITE_API_URL,
  publicUrl: import.meta.env.VITE_PUBLIC_URL,
  features: {
    analytics: true,
    debugMode: false
  }
};
```

## Asset Optimization

### Build Optimization

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          mui: ['@mui/material'],
          maplibre: ['maplibre-gl'],
          dexie: ['dexie']
        }
      }
    },
    chunkSizeWarningLimit: 1000,
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  }
});
```

### Static Assets

```bash
# Optimize images
pnpm add -D sharp
node scripts/optimize-images.js

# Compress assets
gzip -9 dist/*.js
gzip -9 dist/*.css
```

## Deployment Checklist

### Pre-deployment

- [ ] Run all tests
  ```bash
  pnpm test:run
  pnpm e2e
  ```

- [ ] Check type safety
  ```bash
  pnpm typecheck
  ```

- [ ] Verify build
  ```bash
  pnpm build
  pnpm preview
  ```

- [ ] Update version
  ```bash
  pnpm version patch
  ```

- [ ] Update changelog
  ```bash
  git add CHANGELOG.md
  git commit -m "chore: update changelog"
  ```

### Post-deployment

- [ ] Verify deployment URL
- [ ] Test critical paths
- [ ] Check console for errors
- [ ] Monitor performance metrics
- [ ] Update documentation

## Rollback Strategy

### Manual Rollback

```bash
# Revert to previous deployment
git checkout gh-pages
git revert HEAD
git push origin gh-pages
```

### Automated Rollback

```yaml
# GitHub Actions rollback
- name: Rollback on failure
  if: failure()
  run: |
    git checkout gh-pages
    git reset --hard HEAD~1
    git push --force origin gh-pages
```

## Performance Monitoring

### Lighthouse CI

```yaml
- name: Run Lighthouse CI
  uses: treosh/lighthouse-ci-action@v10
  with:
    urls: |
      https://username.github.io/hierarchidb
    uploadArtifacts: true
    temporaryPublicStorage: true
```

### Bundle Analysis

```bash
# Analyze bundle size
pnpm build --analyze

# Generate report
npx vite-bundle-visualizer
```

## Security Considerations

### Content Security Policy

```html
<!-- index.html -->
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self' 'unsafe-inline'; 
               style-src 'self' 'unsafe-inline';">
```

### HTTPS Enforcement

```yaml
# GitHub Pages automatically provides HTTPS
# Ensure all resources use HTTPS
```

## CDN Integration

### Static Assets CDN

```typescript
// vite.config.ts
export default defineConfig({
  experimental: {
    renderBuiltUrl(filename) {
      return `https://cdn.example.com/${filename}`;
    }
  }
});
```

## Troubleshooting

### Common Issues

1. **404 on refresh**
   - Add 404.html with redirect logic
   - Configure React Router for hash routing

2. **Base path issues**
   - Verify VITE_APP_NAME environment variable
   - Check vite.config.ts base configuration

3. **Asset loading failures**
   - Ensure relative paths in imports
   - Check .nojekyll file presence

## Related Documentation

- [Build System](./01-build-system.md)
- [Package Management](./02-package-management.md)
- [Environment Configuration](../01-PROJECT-OVERVIEW/02-project-configuration.md)