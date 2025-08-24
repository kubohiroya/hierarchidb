#!/bin/bash

echo "=== Updating plugin package names and import paths ==="

# Update node-type plugin package names
for plugin in folder basemap stylemap shape; do
  echo "Updating node-type-plugin: $plugin"
  
  # Update package.json name
  if [ -f "packages/node-type-plugins/$plugin/package.json" ]; then
    sed -i '' "s|\"@hierarchidb/plugin-$plugin\"|\"@hierarchidb/node-type-$plugin\"|g" \
      "packages/node-type-plugins/$plugin/package.json"
  fi
done

# Update feature plugin package names  
echo "Updating feature-plugin: import-export"
if [ -f "packages/feature-plugins/import-export/package.json" ]; then
  sed -i '' 's|"@hierarchidb/plugin-import-export"|"@hierarchidb/feature-import-export"|g' \
    "packages/feature-plugins/import-export/package.json"
fi

# Update all imports in TypeScript/JavaScript files
echo "Updating imports across the codebase..."

# Node-type plugins
for plugin in folder basemap stylemap shape; do
  find packages -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
    -exec sed -i '' \
    -e "s|'@hierarchidb/plugin-$plugin'|'@hierarchidb/node-type-$plugin'|g" \
    -e "s|\"@hierarchidb/plugin-$plugin\"|\"@hierarchidb/node-type-$plugin\"|g" {} \;
done

# Feature plugins
find packages -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
  -exec sed -i '' \
  -e "s|'@hierarchidb/plugin-import-export'|'@hierarchidb/feature-import-export'|g" \
  -e "s|\"@hierarchidb/plugin-import-export\"|\"@hierarchidb/feature-import-export\"|g" {} \;

# Update package.json dependencies
echo "Updating package.json dependencies..."
find packages -name "package.json" -exec sed -i '' \
  -e "s|\"@hierarchidb/plugin-folder\"|\"@hierarchidb/node-type-folder\"|g" \
  -e "s|\"@hierarchidb/plugin-basemap\"|\"@hierarchidb/node-type-basemap\"|g" \
  -e "s|\"@hierarchidb/plugin-stylemap\"|\"@hierarchidb/node-type-stylemap\"|g" \
  -e "s|\"@hierarchidb/plugin-shape\"|\"@hierarchidb/node-type-shape\"|g" \
  -e "s|\"@hierarchidb/plugin-import-export\"|\"@hierarchidb/feature-import-export\"|g" {} \;

echo "=== Plugin path update complete! ==="