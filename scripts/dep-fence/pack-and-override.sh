#!/usr/bin/env bash
set -euo pipefail

# Use this on an online machine to vendor dep-fence@^0.2.0 as a tarball,
# then commit the tarball or distribute it to offline environments.

PKG='dep-fence@^0.2.0'
OUT_DIR="tools/vendor"
mkdir -p "$OUT_DIR"

echo "Packing $PKG ..."
TARBALL=$(npm pack "$PKG" 2>/dev/null | tail -n1)
mv -f "$TARBALL" "$OUT_DIR/dep-fence-0.2.0.tgz"

cat <<EOF
Vendored: $OUT_DIR/dep-fence-0.2.0.tgz

To consume it offline, add this to your package.json overrides:

  "overrides": {
    "dep-fence": "file:$OUT_DIR/dep-fence-0.2.0.tgz"
  }

Then run: pnpm i
EOF

