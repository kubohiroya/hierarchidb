#!/bin/bash

echo "=== Updating all package names to reflect directory structure ==="

# Common packages
echo "Updating common packages..."
sed -i '' 's/"name": "@hierarchidb\/core"/"name": "@hierarchidb\/common-core"/' packages/common/core/package.json
sed -i '' 's/"name": "@hierarchidb\/api"/"name": "@hierarchidb\/common-api"/' packages/common/api/package.json

# Runtime packages  
echo "Updating runtime packages..."
sed -i '' 's/"name": "@hierarchidb\/worker"/"name": "@hierarchidb\/runtime-worker"/' packages/runtime/worker/package.json
sed -i '' 's/"name": "@hierarchidb\/fetch-metadata"/"name": "@hierarchidb\/runtime-fetch-metadata"/' packages/runtime/fetch-metadata/package.json
sed -i '' 's/"name": "@hierarchidb\/datasource"/"name": "@hierarchidb\/runtime-datasource"/' packages/runtime/datasource/package.json 2>/dev/null
sed -i '' 's/"name": "@hierarchidb\/landingpage"/"name": "@hierarchidb\/runtime-landingpage"/' packages/runtime/landingpage/package.json 2>/dev/null
sed -i '' 's/"name": "@hierarchidb\/tour"/"name": "@hierarchidb\/runtime-tour"/' packages/runtime/tour/package.json 2>/dev/null

# UI packages remain with ui- prefix
echo "UI packages keep their ui- prefix..."

# Backend packages - keep simple names
echo "Backend packages keep simple names..."
[ -f packages/backend/bff/package.json ] && sed -i '' 's/"name": ".*"/"name": "@hierarchidb\/bff"/' packages/backend/bff/package.json
[ -f packages/backend/cors-proxy/package.json ] && sed -i '' 's/"name": ".*"/"name": "@hierarchidb\/cors-proxy"/' packages/backend/cors-proxy/package.json

# Plugin packages with -plugin suffix
echo "Updating plugin packages..."
for plugin in folder basemap stylemap shape; do
  if [ -f "packages/node-type-plugin/$plugin/package.json" ]; then
    sed -i '' "s/\"name\": \"@hierarchidb\/node-type-$plugin\"/\"name\": \"@hierarchidb\/node-type-$plugin-plugin\"/" \
      "packages/node-type-plugin/$plugin/package.json"
  fi
done

if [ -f "packages/feature-plugin/import-export/package.json" ]; then
  sed -i '' 's/"name": "@hierarchidb\/feature-import-export"/"name": "@hierarchidb\/feature-import-export-plugin"/' \
    "packages/feature-plugin/import-export/package.json"
fi

echo "=== Package name update complete ==="