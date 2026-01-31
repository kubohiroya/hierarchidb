# Package Dependency Graph

Generated on: 2025-11-02T23:14:27.496Z

- Scope: workspace internal dependencies only
- Arrows point from depender → dependency
- Groups reflect top-level folders under `packages/`, `app/`, and `plugins/`
- Cycles detected: none
```mermaid
graph LR
  subgraph G_app["app"]
    N0["@hierarchidb/app"]
  end
  subgraph G_app_vite_plugins["app/vite-plugins"]
    N1["@hierarchidb/vite-plugin-hierarchidb-plugin-alias"]
  end
  subgraph G_packages_backend["packages/backend"]
    N2["@hierarchidb/bff"]
    N3["@hierarchidb/cors-proxy"]
  end
  subgraph G_packages_batch_runtime_services["packages/batch-runtime-services"]
    N4["@hierarchidb/batch-runtime-services"]
  end
  subgraph G_packages_common["packages/common"]
    N5["@hierarchidb/batch-api"]
    N6["@hierarchidb/common-auth"]
    N7["@hierarchidb/common-types"]
  end
  subgraph G_packages_components["packages/components"]
    N8["@hierarchidb/components"]
  end
  subgraph G_packages_feature["packages/feature"]
    N9["@hierarchidb/auth-recovery"]
    N10["@hierarchidb/batch"]
    N12["@hierarchidb/download"]
    N14["@hierarchidb/fetch-save-metadata"]
    N15["@hierarchidb/import-export"]
    N16["@hierarchidb/map-adapter"]
    N17["@hierarchidb/map-source"]
    N18["@hierarchidb/route-resolver"]
    N19["@hierarchidb/route-searoute"]
    N20["@hierarchidb/tabular-source"]
    N21["@hierarchidb/tabular-source-xlsx"]
    N22["@hierarchidb/tabular-store"]
    N23["@hierarchidb/tag"]
  end
  subgraph G_packages_plugin_base["packages/plugin-base"]
    N24["@hierarchidb/plugin-base"]
  end
  subgraph G_packages_plugin_presentation["packages/plugin-presentation"]
    N25["@hierarchidb/plugin-presentation"]
  end
  subgraph G_packages_plugin_registry["packages/plugin-registry"]
    N26["@hierarchidb/plugin-registry"]
  end
  subgraph G_packages_plugin_service_api["packages/plugin-service-api"]
    N28["@hierarchidb/plugin-service-api"]
  end
  subgraph G_packages_plugin_service_sdk["packages/plugin-service-sdk"]
    N29["@hierarchidb/plugin-service-sdk"]
  end
  subgraph G_packages_plugin_ui_host["packages/plugin-ui-host"]
    N30["@hierarchidb/plugin-ui-host"]
  end
  subgraph G_packages_plugin_ui_sdk["packages/plugin-ui-sdk"]
    N31["@hierarchidb/plugin-ui-sdk"]
  end
  subgraph G_packages_runtime["packages/runtime"]
    N32["@hierarchidb/runtime-worker"]
  end
  subgraph G_packages_runtime_client["packages/runtime/client"]
    N33["@hierarchidb/ui-worker-client"]
  end
  subgraph G_packages_testing["packages/testing"]
    N34["@hierarchidb/testing-plugin-dialog-mocks"]
  end
  subgraph G_packages_tools["packages/tools"]
    N35["@hierarchidb/analyze-licenses"]
    N36["@hierarchidb/tools"]
    N37["@hierarchidb/tools-build-scripts"]
    N38["@hierarchidb/tools-codemods"]
    N39["@hierarchidb/tools-plugin-manifest-loader"]
    N40["@hierarchidb/tools-schemas"]
  end
  subgraph G_packages_ui["packages/ui"]
    N41["@hierarchidb/memory-usage"]
    N42["@hierarchidb/ui-accordion-config"]
    N43["@hierarchidb/ui-auth"]
    N44["@hierarchidb/ui-country-select"]
    N45["@hierarchidb/ui-grid"]
    N46["@hierarchidb/ui-datasource"]
    N47["@hierarchidb/ui-dialog"]
    N48["@hierarchidb/ui-file"]
    N49["@hierarchidb/ui-floating-window"]
    N50["@hierarchidb/ui-i18n"]
    N51["@hierarchidb/ui-icon"]
    N52["@hierarchidb/ui-layout"]
    N53["@hierarchidb/ui-license"]
    N54["@hierarchidb/ui-lru-splitview"]
    N55["@hierarchidb/ui-map"]
    N56["@hierarchidb/ui-monitoring"]
    N57["@hierarchidb/ui-navigation"]
    N58["@hierarchidb/ui-plugin-basic-info"]
    N59["@hierarchidb/ui-routing"]
    N60["@hierarchidb/ui-search-result-window"]
    N61["@hierarchidb/ui-tabular"]
    N62["@hierarchidb/ui-theme"]
    N63["@hierarchidb/ui-tour"]
    N64["@hierarchidb/ui-usermenu"]
  end
  subgraph G_packages_ui_treeconsole["packages/ui/treeconsole"]
    N65["@hierarchidb/ui-treeconsole-base"]
    N66["@hierarchidb/ui-treeconsole-breadcrumb"]
    N67["@hierarchidb/ui-treeconsole-footer"]
    N68["@hierarchidb/ui-treeconsole-speeddial"]
    N69["@hierarchidb/ui-treeconsole-toolbar"]
    N70["@hierarchidb/ui-treeconsole-trashbin"]
    N71["@hierarchidb/ui-treeconsole-treetable"]
  end
  subgraph G_packages_util["packages/util"]
    N72["@hierarchidb/util"]
  end
  subgraph G_plugins["plugins"]
    N73["@hierarchidb/basemap-plugin"]
    N74["@hierarchidb/folder-plugin"]
    N75["@hierarchidb/linker-plugin"]
    N76["@hierarchidb/location-plugin"]
    N77["@hierarchidb/resolver-plugin"]
    N78["@hierarchidb/route-plugin"]
    N79["@hierarchidb/shape-plugin"]
    N80["@hierarchidb/spreadsheet-plugin"]
    N81["@hierarchidb/styler-plugin"]
    N82["@hierarchidb/timeline-plugin"]
  end
```
