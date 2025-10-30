# Package Dependency Graph

Generated on: 2025-10-30T12:48:20.355Z

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
    N5["@hierarchidb/common-api"]
    N6["@hierarchidb/common-auth"]
    N7["@hierarchidb/common-types"]
  end
  subgraph G_packages_components["packages/components"]
    N8["@hierarchidb/components"]
  end
  subgraph G_packages_feature["packages/feature"]
    N9["@hierarchidb/auth-recovery"]
    N10["@hierarchidb/batch"]
    N11["@hierarchidb/compute"]
    N12["@hierarchidb/download"]
    N13["@hierarchidb/feature-registry"]
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
  subgraph G_packages_plugin_registry["packages/plugin-registry"]
    N24["@hierarchidb/plugin-registry"]
  end
  subgraph G_packages_plugin_runtime_services["packages/plugin-runtime-services"]
    N25["@hierarchidb/plugin-runtime-services"]
  end
  subgraph G_packages_plugin_service_api["packages/plugin-service-api"]
    N26["@hierarchidb/plugin-service-api"]
  end
  subgraph G_packages_plugin_service_sdk["packages/plugin-service-sdk"]
    N27["@hierarchidb/plugin-service-sdk"]
  end
  subgraph G_packages_plugin_types["packages/plugin-types"]
    N28["@hierarchidb/plugin-types"]
  end
  subgraph G_packages_plugin_ui_sdk["packages/plugin-ui-sdk"]
    N29["@hierarchidb/plugin-ui-sdk"]
  end
  subgraph G_packages_runtime["packages/runtime"]
    N30["@hierarchidb/runtime-worker"]
  end
  subgraph G_packages_runtime_client["packages/runtime/client"]
    N31["@hierarchidb/runtime-client"]
  end
  subgraph G_packages_tools["packages/tools"]
    N32["@hierarchidb/analyze-licenses"]
    N33["@hierarchidb/tools"]
    N34["@hierarchidb/tools-build-scripts"]
    N35["@hierarchidb/tools-codemods"]
    N36["@hierarchidb/tools-plugin-manifest-loader"]
    N37["@hierarchidb/tools-schemas"]
  end
  subgraph G_packages_ui["packages/ui"]
    N38["@hierarchidb/memory-usage"]
    N39["@hierarchidb/ui-accordion-config"]
    N40["@hierarchidb/ui-auth"]
    N41["@hierarchidb/ui-country-select"]
    N42["@hierarchidb/ui-data-grid"]
    N43["@hierarchidb/ui-datasource"]
    N44["@hierarchidb/ui-dialog"]
    N45["@hierarchidb/ui-file"]
    N46["@hierarchidb/ui-floating-window"]
    N47["@hierarchidb/ui-i18n"]
    N48["@hierarchidb/ui-icon"]
    N49["@hierarchidb/ui-layout"]
    N50["@hierarchidb/ui-license"]
    N51["@hierarchidb/ui-lru-splitview"]
    N52["@hierarchidb/ui-map"]
    N53["@hierarchidb/ui-monitoring"]
    N54["@hierarchidb/ui-navigation"]
    N55["@hierarchidb/ui-plugin-basic-info"]
    N56["@hierarchidb/ui-plugin-dialog"]
    N57["@hierarchidb/ui-routing"]
    N58["@hierarchidb/ui-search-result-window"]
    N59["@hierarchidb/ui-tabular-extract"]
    N60["@hierarchidb/ui-theme"]
    N61["@hierarchidb/ui-tour"]
    N62["@hierarchidb/ui-usermenu"]
  end
  subgraph G_packages_ui_treeconsole["packages/ui/treeconsole"]
    N63["@hierarchidb/ui-treeconsole-base"]
    N64["@hierarchidb/ui-treeconsole-breadcrumb"]
    N65["@hierarchidb/ui-treeconsole-footer"]
    N66["@hierarchidb/ui-treeconsole-speeddial"]
    N67["@hierarchidb/ui-treeconsole-toolbar"]
    N68["@hierarchidb/ui-treeconsole-trashbin"]
    N69["@hierarchidb/ui-treeconsole-treetable"]
  end
  subgraph G_packages_util["packages/util"]
    N70["@hierarchidb/util"]
  end
  subgraph G_plugins["plugins"]
    N71["@hierarchidb/basemap-plugin"]
    N72["@hierarchidb/folder-plugin"]
    N73["@hierarchidb/linker-plugin"]
    N74["@hierarchidb/location-plugin"]
    N75["@hierarchidb/resolver-plugin"]
    N76["@hierarchidb/route-plugin"]
    N77["@hierarchidb/shape-plugin"]
    N78["@hierarchidb/spreadsheet-plugin"]
    N79["@hierarchidb/styler-plugin"]
    N80["@hierarchidb/timeline-plugin"]
  end
  N0 --> N1
  N0 --> N16
  N0 --> N21
  N0 --> N24
  N0 --> N28
  N0 --> N29
  N0 --> N30
  N0 --> N31
  N0 --> N40
  N0 --> N44
  N0 --> N47
  N0 --> N48
  N0 --> N49
  N0 --> N5
  N0 --> N52
  N0 --> N54
  N0 --> N56
  N0 --> N57
  N0 --> N6
  N0 --> N60
  N0 --> N61
  N0 --> N62
  N0 --> N63
  N0 --> N64
  N0 --> N67
  N0 --> N69
  N0 --> N7
  N0 --> N70
  N0 --> N71
  N0 --> N72
  N0 --> N73
  N0 --> N74
  N0 --> N75
  N0 --> N76
  N0 --> N77
  N0 --> N78
  N0 --> N79
  N0 --> N8
  N0 --> N80
  N10 --> N12
  N10 --> N5
  N10 --> N7
  N11 --> N70
  N12 --> N70
  N12 --> N9
  N15 --> N5
  N15 --> N7
  N15 --> N70
  N16 --> N17
  N16 --> N70
  N17 --> N70
  N19 --> N12
  N20 --> N7
  N20 --> N70
  N21 --> N20
  N21 --> N22
  N22 --> N70
  N23 --> N5
  N23 --> N7
  N23 --> N70
  N25 --> N12
  N25 --> N26
  N25 --> N30
  N25 --> N7
  N26 --> N7
  N27 --> N12
  N27 --> N26
  N27 --> N5
  N27 --> N7
  N28 --> N12
  N28 --> N26
  N28 --> N7
  N29 --> N12
  N29 --> N27
  N29 --> N5
  N29 --> N7
  N30 --> N11
  N30 --> N12
  N30 --> N13
  N30 --> N15
  N30 --> N16
  N30 --> N17
  N30 --> N20
  N30 --> N21
  N30 --> N22
  N30 --> N23
  N30 --> N24
  N30 --> N28
  N30 --> N5
  N30 --> N7
  N30 --> N70
  N30 --> N9
  N31 --> N30
  N31 --> N5
  N31 --> N7
  N34 --> N36
  N38 --> N70
  N4 --> N12
  N4 --> N5
  N4 --> N7
  N4 --> N9
  N40 --> N6
  N42 --> N22
  N42 --> N7
  N42 --> N70
  N44 --> N7
  N45 --> N70
  N49 --> N60
  N5 --> N7
  N52 --> N42
  N52 --> N7
  N53 --> N70
  N54 --> N7
  N56 --> N12
  N56 --> N28
  N56 --> N29
  N56 --> N30
  N56 --> N31
  N56 --> N44
  N56 --> N48
  N56 --> N5
  N56 --> N55
  N56 --> N7
  N58 --> N46
  N58 --> N5
  N58 --> N7
  N59 --> N20
  N59 --> N22
  N59 --> N45
  N6 --> N7
  N62 --> N40
  N62 --> N47
  N62 --> N53
  N62 --> N6
  N62 --> N60
  N63 --> N47
  N63 --> N48
  N63 --> N5
  N63 --> N60
  N63 --> N64
  N63 --> N65
  N63 --> N67
  N63 --> N68
  N63 --> N69
  N63 --> N7
  N64 --> N48
  N64 --> N60
  N64 --> N7
  N68 --> N64
  N69 --> N47
  N69 --> N60
  N69 --> N64
  N69 --> N7
  N69 --> N8
  N71 --> N25
  N71 --> N28
  N71 --> N29
  N71 --> N30
  N71 --> N42
  N71 --> N5
  N71 --> N52
  N71 --> N56
  N71 --> N7
  N71 --> N70
  N71 --> N72
  N72 --> N23
  N72 --> N28
  N72 --> N29
  N72 --> N30
  N72 --> N31
  N72 --> N44
  N72 --> N5
  N72 --> N55
  N72 --> N56
  N72 --> N7
  N72 --> N70
  N72 --> N8
  N73 --> N28
  N73 --> N30
  N73 --> N31
  N73 --> N5
  N73 --> N52
  N73 --> N56
  N73 --> N63
  N73 --> N7
  N73 --> N70
  N74 --> N10
  N74 --> N12
  N74 --> N22
  N74 --> N28
  N74 --> N29
  N74 --> N30
  N74 --> N42
  N74 --> N43
  N74 --> N44
  N74 --> N5
  N74 --> N50
  N74 --> N55
  N74 --> N56
  N74 --> N6
  N74 --> N7
  N74 --> N70
  N74 --> N8
  N74 --> N9
  N75 --> N25
  N75 --> N28
  N75 --> N29
  N75 --> N30
  N75 --> N44
  N75 --> N5
  N75 --> N55
  N75 --> N56
  N75 --> N7
  N75 --> N70
  N76 --> N12
  N76 --> N22
  N76 --> N28
  N76 --> N29
  N76 --> N30
  N76 --> N31
  N76 --> N4
  N76 --> N42
  N76 --> N44
  N76 --> N5
  N76 --> N55
  N76 --> N56
  N76 --> N7
  N76 --> N70
  N76 --> N8
  N76 --> N9
  N77 --> N10
  N77 --> N12
  N77 --> N22
  N77 --> N25
  N77 --> N28
  N77 --> N29
  N77 --> N30
  N77 --> N31
  N77 --> N39
  N77 --> N41
  N77 --> N43
  N77 --> N5
  N77 --> N50
  N77 --> N51
  N77 --> N56
  N77 --> N6
  N77 --> N7
  N77 --> N70
  N77 --> N72
  N77 --> N9
  N78 --> N20
  N78 --> N22
  N78 --> N25
  N78 --> N28
  N78 --> N29
  N78 --> N30
  N78 --> N43
  N78 --> N45
  N78 --> N5
  N78 --> N55
  N78 --> N56
  N78 --> N59
  N78 --> N7
  N78 --> N70
  N78 --> N72
  N78 --> N9
  N79 --> N22
  N79 --> N28
  N79 --> N29
  N79 --> N30
  N79 --> N55
  N79 --> N56
  N79 --> N59
  N79 --> N7
  N79 --> N70
  N79 --> N72
  N79 --> N78
  N79 --> N8
  N8 --> N7
  N80 --> N28
  N80 --> N30
  N80 --> N44
  N80 --> N5
  N80 --> N56
  N80 --> N7
  N80 --> N70
  N9 --> N6
  N9 --> N70
```
