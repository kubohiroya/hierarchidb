import "../stylerTypes.js";
import "../colorUtils.js";
import "../dataAnalysis.js";
import { n as StylerStep5, t as StylerStep6 } from "../StylerStep6.js";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormHelperText, IconButton, InputLabel, MenuItem, Paper, Select, TextField, Typography } from "@mui/material";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Add, Cancel, Delete, Save } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { jsx, jsxs } from "react/jsx-runtime";
import { PluginStepRegistry } from "@hierarchidb/plugin-base";
import { DataSourceStep, FilteringStep } from "@hierarchidb/spreadsheet-plugin";
import { TagChipsInput } from "@hierarchidb/ui-plugin-basic-info";

//#region src/ui/components/StylerSimpleDialog.tsx
const StylerSimpleDialog = ({ open, onClose, onSave, existingEntity }) => {
	const generateRuleId = useCallback(() => typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `rule-${Date.now()}-${Math.random()}`, []);
	const [keyColumn, setKeyColumn] = useState("");
	const [colorRules, setColorRules] = useState([]);
	const [defaultStyle, setDefaultStyle] = useState({
		backgroundColor: "#ffffff",
		textColor: "#000000",
		borderColor: "#cccccc"
	});
	const [description, setDescription] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const handleAddColorRule = useCallback(() => {
		const newRule = {
			_id: generateRuleId(),
			column: "",
			operator: "equals",
			value: "",
			style: {
				backgroundColor: "#ffeb3b",
				textColor: "#000000"
			}
		};
		setColorRules((prev) => [...prev, newRule]);
	}, [generateRuleId]);
	const handleUpdateColorRule = useCallback((index, updates) => {
		setColorRules((prev) => prev.map((rule, i) => i === index ? {
			...rule,
			...updates
		} : rule));
	}, []);
	const handleRemoveColorRule = useCallback((index) => {
		setColorRules((prev) => prev.filter((_, i) => i !== index));
	}, []);
	const handleSave = useCallback(async () => {
		if (!keyColumn) {
			setError("Please select a key column");
			return;
		}
		setLoading(true);
		setError("");
		try {
			await onSave({
				keyColumn,
				colorRules: colorRules.map(({ _id, ...rule }) => rule),
				defaultStyle,
				description: description || void 0
			});
			onClose();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save Styler");
		} finally {
			setLoading(false);
		}
	}, [
		keyColumn,
		colorRules,
		defaultStyle,
		description,
		onSave,
		onClose
	]);
	React.useEffect(() => {
		if (existingEntity) {
			setKeyColumn(existingEntity.keyColumn || "");
			setColorRules((existingEntity.colorRules || []).map((rule, index) => ({
				...rule,
				_id: `${existingEntity.id}-rule-${index}`
			})));
			setDefaultStyle(existingEntity.defaultStyle || {
				textColor: "",
				backgroundColor: ""
			});
			setDescription(existingEntity.description || "");
		}
	}, [existingEntity]);
	return /* @__PURE__ */ jsxs(Dialog, {
		open,
		onClose,
		maxWidth: "md",
		fullWidth: true,
		children: [
			/* @__PURE__ */ jsx(DialogTitle, { children: existingEntity ? "Edit Styler" : "Create Styler" }),
			/* @__PURE__ */ jsxs(DialogContent, { children: [/* @__PURE__ */ jsxs(Box, {
				sx: {
					display: "flex",
					flexDirection: "column",
					gap: 3,
					mt: 1
				},
				children: [
					/* @__PURE__ */ jsx(TextField, {
						label: "Key Column",
						value: keyColumn,
						onChange: (e) => setKeyColumn(e.target.value),
						fullWidth: true,
						required: true
					}),
					/* @__PURE__ */ jsxs(Paper, {
						sx: { p: 2 },
						children: [
							/* @__PURE__ */ jsxs(Box, {
								sx: {
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									mb: 2
								},
								children: [/* @__PURE__ */ jsx(Typography, {
									variant: "h6",
									children: "Color Rules"
								}), /* @__PURE__ */ jsx(Button, {
									startIcon: /* @__PURE__ */ jsx(Add, {}),
									onClick: handleAddColorRule,
									children: "Add Rule"
								})]
							}),
							colorRules.map((rule, index) => /* @__PURE__ */ jsxs(Box, {
								sx: {
									display: "flex",
									gap: 2,
									mb: 2,
									alignItems: "center"
								},
								children: [
									/* @__PURE__ */ jsx(TextField, {
										label: "Column",
										value: rule.column,
										onChange: (e) => handleUpdateColorRule(index, { column: e.target.value }),
										size: "small"
									}),
									/* @__PURE__ */ jsxs(FormControl, {
										sx: { minWidth: 120 },
										children: [/* @__PURE__ */ jsx(InputLabel, { children: "Operator" }), /* @__PURE__ */ jsxs(Select, {
											value: rule.operator,
											onChange: (e) => handleUpdateColorRule(index, { operator: e.target.value }),
											label: "Operator",
											size: "small",
											children: [
												/* @__PURE__ */ jsx(MenuItem, {
													value: "equals",
													children: "Equals"
												}),
												/* @__PURE__ */ jsx(MenuItem, {
													value: "contains",
													children: "Contains"
												}),
												/* @__PURE__ */ jsx(MenuItem, {
													value: "greaterThan",
													children: "Greater Than"
												}),
												/* @__PURE__ */ jsx(MenuItem, {
													value: "lessThan",
													children: "Less Than"
												})
											]
										})]
									}),
									/* @__PURE__ */ jsx(TextField, {
										label: "Value",
										value: rule.value,
										onChange: (e) => handleUpdateColorRule(index, { value: e.target.value }),
										size: "small"
									}),
									/* @__PURE__ */ jsx(TextField, {
										label: "Color",
										type: "color",
										value: rule.style.backgroundColor || "#ffffff",
										onChange: (e) => handleUpdateColorRule(index, { style: {
											...rule.style,
											backgroundColor: e.target.value
										} }),
										size: "small",
										sx: { width: 80 }
									}),
									/* @__PURE__ */ jsx(IconButton, {
										onClick: () => handleRemoveColorRule(index),
										color: "error",
										size: "small",
										children: /* @__PURE__ */ jsx(Delete, {})
									})
								]
							}, rule._id)),
							colorRules.length === 0 && /* @__PURE__ */ jsx(Typography, {
								variant: "body2",
								color: "text.secondary",
								children: "No color rules defined."
							})
						]
					}),
					/* @__PURE__ */ jsxs(Paper, {
						sx: { p: 2 },
						children: [/* @__PURE__ */ jsx(Typography, {
							variant: "h6",
							gutterBottom: true,
							children: "Default Style"
						}), /* @__PURE__ */ jsxs(Box, {
							sx: {
								display: "flex",
								gap: 2
							},
							children: [/* @__PURE__ */ jsx(TextField, {
								label: "Background Color",
								type: "color",
								value: defaultStyle.backgroundColor || "#ffffff",
								onChange: (e) => setDefaultStyle((prev) => ({
									...prev,
									backgroundColor: e.target.value
								})),
								size: "small"
							}), /* @__PURE__ */ jsx(TextField, {
								label: "Text Color",
								type: "color",
								value: defaultStyle.textColor || "#000000",
								onChange: (e) => setDefaultStyle((prev) => ({
									...prev,
									textColor: e.target.value
								})),
								size: "small"
							})]
						})]
					}),
					/* @__PURE__ */ jsx(TextField, {
						label: "Description (Optional)",
						value: description,
						onChange: (e) => setDescription(e.target.value),
						multiline: true,
						rows: 2,
						fullWidth: true
					})
				]
			}), error && /* @__PURE__ */ jsx(Alert, {
				severity: "error",
				sx: { mt: 2 },
				children: error
			})] }),
			/* @__PURE__ */ jsxs(DialogActions, { children: [/* @__PURE__ */ jsx(Button, {
				onClick: onClose,
				startIcon: /* @__PURE__ */ jsx(Cancel, {}),
				children: "Cancel"
			}), /* @__PURE__ */ jsx(Button, {
				onClick: handleSave,
				variant: "contained",
				startIcon: /* @__PURE__ */ jsx(Save, {}),
				disabled: loading || !keyColumn,
				children: loading ? "Saving..." : "Save Styler"
			})] })
		]
	});
};

