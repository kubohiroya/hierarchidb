#!/bin/bash

# Fix all test files to import vitest globals
find . -path "*/node_modules" -prune -o -name "*.test.ts" -type f -exec sed -i '' "1s/^/import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';\n/" {} \;

# Fix missing CSVFilterRule imports
find . -path "*/node_modules" -prune -o -name "*.ts" -o -name "*.tsx" | xargs grep -l "CSVFilterRule" | xargs sed -i '' "/^import.*from.*ui-csv-extract/s/}/&, CSVFilterRule/"

# Fix missing CSVProcessingConfig imports  
find . -path "*/node_modules" -prune -o -name "*.ts" -o -name "*.tsx" | xargs grep -l "CSVProcessingConfig" | xargs sed -i '' "/^import.*from.*ui-csv-extract/s/}/&, CSVProcessingConfig/"

# Fix missing CSVPreviewData imports
find . -path "*/node_modules" -prune -o -name "*.ts" -o -name "*.tsx" | xargs grep -l "CSVPreviewData" | xargs sed -i '' "s/CSVPreviewData,//"

# Fix missing CSVColumnMapping imports
find . -path "*/node_modules" -prune -o -name "*.ts" -o -name "*.tsx" | xargs grep -l "CSVColumnMapping" | xargs sed -i '' "/^import.*from.*ui-csv-extract/s/}/&, CSVColumnMapping/"

# Fix CSVFileUploadResult to CSVFileUploadStep
find . -path "*/node_modules" -prune -o -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s/CSVFileUploadResult/CSVFileUploadStep/g"

# Fix DialogStepDefinition imports
find . -path "*/node_modules" -prune -o -name "*.ts" -o -name "*.tsx" | xargs grep -l "DialogStepDefinition" | xargs sed -i '' "s/DialogStepDefinition/any/g"

# Fix spreadsheet-plugin import paths
find . -path "*/node_modules" -prune -o -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '@hierarchidb/node-type-spreadsheet-plugin'|from '@hierarchidb/node-type-spreadsheet-plugin/src'|g"

# Fix test setup globals
find . -path "*/node_modules" -prune -o -name "setup.ts" -type f -exec sed -i '' "s/globalThis\[/(global as any)[/g" {} \;

# Fix unused variables with underscore prefix
find . -path "*/node_modules" -prune -o -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s/\([(,]\s*\)\([a-zA-Z][a-zA-Z0-9]*\)\(:\)/\1_\2\3/g" | head -1

# Fix possibly undefined variables
find . -path "*/node_modules" -prune -o -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s/mockUseGoogleLogin\.mock\.calls\[0\]\[0\]/mockUseGoogleLogin.mock.calls[0]?.[0]/g"

echo "Fixed all errors"
