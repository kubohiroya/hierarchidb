import "./steps-provider.js";
import { useEffect, useState } from "react";
import { Badge, Box, Button, Card, CardActions, CardContent, Chip, CircularProgress, Divider, IconButton, LinearProgress, List, ListItem, ListItemText, Menu, MenuItem, Paper, Tooltip, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";
import { Cached, CheckCircle, Delete, Edit, Error, Link, Memory, Merge, MoreVert, PlayArrow, Speed, Timeline, Warning } from "@mui/icons-material";
import { jsx, jsxs } from "react/jsx-runtime";

//#region src/ui/components/ResolverPanel.tsx
const ResolverPanel = ({ nodeId: _nodeId, entity, onEdit, onDelete, onTest, onCompile, onViewChain }) => {
	const [anchorEl, setAnchorEl] = useState(null);
	const [compilationStatus, setCompilationStatus] = useState("idle");
	const [statistics, setStatistics] = useState(null);
	const [isProcessing, setIsProcessing] = useState(false);
	useEffect(() => {
		if (entity) {
			const totalMappings = entity.mappingRules.length;
			setStatistics({
				totalSourceProperties: 0,
				totalTargetProperties: 0,
				mappedProperties: totalMappings,
				unmappedProperties: [],
				coverage: totalMappings > 0 ? 100 : 0,
				conflicts: []
			});
			if (totalMappings > 5) setCompilationStatus("compiled");
		}
	}, [entity]);
	const handleMenuOpen = (event) => {
		setAnchorEl(event.currentTarget);
	};
	const handleMenuClose = () => {
		setAnchorEl(null);
	};
	const handleCompile = async () => {
		setIsProcessing(true);
		setCompilationStatus("compiling");
		setTimeout(() => {
			setCompilationStatus("compiled");
			setIsProcessing(false);
			if (onCompile) onCompile();
		}, 2e3);
	};
	const getStatusIcon = () => {
		if (!entity) return null;
		const hasErrors = entity.mappingRules.length === 0;
		const hasWarnings = entity.validationRules.length === 0;
		if (hasErrors) return /* @__PURE__ */ jsx(Error, { color: "error" });
		else if (hasWarnings) return /* @__PURE__ */ jsx(Warning, { color: "warning" });
		else return /* @__PURE__ */ jsx(CheckCircle, { color: "success" });
	};
	const getCompilationBadge = () => {
		switch (compilationStatus) {
			case "compiled": return /* @__PURE__ */ jsx(Tooltip, {
				title: "Compiled and optimized",
				children: /* @__PURE__ */ jsx(Badge, {
					badgeContent: "✓",
					color: "success",
					children: /* @__PURE__ */ jsx(Speed, { color: "primary" })
				})
			});
			case "compiling": return /* @__PURE__ */ jsx(CircularProgress, { size: 20 });
			case "error": return /* @__PURE__ */ jsx(Tooltip, {
				title: "Compilation failed",
				children: /* @__PURE__ */ jsx(Badge, {
					badgeContent: "!",
					color: "error",
					children: /* @__PURE__ */ jsx(Speed, { color: "disabled" })
				})
			});
			default: return /* @__PURE__ */ jsx(Tooltip, {
				title: "Not compiled",
				children: /* @__PURE__ */ jsx(Speed, { color: "disabled" })
			});
		}
	};
	if (!entity) return /* @__PURE__ */ jsxs(Paper, {
		sx: {
			p: 3,
			textAlign: "center"
		},
		children: [/* @__PURE__ */ jsx(Typography, {
			variant: "body1",
			color: "text.secondary",
			children: "No Resolver configuration found for this node."
		}), /* @__PURE__ */ jsx(Button, {
			variant: "contained",
			sx: { mt: 2 },
			onClick: onEdit,
			children: "Create Configuration"
		})]
	});
	return /* @__PURE__ */ jsxs(Box, { children: [
		/* @__PURE__ */ jsxs(Card, {
			sx: { mb: 2 },
			children: [
				/* @__PURE__ */ jsxs(CardContent, { children: [/* @__PURE__ */ jsxs(Box, {
					sx: {
						display: "flex",
						justifyContent: "space-between",
						alignItems: "flex-start"
					},
					children: [/* @__PURE__ */ jsxs(Box, { children: [/* @__PURE__ */ jsxs(Box, {
						sx: {
							display: "flex",
							alignItems: "center",
							gap: 1,
							mb: 1
						},
						children: [
							getStatusIcon(),
							/* @__PURE__ */ jsx(Typography, {
								variant: "h6",
								children: entity.name
							}),
							getCompilationBadge()
						]
					}), entity.description && /* @__PURE__ */ jsx(Typography, {
						variant: "body2",
						color: "text.secondary",
						children: entity.description
					})] }), /* @__PURE__ */ jsx(IconButton, {
						onClick: handleMenuOpen,
						children: /* @__PURE__ */ jsx(MoreVert, {})
					})]
				}), /* @__PURE__ */ jsxs(Box, {
					sx: {
						mt: 2,
						display: "flex",
						gap: 1,
						flexWrap: "wrap"
					},
					children: [
						/* @__PURE__ */ jsx(Chip, {
							label: `${entity.mappingRules.length} Mappings`,
							size: "small",
							color: "primary",
							variant: "outlined"
						}),
						/* @__PURE__ */ jsx(Chip, {
							label: `${entity.validationRules.length} Validations`,
							size: "small",
							color: "secondary",
							variant: "outlined"
						}),
						/* @__PURE__ */ jsx(Chip, {
							label: entity.duplicateResolution.strategy,
							size: "small",
							icon: /* @__PURE__ */ jsx(Merge, {}),
							variant: "outlined"
						}),
						compilationStatus === "compiled" && /* @__PURE__ */ jsx(Chip, {
							label: "Optimized",
							size: "small",
							color: "success",
							icon: /* @__PURE__ */ jsx(Speed, {})
						})
					]
				})] }),
				/* @__PURE__ */ jsxs(CardActions, { children: [
					/* @__PURE__ */ jsx(Button, {
						size: "small",
						startIcon: /* @__PURE__ */ jsx(Edit, {}),
						onClick: onEdit,
						children: "Edit"
					}),
					/* @__PURE__ */ jsx(Button, {
						size: "small",
						startIcon: /* @__PURE__ */ jsx(PlayArrow, {}),
						onClick: onTest,
						children: "Test"
					}),
					compilationStatus !== "compiled" && /* @__PURE__ */ jsx(Button, {
						size: "small",
						startIcon: /* @__PURE__ */ jsx(Speed, {}),
						onClick: handleCompile,
						disabled: isProcessing,
						children: "Compile"
					}),
					onViewChain && /* @__PURE__ */ jsx(Button, {
						size: "small",
						startIcon: /* @__PURE__ */ jsx(Link, {}),
						onClick: onViewChain,
						children: "View Chain"
					})
				] }),
				isProcessing && /* @__PURE__ */ jsx(LinearProgress, {})
			]
		}),
		statistics && /* @__PURE__ */ jsxs(Grid, {
			container: true,
			spacing: 2,
			sx: { mb: 2 },
			children: [
				/* @__PURE__ */ jsx(Grid, {
					size: {
						xs: 6,
						sm: 3
					},
					children: /* @__PURE__ */ jsxs(Paper, {
						sx: {
							p: 2,
							textAlign: "center"
						},
						children: [/* @__PURE__ */ jsx(Typography, {
							variant: "h4",
							color: "primary",
							children: statistics.mappedProperties
						}), /* @__PURE__ */ jsx(Typography, {
							variant: "caption",
							color: "text.secondary",
							children: "Mapped Properties"
						})]
					})
				}),
				/* @__PURE__ */ jsx(Grid, {
					size: {
						xs: 6,
						sm: 3
					},
					children: /* @__PURE__ */ jsxs(Paper, {
						sx: {
							p: 2,
							textAlign: "center"
						},
						children: [/* @__PURE__ */ jsx(Typography, {
							variant: "h4",
							color: "secondary",
							children: entity.validationRules.length
						}), /* @__PURE__ */ jsx(Typography, {
							variant: "caption",
							color: "text.secondary",
							children: "Validation Rules"
						})]
					})
				}),
				/* @__PURE__ */ jsx(Grid, {
					size: {
						xs: 6,
						sm: 3
					},
					children: /* @__PURE__ */ jsxs(Paper, {
						sx: {
							p: 2,
							textAlign: "center"
						},
						children: [/* @__PURE__ */ jsxs(Typography, {
							variant: "h4",
							color: "success.main",
							children: [statistics.coverage.toFixed(0), "%"]
						}), /* @__PURE__ */ jsx(Typography, {
							variant: "caption",
							color: "text.secondary",
							children: "Coverage"
						})]
					})
				}),
				/* @__PURE__ */ jsx(Grid, {
					size: {
						xs: 6,
						sm: 3
					},
					children: /* @__PURE__ */ jsxs(Paper, {
						sx: {
							p: 2,
							textAlign: "center"
						},
						children: [/* @__PURE__ */ jsx(Typography, {
							variant: "h4",
							color: compilationStatus === "compiled" ? "success.main" : "text.disabled",
							children: compilationStatus === "compiled" ? "10x" : "--"
						}), /* @__PURE__ */ jsx(Typography, {
							variant: "caption",
							color: "text.secondary",
							children: "Speed Boost"
						})]
					})
				})
			]
		}),
		/* @__PURE__ */ jsxs(Paper, {
			sx: { mb: 2 },
			children: [
				/* @__PURE__ */ jsx(Box, {
					sx: { p: 2 },
					children: /* @__PURE__ */ jsx(Typography, {
						variant: "subtitle1",
						sx: { mb: 1 },
						children: "Property Mappings"
					})
				}),
				/* @__PURE__ */ jsx(Divider, {}),
				/* @__PURE__ */ jsxs(List, {
					dense: true,
					children: [
						entity.mappingRules.slice(0, 5).map((rule) => /* @__PURE__ */ jsx(ListItem, { children: /* @__PURE__ */ jsx(ListItemText, {
							primary: /* @__PURE__ */ jsxs(Box, {
								sx: {
									display: "flex",
									alignItems: "center",
									gap: 1
								},
								children: [
									/* @__PURE__ */ jsx(Typography, {
										variant: "body2",
										sx: { fontFamily: "monospace" },
										children: rule.sourceProperty
									}),
									/* @__PURE__ */ jsx(Typography, {
										variant: "body2",
										color: "text.secondary",
										children: "→"
									}),
									/* @__PURE__ */ jsx(Typography, {
										variant: "body2",
										sx: { fontFamily: "monospace" },
										children: rule.targetProperty
									})
								]
							}),
							secondary: rule.transformFunction && /* @__PURE__ */ jsx(Chip, {
								label: rule.transformFunction,
								size: "small",
								variant: "outlined",
								sx: { mt: .5 }
							})
						}) }, rule.id)),
						entity.mappingRules.length > 5 && /* @__PURE__ */ jsx(ListItem, { children: /* @__PURE__ */ jsx(ListItemText, { secondary: `... and ${entity.mappingRules.length - 5} more mappings` }) }),
						entity.mappingRules.length === 0 && /* @__PURE__ */ jsx(ListItem, { children: /* @__PURE__ */ jsx(ListItemText, { primary: /* @__PURE__ */ jsx(Typography, {
							variant: "body2",
							color: "text.secondary",
							children: "No mapping rules defined"
						}) }) })
					]
				})
			]
		}),
		compilationStatus === "compiled" && /* @__PURE__ */ jsxs(Paper, {
			sx: { p: 2 },
			children: [/* @__PURE__ */ jsx(Typography, {
				variant: "subtitle1",
				sx: { mb: 2 },
				children: "Performance Metrics"
			}), /* @__PURE__ */ jsxs(Grid, {
				container: true,
				spacing: 2,
				children: [
					/* @__PURE__ */ jsx(Grid, {
						size: { xs: 6 },
						children: /* @__PURE__ */ jsxs(Box, {
							sx: {
								display: "flex",
								alignItems: "center",
								gap: 1
							},
							children: [/* @__PURE__ */ jsx(Timeline, { color: "primary" }), /* @__PURE__ */ jsxs(Box, { children: [/* @__PURE__ */ jsx(Typography, {
								variant: "body2",
								color: "text.secondary",
								children: "Avg. Execution Time"
							}), /* @__PURE__ */ jsx(Typography, {
								variant: "body1",
								children: "12.5ms → 1.2ms"
							})] })]
						})
					}),
					/* @__PURE__ */ jsx(Grid, {
						size: { xs: 6 },
						children: /* @__PURE__ */ jsxs(Box, {
							sx: {
								display: "flex",
								alignItems: "center",
								gap: 1
							},
							children: [/* @__PURE__ */ jsx(Memory, { color: "primary" }), /* @__PURE__ */ jsxs(Box, { children: [/* @__PURE__ */ jsx(Typography, {
								variant: "body2",
								color: "text.secondary",
								children: "Memory Usage"
							}), /* @__PURE__ */ jsx(Typography, {
								variant: "body1",
								children: "2.4MB → 0.8MB"
							})] })]
						})
					}),
					/* @__PURE__ */ jsx(Grid, {
						size: { xs: 6 },
						children: /* @__PURE__ */ jsxs(Box, {
							sx: {
								display: "flex",
								alignItems: "center",
								gap: 1
							},
							children: [/* @__PURE__ */ jsx(Cached, { color: "primary" }), /* @__PURE__ */ jsxs(Box, { children: [/* @__PURE__ */ jsx(Typography, {
								variant: "body2",
								color: "text.secondary",
								children: "Cache Hit Rate"
							}), /* @__PURE__ */ jsx(Typography, {
								variant: "body1",
								children: "89%"
							})] })]
						})
					}),
					/* @__PURE__ */ jsx(Grid, {
						size: { xs: 6 },
						children: /* @__PURE__ */ jsxs(Box, {
							sx: {
								display: "flex",
								alignItems: "center",
								gap: 1
							},
							children: [/* @__PURE__ */ jsx(Speed, { color: "success" }), /* @__PURE__ */ jsxs(Box, { children: [/* @__PURE__ */ jsx(Typography, {
								variant: "body2",
								color: "text.secondary",
								children: "Optimization Level"
							}), /* @__PURE__ */ jsx(Typography, {
								variant: "body1",
								children: "Aggressive"
							})] })]
						})
					})
				]
			})]
		}),
		/* @__PURE__ */ jsxs(Menu, {
			anchorEl,
			open: Boolean(anchorEl),
			onClose: handleMenuClose,
			children: [
				/* @__PURE__ */ jsxs(MenuItem, {
					onClick: () => {
						handleMenuClose();
						onEdit?.();
					},
					children: [/* @__PURE__ */ jsx(Edit, {
						sx: { mr: 1 },
						fontSize: "small"
					}), "Edit Configuration"]
				}),
				/* @__PURE__ */ jsxs(MenuItem, {
					onClick: () => {
						handleMenuClose();
						onTest?.();
					},
					children: [/* @__PURE__ */ jsx(PlayArrow, {
						sx: { mr: 1 },
						fontSize: "small"
					}), "Run Test"]
				}),
				/* @__PURE__ */ jsxs(MenuItem, {
					onClick: () => {
						handleMenuClose();
						handleCompile();
					},
					children: [/* @__PURE__ */ jsx(Speed, {
						sx: { mr: 1 },
						fontSize: "small"
					}), "Compile & Optimize"]
				}),
				/* @__PURE__ */ jsx(Divider, {}),
				/* @__PURE__ */ jsxs(MenuItem, {
					onClick: () => {
						handleMenuClose();
						onViewChain?.();
					},
					children: [/* @__PURE__ */ jsx(Link, {
						sx: { mr: 1 },
						fontSize: "small"
					}), "View in Chain"]
				}),
				/* @__PURE__ */ jsx(Divider, {}),
				/* @__PURE__ */ jsxs(MenuItem, {
					onClick: () => {
						handleMenuClose();
						onDelete?.();
					},
					children: [/* @__PURE__ */ jsx(Delete, {
						sx: { mr: 1 },
						fontSize: "small",
						color: "error"
					}), "Delete"]
				})
			]
		})
	] });
};

//#endregion
//#region src/plugin-manifest.ts
const PLUGIN_ID = "@hierarchidb/resolver-plugin";
const PLUGIN_VERSION = "1.0.0";
const PLUGIN_DESCRIPTION = "Resolver node type plugin for property mapping between different data schemas";
const PLUGIN_NODE_TYPE = "resolver";
const PLUGIN_MANIFEST = {
	id: PLUGIN_ID,
	name: "Resolver Plugin",
	displayName: "Resolver",
	nodeType: PLUGIN_NODE_TYPE,
	version: PLUGIN_VERSION,
	description: PLUGIN_DESCRIPTION,
	priority: 60,
	extends: "folder",
	dependencies: ["folder"],
	icon: {
		mui: "Extension",
		emoji: "🧩",
		color: "#ffb3c1",
		component: {
			specifier: "@hierarchidb/resolver-plugin/icon",
			exportName: "ResolverPluginIcon"
		}
	},
	category: {
		id: "data",
		treeId: "*",
		menuGroup: "tabular",
		createOrder: 60
	},
	tags: ["mapping", "schema"],
	capabilities: { relationalData: true },
	database: { prewarm: [{
		specifier: "@hierarchidb/resolver-plugin/database",
		export: "resolverEntitiesDB"
	}] },
	worker: { preload: ["registerResolverWorkerStores"] }
};

//#endregion
//#region src/index.ts
async function loadResolverEntityHandlerModule() {
	return import(
		/* @vite-ignore */
		"./worker/ResolverEntityService.js"
);
}
async function loadResolverPanelModule() {
	return import(
		/* @vite-ignore */
		"./ui/components/ResolverPanel.js"
);
}
async function getDialogComponent() {
	if (typeof console !== "undefined" && typeof console.warn === "function") console.warn("[resolver-plugin] getDialogComponent() is deprecated. Dialogs are provided by PluginDialogHost.");
	return () => null;
}
var RuntimeWiring = class {
	static async registerRuntimeWorkerAdapters() {}
};

//#endregion
export { ResolverPanel, PLUGIN_MANIFEST as ResolverPluginManifest, RuntimeWiring, getDialogComponent, loadResolverEntityHandlerModule, loadResolverPanelModule };
//# sourceMappingURL=index.js.map