//#endregion
//#region src/ui/components/steps/StyleSettingsStep.tsx
const STYLE_TYPE_OPTIONS = [
	{
		value: "point",
		label: "Point Style"
	},
	{
		value: "line",
		label: "Line Style"
	},
	{
		value: "polygon",
		label: "Polygon Style"
	},
	{
		value: "raster",
		label: "Raster Style"
	}
];
const isRecord = (value) => typeof value === "object" && value !== null;
const toStyleSettings = (value) => isRecord(value) ? value : {};
const isStyleSettingsComplete = (dialogData) => {
	if (!isRecord(dialogData)) return false;
	const settings = toStyleSettings(dialogData.styleSettings ?? dialogData);
	return Boolean(settings.styleType);
};
const StyleSettingsStep = ({ data, onChange, setValid, setError }) => {
	const { t } = useTranslation("styler-plugin");
	const pluginData = useMemo(() => isRecord(data) ? data : {}, [data]);
	const settings = useMemo(() => toStyleSettings(pluginData.styleSettings), [pluginData]);
	const updateSettings = useCallback((patch) => {
		const next = {
			...settings,
			...patch
		};
		onChange({
			...pluginData,
			styleSettings: next
		});
	}, [
		pluginData,
		settings,
		onChange
	]);
	useEffect(() => {
		const valid = Boolean(settings.styleType);
		setValid(valid);
		setError(valid ? null : t("styleSettings.validation.required", "Select a style type to continue."));
	}, [
		settings.styleType,
		setValid,
		setError,
		t
	]);
	return /* @__PURE__ */ jsxs(Box, {
		sx: {
			display: "flex",
			flexDirection: "column",
			gap: 3
		},
		children: [
			/* @__PURE__ */ jsxs(Box, { children: [/* @__PURE__ */ jsx(Typography, {
				variant: "h6",
				children: t("styleSettings.title", "Style Settings")
			}), /* @__PURE__ */ jsx(Typography, {
				variant: "body2",
				color: "text.secondary",
				children: t("styleSettings.description", "Choose rendering defaults for this styler before configuring data mappings.")
			})] }),
			/* @__PURE__ */ jsxs(FormControl, {
				fullWidth: true,
				required: true,
				children: [
					/* @__PURE__ */ jsx(InputLabel, { children: t("styleSettings.styleType.label", "Style Type") }),
					/* @__PURE__ */ jsx(Select, {
						value: settings.styleType ?? "",
						label: t("styleSettings.styleType.label", "Style Type"),
						onChange: (event) => updateSettings({ styleType: event.target.value }),
						children: STYLE_TYPE_OPTIONS.map((option) => /* @__PURE__ */ jsx(MenuItem, {
							value: option.value,
							children: t(`styleSettings.styleType.options.${option.value}`, option.label)
						}, option.value))
					}),
					/* @__PURE__ */ jsx(FormHelperText, { children: t("styleSettings.styleType.help", "Select the geometry that this style targets.") })
				]
			}),
			/* @__PURE__ */ jsx(TextField, {
				fullWidth: true,
				label: t("styleSettings.dataSource.label", "Style Data Source"),
				value: settings.dataSource ?? "",
				onChange: (event) => updateSettings({ dataSource: event.target.value || void 0 }),
				placeholder: t("styleSettings.dataSource.placeholder", "e.g., Census dataset or OSM layer") || "",
				helperText: t("styleSettings.dataSource.help", "Optional note describing where the styling data originates.")
			}),
			/* @__PURE__ */ jsxs(Box, { children: [
				/* @__PURE__ */ jsx(Typography, {
					variant: "subtitle2",
					gutterBottom: true,
					children: t("styleSettings.styleTags.label", "Style Tags")
				}),
				/* @__PURE__ */ jsx(TagChipsInput, {
					value: settings.styleTags ?? [],
					onChange: (next) => updateSettings({ styleTags: next }),
					placeholder: t("styleSettings.styleTags.placeholder", "Add tags to organize different style presets.") || "",
					label: ""
				}),
				/* @__PURE__ */ jsx(Typography, {
					variant: "caption",
					color: "text.secondary",
					sx: {
						mt: .5,
						display: "block"
					},
					children: t("styleSettings.styleTags.help", "Tags are stored separately from node tags and help classify visual presets.")
				})
			] })
		]
	});
};

