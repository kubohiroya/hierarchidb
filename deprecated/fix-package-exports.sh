#!/bin/bash

# Fix package.json files that incorrectly reference index.mjs
# tsup outputs ESM as .js and CommonJS as .cjs by default

echo "Fixing package.json export configurations..."

find packages -name "package.json" -exec grep -l '"import": "./dist/index.mjs"' {} \; | while read file; do
  echo "Fixing: $file"
  
  # Fix main field: index.js -> index.cjs
  sed -i '' 's/"main": "dist\/index.js"/"main": "dist\/index.cjs"/g' "$file"
  
  # Fix module field: index.mjs -> index.js
  sed -i '' 's/"module": "dist\/index.mjs"/"module": "dist\/index.js"/g' "$file"
  
  # Fix exports.import: index.mjs -> index.js
  sed -i '' 's/"import": ".\/dist\/index.mjs"/"import": ".\/dist\/index.js"/g' "$file"
  
  # Fix exports.require: index.js -> index.cjs
  sed -i '' 's/"require": ".\/dist\/index.js"/"require": ".\/dist\/index.cjs"/g' "$file"
done

echo "Done! All package.json files have been updated."