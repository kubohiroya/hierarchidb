#!/bin/bash

# Rename 00-core to core and 01-api to api

echo "Starting package rename: 00-core → core, 01-api → api"

# Step 1: Update all package.json files
echo "Step 1: Updating package.json dependencies..."
find packages -name "package.json" -exec sed -i '' \
  -e 's/"@hierarchidb\/00-core"/"@hierarchidb\/core"/g' \
  -e 's/"@hierarchidb\/01-api"/"@hierarchidb\/api"/g' {} \;

# Step 2: Update all TypeScript/JavaScript imports
echo "Step 2: Updating TypeScript/JavaScript imports..."
find packages -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.mjs" -o -name "*.cjs" \) \
  -exec sed -i '' \
  -e "s/'@hierarchidb\/00-core'/'@hierarchidb\/core'/g" \
  -e 's/"@hierarchidb\/00-core"/"@hierarchidb\/core"/g' \
  -e "s/'@hierarchidb\/01-api'/'@hierarchidb\/api'/g" \
  -e 's/"@hierarchidb\/01-api"/"@hierarchidb\/api"/g' {} \;

# Step 3: Update configuration files
echo "Step 3: Updating configuration files..."
find packages -type f \( -name "tsconfig*.json" -o -name "vitest.config.*" -o -name "vite.config.*" -o -name "tsup.config.*" \) \
  -exec sed -i '' \
  -e 's/00-core/core/g' \
  -e 's/01-api/api/g' {} \;

# Step 4: Update turbo.json
echo "Step 4: Updating turbo.json..."
if [ -f "turbo.json" ]; then
  sed -i '' \
    -e 's/"@hierarchidb\/00-core"/"@hierarchidb\/core"/g' \
    -e 's/"@hierarchidb\/01-api"/"@hierarchidb\/api"/g' turbo.json
fi

# Step 5: Update pnpm-workspace.yaml (if patterns are used)
echo "Step 5: Checking pnpm-workspace.yaml..."
if [ -f "pnpm-workspace.yaml" ]; then
  sed -i '' \
    -e 's/00-core/core/g' \
    -e 's/01-api/api/g' pnpm-workspace.yaml
fi

# Step 6: Rename directories
echo "Step 6: Renaming directories..."
if [ -d "packages/00-core" ]; then
  git mv packages/00-core packages/core
fi
if [ -d "packages/01-api" ]; then
  git mv packages/01-api packages/api
fi

echo "Package rename complete!"
echo ""
echo "Next steps:"
echo "1. Run: pnpm install"
echo "2. Run: pnpm typecheck"
echo "3. Run: pnpm test:run"
echo "4. Commit changes"