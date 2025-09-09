#!/usr/bin/env bash
set -euo pipefail

echo "[dep-fence] Upgrading to ^0.2.0 and running checks..."

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required" >&2
  exit 2
fi

# Upgrade dep-fence to ^0.2.0 (devDependency)
pnpm up dep-fence@^0.2.0 -D

echo "dep-fence version:" $(pnpm exec dep-fence --version || true)

mkdir -p reports

echo "[dep-fence] Running in strict mode..."
set +e
pnpm exec dep-fence --strict | tee reports/dep-fence.txt
status=${PIPESTATUS[0]}
set -e

echo "[dep-fence] Writing JSON report..."
pnpm exec dep-fence --json > reports/dep-fence.json || true

echo "[dep-fence] Report saved to reports/dep-fence.{txt,json}"
exit ${status}

