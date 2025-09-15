#!/usr/bin/env bash
set -euo pipefail
ROOT=$(pwd)
export ENABLE_INTEGRATION_TESTS=false
export ENABLE_SHAPE_DEEP_TESTS=false

PLUGINS=(
  packages/node-type/base-plugin
  packages/node-type/basemap-plugin
  packages/node-type/folder-plugin
  packages/node-type/location-plugin
  packages/node-type/linker-plugin
  packages/node-type/resolver-plugin
  packages/node-type/route-plugin
  packages/node-type/shape-plugin
  packages/node-type/spreadsheet-plugin
  packages/node-type/styler-plugin
)

RESULT_JSON=plugin-test-results.json
: > $RESULT_JSON

echo '[' >> $RESULT_JSON
FIRST=1

for P in "${PLUGINS[@]}"; do
  PKG_NAME=$(node -e "console.log(require(process.cwd()+'/'+'$P'+'/package.json').name)") || PKG_NAME=$(basename "$P")
  echo "== Running for $PKG_NAME ($P) =="
  TYPE_STATUS=ok
  TEST_STATUS=ok

  SAFE=$(echo "$PKG_NAME" | tr -c 'A-Za-z0-9_-' '_')
  # Typecheck
  if pnpm --filter "$PKG_NAME" typecheck >"/tmp/type_${SAFE}.out" 2>"/tmp/type_${SAFE}.err"; then
    TYPE_STATUS=ok
  else
    TYPE_STATUS=fail
  fi

  # Tests with coverage (allow no tests)
  if pnpm --filter "$PKG_NAME" -s test:run -- --coverage --passWithNoTests >"/tmp/test_${SAFE}.out" 2>"/tmp/test_${SAFE}.err"; then
    TEST_STATUS=ok
  else
    TEST_STATUS=fail
  fi

  # Read coverage summary if present
  COV_FILE="$P/coverage/coverage-summary.json"
  COV_OBJ="null"
  if [ -f "$COV_FILE" ]; then
    COV_OBJ=$(cat "$COV_FILE")
  fi

  # Append JSON entry
  if [ $FIRST -eq 1 ]; then FIRST=0; else echo ',' >> $RESULT_JSON; fi
  node -e '
    const fs=require("fs");
    const pkg=process.argv[1];
    const dir=process.argv[2];
    const typeStatus=process.argv[3];
    const testStatus=process.argv[4];
    const covPath=process.argv[5];
    let cov=null; try{ cov=JSON.parse(fs.readFileSync(covPath,"utf8")); } catch(e){}
    const obj={ package: pkg, dir, typecheck: typeStatus, test: testStatus, coverage: cov };
    process.stdout.write(JSON.stringify(obj));
  ' "$PKG_NAME" "$P" "$TYPE_STATUS" "$TEST_STATUS" "$COV_FILE" >> $RESULT_JSON

done

echo ']' >> $RESULT_JSON

echo "Wrote $RESULT_JSON"
