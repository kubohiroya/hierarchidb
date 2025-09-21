#!/usr/bin/env bash
set -euo pipefail
PLUGINS=(packages/plugins/*-plugin)

json='['
first=1
for p in ${PLUGINS[@]}; do
  name=$(node -e "console.log(require(process.cwd()+'/'+'$p'+'/package.json').name)" || basename "$p")
  # counts
  src_count=$(find "$p/src" -type f \( -name '*.ts' -o -name '*.tsx' \) \
    ! -path '*/__tests__/*' ! -name '*.test.*' 2>/dev/null | wc -l | tr -d ' ')
  test_count=$(find "$p/src" -type f \( -name '*.test.ts' -o -name '*.test.tsx' -o -path '*/__tests__/*' \) 2>/dev/null | wc -l | tr -d ' ')
  # dir breakdown
  for d in ui worker services shared; do
    eval src_${d}=$(find "$p/src/$d" -type f -name "*.ts*" 2>/dev/null | wc -l | tr -d ' ')
    eval test_${d}=$(find "$p/src/$d" -type f \( -name "*.test.ts" -o -name "*.test.tsx" -o -path "*/__tests__/*" \) 2>/dev/null | wc -l | tr -d ' ')
  done
  entry=$(cat <<JSON
{"package":"$name","dir":"$p","files":{"src":$src_count,"tests":$test_count,"ui":{"src":${src_ui:-0},"tests":${test_ui:-0}},"worker":{"src":${src_worker:-0},"tests":${test_worker:-0}},"services":{"src":${src_services:-0},"tests":${test_services:-0}},"shared":{"src":${src_shared:-0},"tests":${test_shared:-0}}}}
JSON
)
  if [ $first -eq 1 ]; then first=0; else json+=','; fi
  json+=$entry
done
json+=']'
echo "$json" > plugin-test-inventory.json
 echo "Wrote plugin-test-inventory.json"
