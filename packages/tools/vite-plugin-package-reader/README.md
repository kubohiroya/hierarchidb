# @hierarchidb/tools-vite-plugin-package-reader

Universal Vite plugin for automatic package detection and virtual module generation in monorepo and standard npm environments.

## Features

- 🔍 **Flexible Package Detection**: Use regex, field-based, or custom strategies
- 🔄 **Transform Pipeline**: Convert package data to any format with dependency resolution
- 📦 **Virtual Module Generation**: Create virtual modules from detected packages
- 🏗️ **Monorepo Support**: Works with pnpm workspaces, lerna, and custom structures
- ⚡ **HMR Support**: Auto-reload on package.json changes
- 🎯 **TypeScript Support**: Full type definitions and auto-generated types
- 🔌 **Extensible**: Hook system for custom logic at every stage

## Installation

```bash
npm install @hierarchidb/tools-vite-plugin-package-reader
# or
pnpm add @hierarchidb/tools-vite-plugin-package-reader
# or
yarn add @hierarchidb/tools-vite-plugin-package-reader
```

## Quick Start

### Basic Usage

```typescript
// vite.config.ts
import { vitePluginPackageReader, RegexStrategy } from '@hierarchidb/tools-vite-plugin-package-reader';

export default {
  plugins: [
    vitePluginPackageReader({
      strategies: [
        new RegexStrategy({
          name: 'my-plugins',
          pattern: /^@myorg\/.*-plugin$/,
        })
      ],
    })
  ]
};
```

### Using HierarchiDB Preset

```typescript
// vite.config.ts
import { vitePluginPackageReader } from '@hierarchidb/tools-vite-plugin-package-reader';
import { hierarchiDBPreset } from '@hierarchidb/tools-vite-plugin-package-reader/presets';

export default {
  plugins: [
    vitePluginPackageReader(hierarchiDBPreset())
  ]
};
```

### Consuming Virtual Modules

```typescript
// In your application code
import pluginDefinitions from 'virtual:plugin-definitions';

console.log('Available plugins:', pluginDefinitions);
```

## Advanced Configuration

### Custom Detection Strategy

```typescript
import { FunctionStrategy } from '@hierarchidb/tools-vite-plugin-package-reader';

const customStrategy = new FunctionStrategy({
  name: 'custom',
  test: (packageName, packageJson) => {
    return packageJson.keywords?.includes('my-plugin');
  },
  getPriority: (packageName) => {
    if (packageName.includes('core')) return 1;
    return 100;
  },
  extractMetadata: (packageJson) => ({
    config: packageJson.myPluginConfig
  })
});
```

### Transform Pipeline

```typescript
vitePluginPackageReader({
  strategies: [/* ... */],
  
  pipeline: {
    transform: (packages) => {
      // Convert Map<string, PackageJson> to your desired format
      return Array.from(packages.values()).map(pkg => ({
        name: pkg.name,
        version: pkg.version,
        // ... custom transformation
      }));
    },
    
    resolveDependencies: (item) => {
      // Return array of dependency names
      return item.dependencies || [];
    },
    
    sort: (items) => {
      // Custom sorting logic
      return items.sort((a, b) => a.priority - b.priority);
    }
  }
});
```

### Virtual Module Generation

```typescript
vitePluginPackageReader({
  strategies: [/* ... */],
  
  virtualModules: [{
    moduleId: 'my-plugins',
    
    generate: (data) => {
      return `export default ${JSON.stringify(data, null, 2)};`;
    },
    
    generateTypes: (data) => {
      return `declare const plugins: any[];\nexport default plugins;`;
    }
  }]
});
```

### Hooks

```typescript
vitePluginPackageReader({
  strategies: [/* ... */],
  
  hooks: {
    beforeDetection: async () => {
      console.log('Starting package detection...');
    },
    
    afterDetection: async (packages) => {
      console.log(`Found ${packages.size} packages`);
    },
    
    beforeTransform: async (packages) => {
      // Modify packages before transformation
      return packages;
    },
    
    afterTransform: async (result) => {
      // Modify transformation result
      return result;
    },
    
    onError: (error, context) => {
      console.error(`Error in ${context}:`, error);
    }
  }
});
```

### Monorepo Configuration

```typescript
vitePluginPackageReader({
  strategies: [/* ... */],
  
  monorepo: {
    packages: ['packages/*', 'apps/*'],
    resolveWorkspace: true,
    usePnpmWorkspace: true,
    useLerna: false
  }
});
```

## API Reference

### Strategies

- `RegexStrategy`: Match packages by name pattern
- `FieldStrategy`: Match packages by field existence
- `CompositeStrategy`: Combine multiple strategies
- `FunctionStrategy`: Custom matching logic

### Pipeline Options

- `transform`: Convert package data to desired format
- `resolveDependencies`: Extract dependencies for topological sorting
- `sort`: Custom sorting logic

### Virtual Module Options

- `moduleId`: Unique identifier for the virtual module
- `generate`: Function to generate module content
- `generateTypes`: Optional TypeScript definitions

### Hooks

- `beforeDetection`: Called before package detection starts
- `afterDetection`: Called after packages are detected
- `beforeTransform`: Modify packages before transformation
- `afterTransform`: Modify transformation result
- `onError`: Handle errors gracefully

## Migration from Legacy Implementation

If you're migrating from the old `scripts/vite-plugin-package-reader.ts`:

```typescript
// Old implementation
import { vitePluginPackageReader } from '../scripts/vite-plugin-package-reader';

// New implementation
import { vitePluginPackageReader } from '@hierarchidb/tools-vite-plugin-package-reader';
import { hierarchiDBPreset } from '@hierarchidb/tools-vite-plugin-package-reader/presets';

// Use the preset for HierarchiDB-specific configuration
export default {
  plugins: [
    vitePluginPackageReader(hierarchiDBPreset({
      priorityPlugin: 'folder',
      extractPluginConfig: true
    }))
  ]
};
```

## Examples

### Plugin System

```typescript
// Create a plugin system with automatic discovery
import { vitePluginPackageReader } from '@hierarchidb/tools-vite-plugin-package-reader';

vitePluginPackageReader({
  strategies: [
    new RegexStrategy({
      name: 'plugins',
      pattern: /^@myapp\/plugin-/
    })
  ],
  
  pipeline: {
    transform: (packages) => {
      return Array.from(packages.values()).map(pkg => ({
        name: pkg.name.replace('@myapp/plugin-', ''),
        module: pkg.name,
        config: pkg.pluginConfig || {}
      }));
    }
  },
  
  virtualModules: [{
    moduleId: 'plugin-registry',
    generate: (plugins) => `
      const registry = new Map();
      ${plugins.map(p => `registry.set('${p.name}', () => import('${p.module}'));`).join('\n')}
      export default registry;
    `
  }]
});
```

### Component Library

```typescript
// Auto-generate component exports
vitePluginPackageReader({
  strategies: [
    new FieldStrategy({
      name: 'components',
      fields: ['exports.Component']
    })
  ],
  
  virtualModules: [{
    moduleId: 'components',
    generate: (packages) => {
      const exports = [];
      for (const [name, pkg] of packages) {
        const componentName = pkg.name.split('/').pop();
        exports.push(`export { default as ${componentName} } from '${pkg.name}';`);
      }
      return exports.join('\n');
    }
  }]
});
```

## License

MIT