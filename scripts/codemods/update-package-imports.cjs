/**
 * JSCodeshift transform to update package imports for the new hierarchy
 */

const packageMappings = {
  '@hierarchidb/core': '@hierarchidb/00-core',
  '@hierarchidb/api': '@hierarchidb/01-api',
  '@hierarchidb/worker': '@hierarchidb/02-worker',
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
  '@hierarchidb/app': '@hierarchidb/30-app',
  '@hierarchidb/backend-bff': '@hierarchidb/bff',
  '@hierarchidb/backend-cors-proxy': '@hierarchidb/cors-proxy',
};

module.exports = function transformer(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);
  let modified = false;

  // Update import declarations
  root.find(j.ImportDeclaration).forEach(path => {
    const source = path.value.source.value;
    
    // Check if this import needs to be updated
    Object.entries(packageMappings).forEach(([oldPkg, newPkg]) => {
      if (source === oldPkg || source.startsWith(oldPkg + '/')) {
        const newSource = source.replace(oldPkg, newPkg);
        path.value.source.value = newSource;
        modified = true;
      }
    });
  });

  // Update require calls
  root.find(j.CallExpression, {
    callee: { name: 'require' }
  }).forEach(path => {
    if (path.value.arguments.length > 0 && path.value.arguments[0].type === 'Literal') {
      const source = path.value.arguments[0].value;
      
      Object.entries(packageMappings).forEach(([oldPkg, newPkg]) => {
        if (source === oldPkg || source.startsWith(oldPkg + '/')) {
          const newSource = source.replace(oldPkg, newPkg);
          path.value.arguments[0].value = newSource;
          modified = true;
        }
      });
    }
  });

  // Update dynamic imports
  root.find(j.CallExpression, {
    callee: { type: 'Import' }
  }).forEach(path => {
    if (path.value.arguments.length > 0 && path.value.arguments[0].type === 'Literal') {
      const source = path.value.arguments[0].value;
      
      Object.entries(packageMappings).forEach(([oldPkg, newPkg]) => {
        if (source === oldPkg || source.startsWith(oldPkg + '/')) {
          const newSource = source.replace(oldPkg, newPkg);
          path.value.arguments[0].value = newSource;
          modified = true;
        }
      });
    }
  });

  // Update export ... from statements
  root.find(j.ExportNamedDeclaration).forEach(path => {
    if (path.value.source) {
      const source = path.value.source.value;
      
      Object.entries(packageMappings).forEach(([oldPkg, newPkg]) => {
        if (source === oldPkg || source.startsWith(oldPkg + '/')) {
          const newSource = source.replace(oldPkg, newPkg);
          path.value.source.value = newSource;
          modified = true;
        }
      });
    }
  });

  // Update export * from statements
  root.find(j.ExportAllDeclaration).forEach(path => {
    if (path.value.source) {
      const source = path.value.source.value;
      
      Object.entries(packageMappings).forEach(([oldPkg, newPkg]) => {
        if (source === oldPkg || source.startsWith(oldPkg + '/')) {
          const newSource = source.replace(oldPkg, newPkg);
          path.value.source.value = newSource;
          modified = true;
        }
      });
    }
  });

  return modified ? root.toSource() : null;
};