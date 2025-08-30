#!/bin/bash

echo "=== Removing all 2-digit prefixes from package names ==="
echo "Processing in order from longest to shortest names..."

# Define the mapping (longest first)
declare -a mappings=(
  "12-ui-treeconsole-breadcrumb:ui-treeconsole-breadcrumb"
  "12-ui-treeconsole-treetable:ui-treeconsole-treetable"
  "12-ui-treeconsole-speeddial:ui-treeconsole-speeddial"
  "12-ui-treeconsole-trashbin:ui-treeconsole-trashbin"
  "12-ui-treeconsole-toolbar:ui-treeconsole-toolbar"
  "12-ui-treeconsole-footer:ui-treeconsole-footer"
  "20-plugin-import-export:plugin-import-export"
  "13-ui-treeconsole-base:ui-treeconsole-base"
  "10-ui-accordion-config:ui-accordion-config"
  "10-ui-country-select:ui-country-select"
  "10-ui-lru-splitview:ui-lru-splitview"
  "30-app-landingpage:app-landingpage"
  "20-plugin-stylemap:plugin-stylemap"
  "20-plugin-basemap:plugin-basemap"
  "20-app-datasource:app-datasource"
  "11-ui-csv-extract:ui-csv-extract"
  "02-fetch-metadata:fetch-metadata"
  "20-plugin-folder:plugin-folder"
  "11-ui-navigation:ui-navigation"
  "11-ui-monitoring:ui-monitoring"
  "20-plugin-shape:plugin-shape"
  "11-ui-usermenu:ui-usermenu"
  "10-ui-routing:ui-routing"
  "11-ui-layout:ui-layout"
  "11-ui-dialog:ui-dialog"
  "10-ui-client:ui-client"
  "30-app-tour:app-tour"
  "10-ui-theme:ui-theme"
  "99-backend:backend"
  "11-ui-tour:ui-tour"
  "11-ui-file:ui-file"
  "10-ui-i18n:ui-i18n"
  "10-ui-core:ui-core"
  "10-ui-auth:ui-auth"
  "11-ui-map:ui-map"
  "02-worker:worker"
  "30-app:app"
)

# Step 1: Update all package.json files
echo "Step 1: Updating package.json dependencies..."
for mapping in "${mappings[@]}"; do
  old_name="${mapping%%:*}"
  new_name="${mapping##*:}"
  echo "  Replacing @hierarchidb/$old_name with @hierarchidb/$new_name"
  
  find packages -name "package.json" -exec sed -i '' \
    -e "s|\"@hierarchidb/$old_name\"|\"@hierarchidb/$new_name\"|g" {} \;
done

# Step 2: Update all TypeScript/JavaScript imports
echo "Step 2: Updating TypeScript/JavaScript imports..."
for mapping in "${mappings[@]}"; do
  old_name="${mapping%%:*}"
  new_name="${mapping##*:}"
  echo "  Replacing imports of @hierarchidb/$old_name"
  
  find packages -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.mjs" -o -name "*.cjs" \) \
    -exec sed -i '' \
    -e "s|'@hierarchidb/$old_name'|'@hierarchidb/$new_name'|g" \
    -e "s|\"@hierarchidb/$old_name\"|\"@hierarchidb/$new_name\"|g" {} \;
done

# Step 3: Update configuration files
echo "Step 3: Updating configuration files..."
for mapping in "${mappings[@]}"; do
  old_name="${mapping%%:*}"
  new_name="${mapping##*:}"
  echo "  Updating configs for $old_name"
  
  find packages -type f \( -name "tsconfig*.json" -o -name "vitest.config.*" -o -name "vite.config.*" -o -name "tsup.config.*" \) \
    -exec sed -i '' -e "s|$old_name|$new_name|g" {} \;
done

# Step 4: Update turbo.json
echo "Step 4: Updating turbo.json..."
if [ -f "turbo.json" ]; then
  for mapping in "${mappings[@]}"; do
    old_name="${mapping%%:*}"
    new_name="${mapping##*:}"
    sed -i '' -e "s|\"@hierarchidb/$old_name\"|\"@hierarchidb/$new_name\"|g" turbo.json
  done
fi

# Step 5: Rename directories using git mv
echo "Step 5: Renaming directories..."
for mapping in "${mappings[@]}"; do
  old_name="${mapping%%:*}"
  new_name="${mapping##*:}"
  
  if [ -d "packages/$old_name" ]; then
    echo "  Renaming packages/$old_name to packages/$new_name"
    git mv "packages/$old_name" "packages/$new_name"
  fi
done

echo "=== Package prefix removal complete! ==="
echo ""
echo "Next steps:"
echo "1. Run: pnpm install"
echo "2. Run: pnpm typecheck"
echo "3. Run: pnpm test:run"
echo "4. Commit changes"