#!/bin/bash

echo "=== Fixing tsconfig.json extends paths ==="

# For packages/common/*
find packages/common -name "tsconfig*.json" -exec sed -i '' \
  's|"../../tsconfig.base.json"|"../../../tsconfig.base.json"|g' {} \;

# For packages/runtime/*
find packages/runtime -name "tsconfig*.json" -exec sed -i '' \
  's|"../../tsconfig.base.json"|"../../../tsconfig.base.json"|g' {} \;

# For packages/ui/* (not treeconsole)
find packages/ui -maxdepth 2 -name "tsconfig*.json" -exec sed -i '' \
  's|"../../tsconfig.base.json"|"../../../tsconfig.base.json"|g' {} \;

# For packages/ui/treeconsole/*
find packages/ui/treeconsole -name "tsconfig*.json" -exec sed -i '' \
  's|"../../tsconfig.base.json"|"../../../../tsconfig.base.json"|g' {} \;

# For packages/backend/*
find packages/backend -name "tsconfig*.json" -exec sed -i '' \
  's|"../../tsconfig.base.json"|"../../../tsconfig.base.json"|g' {} \;

# For packages/node-type-plugin/*
find packages/node-type-plugin -name "tsconfig*.json" -exec sed -i '' \
  's|"../../tsconfig.base.json"|"../../../tsconfig.base.json"|g' {} \;

# For packages/feature-plugin/*
find packages/feature-plugin -name "tsconfig*.json" -exec sed -i '' \
  's|"../../tsconfig.base.json"|"../../../tsconfig.base.json"|g' {} \;

# For _app/
if [ -f app/tsconfig.json ]; then
  sed -i '' 's|"../../tsconfig.base.json"|"../tsconfig.base.json"|g' app/tsconfig.json
fi

echo "=== tsconfig path fix complete ==="