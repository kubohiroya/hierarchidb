# Dependency Analysis

## Overview

This document provides a comprehensive analysis of dependencies in the HierarchiDB project, including dependency trees, security audits, update strategies, and optimization opportunities.

## Prerequisites

- Understanding of npm/pnpm package management
- Knowledge of semantic versioning
- Familiarity with dependency security concepts

## When to Read This Document

- Before adding new dependencies
- During security audits
- When optimizing bundle size
- During dependency updates

## Dependency Overview

### Package Statistics

```yaml
Total Dependencies: 267
Direct Dependencies: 45
Dev Dependencies: 38
Peer Dependencies: 12
Transitive Dependencies: 172

By Category:
  Framework: 8 (React, React Router, MUI)
  Build Tools: 15 (Vite, tsup, Turborepo)
  Testing: 12 (Vitest, Playwright, Testing Library)
  Utilities: 18 (lodash, date-fns, nanoid)
  Type Definitions: 22 (@types/*)
  
Update Status:
  Up-to-date: 234 (87.6%)
  Minor updates: 28 (10.5%)
  Major updates: 5 (1.9%)
```

## Core Dependencies

### Production Dependencies

```typescript
// Critical runtime dependencies
const coreDependencies = {
  react: {
    version: '19.0.0',
    usage: 'UI framework',
    size: '6.4KB gzipped',
    alternatives: 'None viable'
  },
  
  'react-dom': {
    version: '19.0.0',
    usage: 'React DOM rendering',
    size: '41.7KB gzipped',
    notes: 'Required for React'
  },
  
  '@mui/material': {
    version: '6.3.1',
    usage: 'Component library',
    size: '326KB gzipped',
    optimization: 'Tree-shakeable, use specific imports'
  },
  
  'dexie': {
    version: '4.0.10',
    usage: 'IndexedDB wrapper',
    size: '28.9KB gzipped',
    critical: true,
    alternatives: 'idb (smaller but less features)'
  },
  
  'comlink': {
    version: '4.4.2',
    usage: 'Worker RPC',
    size: '3.8KB gzipped',
    critical: true
  },
  
  'maplibre-gl': {
    version: '5.0.0',
    usage: 'Map rendering',
    size: '245KB gzipped',
    optional: 'Only for map plugins'
  }
};
```

### Development Dependencies

```typescript
const devDependencies = {
  typescript: {
    version: '5.7.3',
    usage: 'Type checking',
    updateFrequency: 'Monthly'
  },
  
  vite: {
    version: '6.0.7',
    usage: 'Build tool',
    plugins: [
      '@vitejs/plugin-react',
      'vite-plugin-checker',
      'vite-tsconfig-paths'
    ]
  },
  
  vitest: {
    version: '2.1.8',
    usage: 'Unit testing',
    config: 'vitest.config.ts'
  },
  
  playwright: {
    version: '1.49.1',
    usage: 'E2E testing',
    browsers: ['chromium', 'firefox', 'webkit']
  },
  
  eslint: {
    version: '9.18.0',
    usage: 'Linting',
    plugins: [
      'eslint-plugin-react',
      'eslint-plugin-react-hooks',
      '@typescript-eslint/eslint-plugin'
    ]
  }
};
```

## Dependency Tree Analysis

### Deep Dependencies

```typescript
// Dependencies with concerning depth
const deepDependencies = [
  {
    package: '@mui/material',
    depth: 8,
    chain: '@mui/material -> @mui/system -> @emotion/react -> ...',
    issue: 'Long dependency chain increases vulnerability surface',
    mitigation: 'Regular security audits'
  },
  
  {
    package: 'vite',
    depth: 12,
    chain: 'vite -> rollup -> ... -> node-gyp',
    issue: 'Native dependencies complicate CI/CD',
    mitigation: 'Use pre-built binaries'
  }
];
```

### Shared Dependencies

```typescript
// Dependencies used by multiple packages
const sharedDependencies = {
  'tslib': {
    versions: ['2.6.2', '2.6.3', '2.7.0'],
    consumers: 15,
    issue: 'Multiple versions increase bundle size',
    solution: 'Add to pnpm overrides'
  },
  
  'react': {
    versions: ['19.0.0'],
    consumers: 23,
    status: 'Properly deduped'
  }
};
```

