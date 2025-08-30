#!/bin/bash

echo "=== Starting package reorganization ==="

# Move core and api to common
echo "Moving core and api to /packages/common..."
mv packages/core packages/common/core
mv packages/api packages/common/api

# Move worker and fetch-metadata to runtime
echo "Moving worker and fetch-metadata to /packages/runtime..."
mv packages/worker packages/runtime/worker
mv packages/fetch-metadata packages/runtime/fetch-metadata

# Move _app-* to runtime (removing _app- prefix)
echo "Moving app-* packages to /packages/runtime..."
[ -d packages/_app-datasource ] && mv packages/_app-datasource packages/runtime/datasource
[ -d packages/_app-landingpage ] && mv packages/_app-landingpage packages/runtime/landingpage
[ -d packages/_app-tour ] && mv packages/_app-tour packages/runtime/tour

# Move ui-treeconsole-* to ui/treeconsole (removing ui-treeconsole- prefix)
echo "Moving ui-treeconsole-* to /packages/ui/treeconsole..."
mv packages/ui-treeconsole-base packages/ui/treeconsole/base
mv packages/ui-treeconsole-breadcrumb packages/ui/treeconsole/breadcrumb
mv packages/ui-treeconsole-footer packages/ui/treeconsole/footer
mv packages/ui-treeconsole-speeddial packages/ui/treeconsole/speeddial
mv packages/ui-treeconsole-toolbar packages/ui/treeconsole/toolbar
mv packages/ui-treeconsole-trashbin packages/ui/treeconsole/trashbin
mv packages/ui-treeconsole-treetable packages/ui/treeconsole/treetable

# Move other ui-* packages to ui/ (removing ui- prefix)
echo "Moving ui-* packages to /packages/ui..."
for dir in packages/ui-*; do
  if [ -d "$dir" ]; then
    basename=$(basename "$dir" | sed 's/^ui-//')
    mv "$dir" "packages/ui/$basename"
  fi
done

# Move main _app to /_app
echo "Moving main app to /app..."
mv packages/_app _app/

echo "=== Directory structure reorganization complete ==="#