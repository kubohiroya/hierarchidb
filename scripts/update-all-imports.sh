#!/bin/bash

echo "=== Updating all imports and dependencies ==="

# Define all package mappings
declare -A mappings
mappings=(
  # Common
  ["@hierarchidb/core"]="@hierarchidb/common-core"
  ["@hierarchidb/api"]="@hierarchidb/common-api"
  
  # Runtime
  ["@hierarchidb/worker"]="@hierarchidb/runtime-worker"
  ["@hierarchidb/fetch-metadata"]="@hierarchidb/runtime-fetch-metadata"
  ["@hierarchidb/datasource"]="@hierarchidb/runtime-datasource"
  ["@hierarchidb/landingpage"]="@hierarchidb/runtime-landingpage"
  ["@hierarchidb/tour"]="@hierarchidb/runtime-tour"
  
  # Plugins with -plugin suffix
  ["@hierarchidb/node-type-folder"]="@hierarchidb/node-type-folder-plugin"
  ["@hierarchidb/node-type-basemap"]="@hierarchidb/node-type-basemap-plugin"
  ["@hierarchidb/node-type-stylemap"]="@hierarchidb/node-type-stylemap-plugin"
  ["@hierarchidb/node-type-shape"]="@hierarchidb/node-type-shape-plugin"
  ["@hierarchidb/feature-import-export"]="@hierarchidb/feature-import-export-plugin"
)

# Update package.json dependencies
echo "Updating package.json files..."
for old_pkg in "${!mappings[@]}"; do
  new_pkg="${mappings[$old_pkg]}"
  echo "  $old_pkg → $new_pkg"
  
  # Update in all package.json files
  find . -name "package.json" -not -path "*/node_modules/*" -exec sed -i '' \
    -e "s|\"$old_pkg\"|\"$new_pkg\"|g" {} \;
done

# Update TypeScript/JavaScript imports
echo "Updating TypeScript/JavaScript imports..."
for old_pkg in "${!mappings[@]}"; do
  new_pkg="${mappings[$old_pkg]}"
  
  # Update imports in all TS/JS files
  find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.mjs" -o -name "*.cjs" \) \
    -not -path "*/node_modules/*" -not -path "*/dist/*" -exec sed -i '' \
    -e "s|'$old_pkg'|'$new_pkg'|g" \
    -e "s|\"$old_pkg\"|\"$new_pkg\"|g" {} \;
done

# Update configuration files
echo "Updating configuration files..."
for old_pkg in "${!mappings[@]}"; do
  new_pkg="${mappings[$old_pkg]}"
  
  find . -type f \( -name "tsconfig*.json" -o -name "vitest.config.*" -o -name "vite.config.*" \) \
    -not -path "*/node_modules/*" -exec sed -i '' \
    -e "s|$old_pkg|$new_pkg|g" {} \;
done

echo "=== Import and dependency update complete ==="