//#endregion
//#region src/ui/components/steps-provider.tsx
const registry = PluginStepRegistry.getInstance();
const toSpreadsheetDialogData = (value) => ({ ...value ?? {} });
const mergeDialogData = (current, next) => ({
	...current ?? {},
	...next
});
const renderDataSourceStep = (p) => /* @__PURE__ */ jsx(DataSourceStep, {
	...p,
	data: toSpreadsheetDialogData(p.data),
	onChange: (next) => p.onChange(mergeDialogData(p.data, next))
});
const renderFilteringStep = (p) => /* @__PURE__ */ jsx(FilteringStep, {
	...p,
	data: toSpreadsheetDialogData(p.data),
	onChange: (next) => p.onChange(mergeDialogData(p.data, next))
});
registry.registerConfigProvider({
	nodeType: "styler",
	getCreateStepConfigs() {
		return [
			{
				id: "style-settings",
				label: "Style Settings",
				componentFactory: (p) => /* @__PURE__ */ jsx(StyleSettingsStep, { ...p }),
				validate: (dialogData) => isStyleSettingsComplete(dialogData),
				capabilities: { canProceedToNext: (dialogData) => isStyleSettingsComplete(dialogData) }
			},
			{
				id: "data-source",
				label: "Data Source",
				componentFactory: renderDataSourceStep
			},
			{
				id: "filtering",
				label: "Filtering",
				componentFactory: renderFilteringStep
			},
			{
				id: "style-mapping",
				label: "Style Mapping",
				componentFactory: (p) => /* @__PURE__ */ jsx(StylerStep5, {
					data: p.data,
					onChange: p.onChange,
					onValidate: (valid) => {
						p.setValid(valid);
						p.setError(valid ? null : "Configure styling targets before continuing.");
					}
				})
			},
			{
				id: "preview",
				label: "Preview",
				componentFactory: (p) => /* @__PURE__ */ jsx(StylerStep6, {
					data: p.data,
					onChange: p.onChange,
					onValidate: (valid) => {
						p.setValid(valid);
						if (valid) p.setError(null);
					}
				})
			}
		];
	},
	getEditStepConfigs() {
		return this.getCreateStepConfigs();
	}
});

//#endregion
export { StylerSimpleDialog };
//# sourceMappingURL=index.js.map