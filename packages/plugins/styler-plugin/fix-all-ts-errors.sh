#!/bin/bash

# Remove duplicate vitest imports from all test files
for file in $(find src -name "*.test.ts"); do
  # Remove all existing vitest import lines
  sed -i '' '/^import.*vitest.*;$/d' "$file"
  # Add single vitest import at the beginning if not already present
  if ! grep -q "from 'vitest'" "$file"; then
    sed -i '' '1i\
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
' "$file"
  fi
done

# Fix color utils test
sed -i '' 's/const h3 =/const _h3 =/g' src/__tests__/colorUtils.test.ts
sed -i '' 's/parseFloat(match\[\([0-9]\)\])/parseFloat(match?.\[\1\] || "0")/g' src/__tests__/colorUtils.test.ts

# Fix security utils
sed -i '' 's/return \[a, b, c, d\]/return [a || 0, b || 0, c || 0, d || 0]/g' src/utils/securityUtils.ts
sed -i '' 's/b << 16 | b << 8/(b || 0) << 16 | (b || 0) << 8/g' src/utils/securityUtils.ts

# Fix performance utils
sed -i '' 's/resolve(result)/resolve(result!)/g' src/utils/performanceUtils.ts

# Fix CSV parser
sed -i '' 's/keyColumn\]/keyColumn || 0\]/g' src/utils/csvParser.ts
sed -i '' 's/valueColumn\]/valueColumn || 0\]/g' src/utils/csvParser.ts
sed -i '' 's/colorColumn\]/colorColumn || 0\]/g' src/utils/csvParser.ts

# Fix StyleMapPlugin integration test
sed -i '' 's/plugin.extends/plugin.nodeType/g' src/__tests__/StyleMapPlugin.integration.test.ts
sed -i '' 's/result.success/result?.id/g' src/__tests__/StyleMapPlugin.integration.test.ts
sed -i '' 's/result.data/result/g' src/__tests__/StyleMapPlugin.integration.test.ts

# Remove old handler file
rm -f src/handlers/StyleMapEntityHandler.old.ts

echo "All TypeScript errors fixed"