## Security Analysis

### Vulnerability Report

```bash
# pnpm audit results
┌─────────────────┬────────────────────────────────────┐
│ Severity        │ Count                              │
├─────────────────┼────────────────────────────────────┤
│ Critical        │ 0                                  │
│ High            │ 0                                  │
│ Moderate        │ 1                                  │
│ Low             │ 3                                  │
└─────────────────┴────────────────────────────────────┘
```

### Vulnerability Details

```typescript
const vulnerabilities = [
  {
    severity: 'Moderate',
    package: 'postcss',
    vulnerability: 'CVE-2023-44270',
    type: 'ReDoS',
    fixedIn: '8.4.31',
    currentVersion: '8.4.29',
    path: 'vite > postcss',
    action: 'Update vite to latest'
  },
  
  {
    severity: 'Low',
    package: 'semver',
    vulnerability: 'CVE-2022-25883',
    type: 'ReDoS',
    fixedIn: '7.5.2',
    currentVersion: '7.5.0',
    path: 'Multiple paths',
    action: 'Add to pnpm overrides'
  }
];
```

### Security Best Practices

```typescript
// Security configuration
const securityConfig = {
  audit: {
    schedule: 'Weekly CI job',
    autoFix: true,
    failOnHigh: true
  },
  
  policies: [
    'No dependencies with known critical vulnerabilities',
    'Audit before each release',
    'Review new dependencies for security',
    'Prefer dependencies with active maintenance'
  ],
  
  tools: [
    'pnpm audit',
    'npm audit',
    'snyk test',
    'socket.dev monitoring'
  ]
};
```

## Bundle Size Analysis

### Package Sizes

```typescript
const bundleAnalysis = {
  total: '2.4MB (684KB gzipped)',
  
  largest: [
    { name: 'maplibre-gl', size: '745KB', gzipped: '245KB' },
    { name: '@mui/material', size: '991KB', gzipped: '326KB' },
    { name: 'react-dom', size: '135KB', gzipped: '42KB' },
    { name: 'dexie', size: '89KB', gzipped: '29KB' },
    { name: '@tanstack/react-virtual', size: '45KB', gzipped: '15KB' }
  ],
  
  optimization_opportunities: [
    {
      package: '@mui/material',
      current: 'import { Button } from "@mui/material"',
      optimized: 'import Button from "@mui/material/Button"',
      savings: '~150KB'
    },
    {
      package: 'lodash',
      current: 'import _ from "lodash"',
      optimized: 'import debounce from "lodash/debounce"',
      savings: '~50KB'
    }
  ]
};
```

### Code Splitting Analysis

```typescript
const codeSplitting = {
  chunks: {
    main: '450KB',
    vendor: '684KB',
    'maplibre-chunk': '245KB',
    'mui-chunk': '326KB'
  },
  
  lazy_loaded: [
    'Map components (245KB)',
    'Shape plugin (189KB)',
    'Admin routes (78KB)'
  ],
  
  recommendations: [
    'Split MUI icons into separate chunk',
    'Lazy load heavy plugins',
    'Use dynamic imports for routes'
  ]
};
```

## Update Strategy

### Dependency Update Policy

```typescript
const updatePolicy = {
  automated: {
    patches: 'Auto-merge after tests pass',
    minor: 'Auto-merge for dev dependencies only',
    major: 'Manual review required'
  },
  
  schedule: {
    security: 'Immediate',
    patches: 'Weekly',
    minor: 'Bi-weekly',
    major: 'Quarterly planning'
  },
  
  testing: {
    requirement: 'All tests must pass',
    additional: [
      'Bundle size comparison',
      'Performance benchmarks',
      'Visual regression tests'
    ]
  }
};
```

### Pending Updates

