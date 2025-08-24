/**
 * JSCodeshift transform to update package imports for the new hierarchy
 * TypeScript version
 */

import type { API, FileInfo, Options, Transform } from 'jscodeshift';

interface PackageMappings {
  [oldPackage: string]: string;
}

const packageMappings: PackageMappings = {
  '@hierarchidb/common-core': '@hierarchidb/00-core',
  '@hierarchidb/common-api': '@hierarchidb/01-api',
  '@hierarchidb/runtime-worker': '@hierarchidb/02-worker',
  '@hierarchidb/ui-core': '@hierarchidb/10-ui-core',
  '@hierarchidb/ui-client': '@hierarchidb/10-ui-client',
  '@hierarchidb/ui-auth': '@hierarchidb/10-ui-auth',
  '@hierarchidb/ui-i18n': '@hierarchidb/10-ui-i18n',
  '@hierarchidb/ui-routing': '@hierarchidb/10-ui-routing',
  '@hierarchidb/ui-layout': '@hierarchidb/11-ui-layout',
  '@hierarchidb/ui-navigation': '@hierarchidb/11-ui-navigation',
  '@hierarchidb/ui-file': '@hierarchidb/11-ui-file',
  '@hierarchidb/ui-monitoring': '@hierarchidb/11-ui-monitoring',
  '@hierarchidb/ui-tour': '@hierarchidb/11-ui-tour',
  '@hierarchidb/ui-usermenu': '@hierarchidb/11-ui-usermenu',
  '@hierarchidb/ui-treeconsole-base': '@hierarchidb/12-ui-treeconsole-base',
  '@hierarchidb/ui-treeconsole-simple': '@hierarchidb/12-ui-treeconsole-simple',
  '@hierarchidb/plugin-basemap': '@hierarchidb/20-plugin-basemap',
  '@hierarchidb/plugin-stylemap': '@hierarchidb/20-plugin-stylemap',
  '@hierarchidb/plugin-shapes': '@hierarchidb/20-plugin-shapes',
  '@hierarchidb/plugin-import-export': '@hierarchidb/20-plugin-import-export',
  '@hierarchidb/app': '@hierarchidb/30-_app',
  '@hierarchidb/backend-bff': '@hierarchidb/bff',
  '@hierarchidb/backend-cors-proxy': '@hierarchidb/cors-proxy',
};

const transform: Transform = (fileInfo: FileInfo, api: API, options?: Options) => {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);
  let modified = false;

  // Helper function to update import source
  const updateSource = (source: string): string | null => {
    for (const [oldPkg, newPkg] of Object.entries(packageMappings)) {
      if (source === oldPkg || source.startsWith(oldPkg + '/')) {
        return source.replace(oldPkg, newPkg);
      }
    }
    return null;
  };

  // Update import declarations
  root.find(j.ImportDeclaration).forEach((path) => {
    const source = path.value.source?.value;
    if (typeof source === 'string') {
      const newSource = updateSource(source);
      if (newSource && path.value.source) {
        path.value.source.value = newSource;
        modified = true;
      }
    }
  });

  // Update require calls
  root
    .find(j.CallExpression, {
      callee: { name: 'require' },
    })
    .forEach((path) => {
      const firstArg = path.value.arguments[0];
      if (firstArg && firstArg.type === 'Literal' && typeof firstArg.value === 'string') {
        const newSource = updateSource(firstArg.value);
        if (newSource) {
          firstArg.value = newSource;
          modified = true;
        }
      }
    });

  // Update dynamic imports - import()
  root.find(j.CallExpression).forEach((path) => {
    if (path.value.callee.type === 'Import') {
      const firstArg = path.value.arguments[0];
      if (firstArg && firstArg.type === 'Literal' && typeof firstArg.value === 'string') {
        const newSource = updateSource(firstArg.value);
        if (newSource) {
          firstArg.value = newSource;
          modified = true;
        }
      }
    }
  });

  // Update export ... from statements
  root.find(j.ExportNamedDeclaration).forEach((path) => {
    const source = path.value.source?.value;
    if (typeof source === 'string') {
      const newSource = updateSource(source);
      if (newSource && path.value.source) {
        path.value.source.value = newSource;
        modified = true;
      }
    }
  });

  // Update export * from statements
  root.find(j.ExportAllDeclaration).forEach((path) => {
    const source = path.value.source?.value;
    if (typeof source === 'string') {
      const newSource = updateSource(source);
      if (newSource && path.value.source) {
        path.value.source.value = newSource;
        modified = true;
      }
    }
  });

  return modified ? root.toSource() : null;
};

export default transform;

// For CommonJS compatibility when run with jscodeshift
module.exports = transform;
module.exports.default = transform;
