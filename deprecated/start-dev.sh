#!/bin/bash

echo "Building dependencies..."
turbo run build --filter=@hierarchidb/ui-auth --filter=@hierarchidb/ui-usermenu

echo "Starting app dev server..."
cd app && pnpm dev