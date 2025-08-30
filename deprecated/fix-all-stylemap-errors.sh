#!/bin/bash

# Create a comprehensive fix file for stylemap-plugin
cd packages/node-type/stylemap-plugin

# 1. Add vitest imports to all test files at once
for file in src/__tests__/*.test.ts src/__tests__/**/*.test.ts; do
  if [ -f "$file" ]; then
    if ! grep -q "import.*vitest" "$file"; then
      sed -i '' '1i\
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";\
' "$file"
    fi
  fi
done

# 2. Fix all type imports from ui-csv-extract in one go
find src -name "*.ts" -o -name "*.tsx" | while read file; do
  # Remove CSVPreviewData and add missing types
  sed -i '' 's/CSVPreviewData,\s*//g' "$file"
  # Add CSVFilterRule if needed
  if grep -q "CSVFilterRule" "$file" && ! grep -q "import.*CSVFilterRule" "$file"; then
    sed -i '' '/import.*ui-csv-extract/s/from "@hierarchidb\/ui-csv-extract"/{ CSVFilterRule } from "@hierarchidb\/ui-csv-extract";\nimport type/g' "$file"
  fi
done

# 3. Fix all imports from spreadsheet-plugin
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|../../spreadsheet-plugin/src/|@hierarchidb/node-type-spreadsheet-plugin/src/|g'

# 4. Fix all test setup files
if [ -f "src/__tests__/setup.ts" ]; then
  sed -i '' 's/globalThis\[/(global as any)[/g' src/__tests__/setup.ts
fi

# 5. Fix unused parameters in one pass
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/\b\(afterCreate([^)]*\)node,/\1_node,/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/\b\(beforeDelete([^)]*\)node,/\1_node,/g'

# 6. Fix undefined checks
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/\([a-zA-Z_][a-zA-Z0-9_]*\)\.mock\.calls\[0\]\[0\]/\1.mock.calls[0]?.[0]/g'

# 7. Fix colorUtils test
if [ -f "src/__tests__/colorUtils.test.ts" ]; then
  sed -i '' 's/const h3 =/const _h3 =/g' src/__tests__/colorUtils.test.ts
  sed -i '' 's/parseFloat(match\[/parseFloat(match?.[/g' src/__tests__/colorUtils.test.ts
fi

# 8. Fix securityUtils 
if [ -f "src/utils/securityUtils.ts" ]; then
  sed -i '' 's/return \[a, b, c, d\]/return [a!, b!, c!, d!]/g' src/utils/securityUtils.ts
  sed -i '' 's/b << 16 | b << 8/b! << 16 | b! << 8/g' src/utils/securityUtils.ts
fi

# 9. Remove old handler file
rm -f src/handlers/StyleMapEntityHandler.old.ts

# 10. Fix FolderExtension imports
if [ -f "src/extensions/StyleMapFolderExtension.tsx" ]; then
  sed -i '' 's/BaseFolderPlugin,//g' src/extensions/StyleMapFolderExtension.tsx
  sed -i '' 's/FolderNodeDefinition,//g' src/extensions/StyleMapFolderExtension.tsx
  sed -i '' 's/DialogStepDefinition/any/g' src/extensions/StyleMapFolderExtension.tsx
  sed -i '' 's/createDialogStep/createStep/g' src/extensions/StyleMapFolderExtension.tsx
fi

echo "All fixes applied"