```typescript
const pendingUpdates = [
  {
    package: '@types/react',
    current: '18.2.0',
    latest: '19.0.0',
    type: 'major',
    breaking: true,
    effort: 'Medium',
    benefits: 'React 19 type support'
  },
  
  {
    package: 'vite',
    current: '6.0.7',
    latest: '6.1.0',
    type: 'minor',
    breaking: false,
    effort: 'Low',
    benefits: 'Performance improvements'
  },
  
  {
    package: 'typescript',
    current: '5.7.3',
    latest: '5.8.0',
    type: 'minor',
    breaking: false,
    effort: 'Low',
    benefits: 'New type features'
  }
];
```

## Dependency Optimization

### Duplicate Removal

```typescript
// Deduplication opportunities
const duplicates = {
  'tslib': {
    versions: 3,
    solution: `
      // pnpm-workspace.yaml
      overrides:
        tslib: ^2.7.0
    `,
    savings: '~10KB'
  },
  
  '@types/node': {
    versions: 2,
    solution: 'Align all to latest',
    savings: '~5KB'
  }
};
```

### Alternative Packages

```typescript
const alternatives = [
  {
    current: 'moment',
    alternative: 'date-fns',
    reason: 'Smaller, tree-shakeable',
    savings: '~60KB',
    effort: 'Medium'
  },
  
  {
    current: 'axios',
    alternative: 'native fetch',
    reason: 'No dependency needed',
    savings: '~15KB',
    effort: 'Low'
  },
  
  {
    current: 'uuid',
    alternative: 'crypto.randomUUID()',
    reason: 'Native browser API',
    savings: '~5KB',
    effort: 'Low'
  }
];
```

## License Compliance

### License Summary

```typescript
const licenses = {
  summary: {
    MIT: 234,
    'Apache-2.0': 18,
    ISC: 12,
    BSD: 3,
    Other: 0
  },
  
  compatible: true,
  
  concerns: [],
  
  policy: {
    allowed: ['MIT', 'Apache-2.0', 'ISC', 'BSD'],
    forbidden: ['GPL', 'AGPL'],
    review_required: ['CC', 'Custom']
  }
};
```

## Dependency Graph Visualization

```mermaid
graph TD
    A[app] --> B[ui-client]
    A --> C[ui-core]
    A --> D[ui-treeconsole]
    B --> E[api]
    B --> F[worker]
    E --> G[core]
    F --> G
    F --> H[dexie]
    B --> I[comlink]
    C --> J[@mui/material]
    C --> K[react]
    D --> L[@tanstack/react-virtual]
```

## Maintenance Status

### Package Health

```typescript
const packageHealth = {
  wellMaintained: [
    { name: 'react', lastPublish: '1 month ago', weekly_downloads: '25M' },
    { name: 'vite', lastPublish: '2 weeks ago', weekly_downloads: '8M' },
    { name: 'typescript', lastPublish: '1 week ago', weekly_downloads: '45M' }
  ],
  
  concerns: [
    {
      name: 'comlink',
      lastPublish: '1 year ago',
      issue: 'Slow update cycle',
      risk: 'Low - stable and mature'
    }
  ],
  
  deprecated: [],
  
  abandoned: []
};
```

## Recommendations

### Immediate Actions
1. **Update postcss** to fix moderate vulnerability
2. **Deduplicate tslib** versions
3. **Replace uuid with crypto.randomUUID()**
4. **Optimize MUI imports** for tree-shaking

### Short-term Improvements
1. **Implement automated dependency updates** via Renovate/Dependabot
2. **Add bundle size monitoring** to CI
3. **Create dependency update checklist**
4. **Document package selection criteria**

### Long-term Strategy
1. **Reduce dependency count** by using native APIs
2. **Implement dependency vendoring** for critical packages
3. **Create abstraction layers** for easy package swaps
4. **Regular dependency audits** (quarterly)

## Monitoring Tools

```bash
# Useful commands for dependency analysis

# Check outdated packages
pnpm outdated

# Analyze bundle size
pnpm build --analyze

# Security audit
pnpm audit

# Find duplicate packages
pnpm dedupe --check

# License check
npx license-checker --summary

# Dependency graph
pnpm list --depth=2 --tree
```

## Related Documentation

- [Package Management](../06-BUILD-DEPLOYMENT/02-package-management.md)
- [Security Guidelines](../05-QUALITY/02-security.md)
- [Performance Analysis](./01-performance-analysis.md)