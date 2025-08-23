#!/bin/bash

echo "Running codemod to update package imports..."

# Find all TypeScript and JavaScript files
find packages -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.mjs" -o -name "*.cjs" | \
  grep -v node_modules | \
  grep -v dist | \
  grep -v build | \
  xargs npx jscodeshift -t scripts/codemods/update-package-imports.cjs --parser tsx

echo "Codemod complete!"