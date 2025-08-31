# Migration Guide

## Migrating from scripts/vite-plugin-package-reader.ts

This guide helps you migrate from the old implementation to the new `@hierarchidb/tools-vite-plugin-package-reader` package.

### Step 1: Install the Package

First, add the new package to your dependencies:

```bash
pnpm add @hierarchidb/tools-vite-plugin-package-reader
```

### Step 2: Update vite.config.ts

Replace the old import and configuration:

#### Before (Old Implementation)

```typescript
// app/vite.config.ts
import { vitePluginPackageReader } from '../scripts/vite-plugin-package-reader';
import * as path from 'path';

export default defineConfig({
  plugins: [
    vitePluginPackageReader({
      rootDir: path.resolve(__dirname, '..'),
      pluginPattern: /@hierarchidb\/node-type-.*-plugin$/
    }),
    // ... other plugins
  ]
});
```

#### After (New Implementation - Simple)

```typescript
// app/vite.config.ts
import { vitePluginPackageReader } from '@hierarchidb/tools-vite-plugin-package-reader';
import { hierarchiDBPreset } from '@hierarchidb/tools-vite-plugin-package-reader/presets';

export default defineConfig({
  plugins: [
    vitePluginPackageReader(hierarchiDBPreset()),
    // ... other plugins
  ]
});
```

#### After (New Implementation - Customized)

```typescript
// app/vite.config.ts
import { vitePluginPackageReader, RegexStrategy } from '@hierarchidb/tools-vite-plugin-package-reader';
import { 
  createPluginDefinitionPipeline,
  createPluginVirtualModule 
} from '@hierarchidb/tools-vite-plugin-package-reader/presets';
import * as path from 'path';

export default defineConfig({
  plugins: [
    vitePluginPackageReader({
      rootDir: path.resolve(__dirname, '..'),
      
      strategies: [
        new RegexStrategy({
          name: 'hierarchidb-plugins',
          pattern: /@hierarchidb\/node-type-.*-plugin$/,
          metadataExtractor: (pkg) => ({
            nodeType: pkg.name.replace('@hierarchidb/', '').replace('-plugin', ''),
            config: pkg.hierarchidb?.plugin
          })
        })
      ],
      
      pipeline: createPluginDefinitionPipeline(),
      
      virtualModules: [createPluginVirtualModule()],
      
      monorepo: {
        packages: ['packages/node-type/*'],
        usePnpmWorkspace: true
      },
      
      logger: {
        level: 'info',
        prefix: '[HierarchiDB]'
      }
    }),
    // ... other plugins
  ]
});
```

### Step 3: Update Import Statements

If your code imports from the virtual module, update the import path:

#### Before

```typescript
// The old implementation might not have had virtual modules
// You would have accessed the plugin API directly
```

#### After

```typescript
// Import from virtual module
import pluginDefinitions from 'virtual:plugin-definitions';

// Use the plugin definitions
pluginDefinitions.forEach(plugin => {
  console.log(`Loading plugin: ${plugin.name} v${plugin.version}`);
});
```

### Step 4: Access Plugin Data via API

The new implementation provides a robust API:

```typescript
// In a custom Vite plugin or build script
export function myCustomPlugin(): Plugin {
  let packageReaderApi: any;
  
  return {
    name: 'my-custom-plugin',
    
    configResolved(config) {
      // Get the package reader plugin
      const packageReader = config.plugins.find(
        p => p.name === '@hierarchidb/tools-vite-plugin-package-reader'
      );
      
      if (packageReader && 'api' in packageReader) {
        packageReaderApi = packageReader.api;
      }
    },
    
    buildStart() {
      if (packageReaderApi) {
        // Access detected packages
        const packages = packageReaderApi.getPackages();
        console.log(`Found ${packages.size} packages`);
        
        // Access transformed data
        const transformed = packageReaderApi.getTransformed();
        console.log('Transformed data:', transformed);
      }
    }
  };
}
```

### Step 5: Clean Up Old Files

Once migration is complete and tested:

1. Remove the old implementation file:
   ```bash
   rm scripts/vite-plugin-package-reader.ts
   ```

2. Update any scripts that referenced the old file

3. Update documentation to reference the new package

## Feature Comparison

| Feature | Old Implementation | New Package |
|---------|-------------------|-------------|
| Package Detection | ✅ Basic regex | ✅ Multiple strategies |
| Caching | ✅ Simple Map | ✅ TTL-based cache |
| Virtual Modules | ❌ | ✅ Full support |
| Type Generation | ❌ | ✅ Auto-generated |
| HMR Support | ❌ | ✅ Full support |
| Monorepo Support | ⚠️ Limited | ✅ Full support |
| Extensibility | ❌ | ✅ Hooks & strategies |
| Logging | ⚠️ Basic | ✅ Configurable |
| Dependency Resolution | ❌ | ✅ Topological sort |

## Troubleshooting

### Issue: Packages not detected

Make sure your strategy pattern matches your package names:

```typescript
strategies: [
  new RegexStrategy({
    name: 'debug',
    pattern: /@hierarchidb\/node-type-.*-plugin$/,
  })
]
```

Add verbose logging to debug:

```typescript
logger: {
  level: 'debug',
  prefix: '[PackageReader]'
}
```

### Issue: Virtual module not found

Ensure you're using the correct import syntax:

```typescript
// Correct
import data from 'virtual:plugin-definitions';

// Incorrect
import data from 'plugin-definitions';
```

### Issue: TypeScript errors

The new package generates TypeScript definitions automatically. If you're seeing errors:

1. Ensure your `tsconfig.json` includes the virtual module types
2. Restart your TypeScript language service
3. Clear your build cache

## Benefits of Migration

1. **Better Performance**: Improved caching and dependency resolution
2. **More Flexible**: Support for multiple detection strategies
3. **Type Safety**: Auto-generated TypeScript definitions
4. **Better DX**: HMR support and comprehensive logging
5. **Future-Proof**: Maintained as a separate package with versioning
6. **Extensible**: Hook system for custom logic
7. **Well-Tested**: Comprehensive test coverage

## Need Help?

If you encounter issues during migration:

1. Check the [README](../README.md) for detailed API documentation
2. Review the [examples](./basic-usage.ts) for common patterns
3. File an issue in the repository with your specific use case