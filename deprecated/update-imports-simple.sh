#!/bin/bash

echo "=== Updating all imports and dependencies ==="

# Update each package mapping one by one
update_package() {
  local old_pkg="$1"
  local new_pkg="$2"
  
  echo "  $old_pkg → $new_pkg"
  
  # Update package.json files
  find . -name "package.json" -not -path "*/node_modules/*" -exec sed -i '' \
    -e "s|\"$old_pkg\"|\"$new_pkg\"|g" {} \;
  
  # Update TS/JS imports
  find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
    -not -path "*/node_modules/*" -not -path "*/dist/*" -exec sed -i '' \
    -e "s|'$old_pkg'|'$new_pkg'|g" \
    -e "s|\"$old_pkg\"|\"$new_pkg\"|g" {} \;
  
  # Update config files
  find . -type f \( -name "tsconfig*.json" -o -name "vitest.config.*" -o -name "vite.config.*" \) \
    -not -path "*/node_modules/*" -exec sed -i '' \
    -e "s|$old_pkg|$new_pkg|g" {} \;
}

echo "Updating common packages..."
update_package "@hierarchidb/core" "@hierarchidb/common-core"
update_package "@hierarchidb/api" "@hierarchidb/common-api"

echo "Updating runtime packages..."
update_package "@hierarchidb/worker" "@hierarchidb/runtime-worker"
update_package "@hierarchidb/fetch-metadata" "@hierarchidb/runtime-fetch-metadata"
update_package "@hierarchidb/datasource" "@hierarchidb/runtime-datasource"
update_package "@hierarchidb/landingpage" "@hierarchidb/runtime-landingpage"
update_package "@hierarchidb/tour" "@hierarchidb/runtime-tour"

echo "Updating plugin packages..."
update_package "@hierarchidb/node-type-folder" "@hierarchidb/node-type-folder-plugin"
update_package "@hierarchidb/node-type-basemap" "@hierarchidb/node-type-basemap-plugin"
update_package "@hierarchidb/node-type-stylemap" "@hierarchidb/node-type-stylemap-plugin"
update_package "@hierarchidb/node-type-shape" "@hierarchidb/node-type-shape-plugin"
update_package "@hierarchidb/feature-import-export" "@hierarchidb/feature-import-export-plugin"

echo "=== Import and dependency update complete ==="