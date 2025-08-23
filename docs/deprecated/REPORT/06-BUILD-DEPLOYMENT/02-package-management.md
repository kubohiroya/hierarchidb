# Package Management

## Overview

This document details the package management strategy for the HierarchiDB monorepo, including dependency management, version control, and package publishing strategies.

## Prerequisites

- Understanding of Node.js package managers
- Familiarity with monorepo concepts
- Knowledge of semantic versioning

## When to Read This Document

- When adding or updating dependencies
- Before publishing packages
- When troubleshooting dependency conflicts

## Package Manager: pnpm

### Why pnpm

```yaml
# Performance Benefits
- Disk space: ~50% reduction via content-addressable storage
- Installation speed: 2-3x faster than npm
- Memory usage: Efficient hard linking

# Monorepo Features
- Workspace protocol for internal dependencies
- Automatic dependency hoisting
- Strict dependency resolution
```

### Workspace Configuration

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'packages/ui/*'
  - 'packages/plugins/*'
  - 'packages/ui-treeconsole/*'
```

## Dependency Management

### Internal Dependencies

```json
{
  "dependencies": {
    "@hierarchidb/core": "workspace:*",
    "@hierarchidb/api": "workspace:*"
  }
}
```

### External Dependencies

```bash
# Add to specific package
pnpm --filter @hierarchidb/worker add dexie

# Add to root (dev dependencies)
pnpm add -D -w typescript

# Add to all packages
pnpm -r add lodash
```

### Version Management

```json
{
  "overrides": {
    "react": "19.0.0",
    "react-dom": "19.0.0"
  }
}
```

## Package Publishing

### Version Bumping

```bash
# Bump version for single package
pnpm --filter @hierarchidb/core version patch

# Bump all packages
pnpm -r version minor

# Custom version
pnpm --filter @hierarchidb/api version 2.0.0
```

### Pre-publish Checklist

1. **Build Verification**
   ```bash
   pnpm build
   pnpm typecheck
   pnpm test:run
   ```

2. **Package Exports Validation**
   ```bash
   node scripts/validate-package-exports.cjs
   ```

3. **License Check**
   ```bash
   pnpm check:licenses
   ```

### Publishing Process

```bash
# Dry run
pnpm -r publish --dry-run

# Publish to npm
pnpm -r publish --access public

# Publish with tag
pnpm -r publish --tag beta
```

## Dependency Updates

### Security Updates

```bash
# Check for vulnerabilities
pnpm audit

# Auto-fix vulnerabilities
pnpm audit --fix

# Update specific package
pnpm --filter @hierarchidb/worker update dexie
```

### Major Version Updates

```bash
# Interactive update
pnpm -r update -i

# Update to latest
pnpm -r update --latest

# Check outdated
pnpm -r outdated
```

## Lock File Management

### Best Practices

```bash
# Always commit pnpm-lock.yaml
git add pnpm-lock.yaml

# Recreate lock file
rm pnpm-lock.yaml
pnpm install

# Fix corrupted lock file
pnpm install --fix-lockfile
```

## Package Scripts

### Common Scripts Structure

```json
{
  "scripts": {
    "dev": "tsup --watch",
    "build": "tsup",
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "test:run": "vitest run",
    "lint": "eslint src",
    "format": "prettier --write src"
  }
}
```

### Script Execution

```bash
# Run in specific package
pnpm --filter @hierarchidb/core dev

# Run in all packages
pnpm -r build

# Run in parallel
pnpm -r --parallel dev

# Run with dependencies
pnpm --filter @hierarchidb/app... build
```

## Troubleshooting

### Common Issues

1. **Peer Dependency Warnings**
   ```bash
   # Install peer dependencies
   pnpm install --shamefully-hoist
   ```

2. **Module Resolution Errors**
   ```bash
   # Clear cache
   pnpm store prune
   pnpm install --force
   ```

3. **Workspace Protocol Issues**
   ```bash
   # Update workspace dependencies
   pnpm -r update @hierarchidb/core
   ```

## Performance Optimization

### Installation Speed

```bash
# Use frozen lockfile in CI
pnpm install --frozen-lockfile

# Skip optional dependencies
pnpm install --no-optional

# Offline mode
pnpm install --offline
```

### Disk Usage

```bash
# Check store size
pnpm store status

# Prune unused packages
pnpm store prune

# Verify store integrity
pnpm store verify
```

## CI/CD Integration

### GitHub Actions

```yaml
- name: Setup pnpm
  uses: pnpm/action-setup@v2
  with:
    version: 9

- name: Install dependencies
  run: pnpm install --frozen-lockfile

- name: Build packages
  run: pnpm build
```

## Migration Guide

### From npm/yarn

```bash
# Convert package-lock.json
pnpm import

# Install with pnpm
pnpm install

# Update scripts
sed -i 's/npm run/pnpm/g' package.json
```

## Best Practices

1. **Always use workspace protocol for internal deps**
2. **Pin critical dependencies versions**
3. **Regular security audits**
4. **Keep pnpm updated**
5. **Document breaking changes**
6. **Use changesets for version management**

## Related Documentation

- [Build System](./01-build-system.md)
- [Deployment](./03-deployment.md)
- [Project Configuration](../01-PROJECT-OVERVIEW/02-project-configuration.md)