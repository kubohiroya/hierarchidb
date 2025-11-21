import { d as normalizeDataSourceName, h as validateProcessingConfig, m as summarizeCheckboxState, u as mergeProcessingConfig } from "../shared.js";
import { a as SHAPE_PLUGIN_ID, r as DEFAULT_PROCESSING_CONFIG } from "../constants.js";
import { t as createShapeTabularApi } from "../createShapeTabularApi.js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PluginStepRegistry } from "@hierarchidb/plugin-base";
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Card, CardContent, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel, FormLabel, Grid, Paper, Radio, RadioGroup, Slider, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { DataSourceSelector } from "@hierarchidb/ui-datasource";
import { LicenseAgreementStep } from "@hierarchidb/ui-license";
import { Check, CloudDownload, ExpandMore, FilterAlt, Layers } from "@mui/icons-material";
import { useSnackbar } from "notistack";
import gadmMetadata from "@hierarchidb/fetch-save-metadata/output/gadm.json" with { type: "json" };
import geoboundariesMetadata from "@hierarchidb/fetch-save-metadata/output/geoboundaries.json" with { type: "json" };
import naturalearthMetadata from "@hierarchidb/fetch-save-metadata/output/naturalearth.json" with { type: "json" };
import osmMetadata from "@hierarchidb/fetch-save-metadata/output/osm.json" with { type: "json" };
import { TabularFileUploadStep, TabularFilterStep, TabularProvider, useTabularData } from "@hierarchidb/ui-tabular-extract";

//#region src/common/components/steps/Step1BasicInfo.tsx
/**
* Step 1: Basic Information
* Collects name and description for the shape-plugin configuration
*/
const Step1BasicInfo = ({ workingCopy, onUpdate, disabled }) => {
	return /* @__PURE__ */ jsxs(Box, {
		sx: { p: 3 },
		children: [
			/* @__PURE__ */ jsx(Typography, {
				variant: "h6",
				gutterBottom: true,
				children: "Basic Information"
			}),
			/* @__PURE__ */ jsx(Typography, {
				variant: "body2",
				color: "text.secondary",
				paragraph: true,
				children: "Provide basic information for this geographic data configuration."
			}),
			/* @__PURE__ */ jsxs(Stack, {
				spacing: 3,
				children: [/* @__PURE__ */ jsx(TextField, {
					label: "Name",
					value: workingCopy.name || "",
					onChange: (e) => onUpdate({ name: e.target.value }),
					required: true,
					fullWidth: true,
					disabled,
					error: !workingCopy.name,
					helperText: !workingCopy.name ? "Name is required" : "Enter a descriptive name for this configuration",
					inputProps: { maxLength: 100 }
				}), /* @__PURE__ */ jsx(TextField, {
					label: "Description",
					value: workingCopy.description || "",
					onChange: (e) => onUpdate({ description: e.target.value }),
					multiline: true,
					rows: 3,
					fullWidth: true,
					disabled,
					helperText: "Optional description of this geographic data configuration",
					inputProps: { maxLength: 500 }
				})]
			})
		]
	});
};

//#endregion
//#region src/common/mock/data.ts
const DATA_SOURCE_CONFIGS = {
	naturalearth: {
		name: "naturalearth",
		displayName: "Natural Earth",
		description: "Public domain map dataset available at scales suitable for world, regional, and country maps",
		license: "Public Domain",
		licenseUrl: "https://www.naturalearthdata.com/about/terms-of-use/",
		attribution: "Made with Natural Earth",
		color: "#4CAF50",
		icon: "🌍",
		maxAdminLevel: 1
	},
	geoboundaries: {
		name: "geoboundaries",
		displayName: "geoBoundaries",
		description: "Open-source administrative boundaries for every country in the world",
		license: "Creative Commons BY 4.0",
		licenseUrl: "https://www.geoboundaries.org/index.html#getdata",
		attribution: "Data from geoBoundaries.org",
		color: "#2196F3",
		icon: "🗺️",
		maxAdminLevel: 3
	},
	gadm: {
		name: "gadm",
		displayName: "GADM",
		description: "Database of Global Administrative Areas with detailed administrative boundaries",
		license: "Academic use only",
		licenseUrl: "https://gadm.org/license.html",
		attribution: "Data from GADM.org",
		color: "#FF9800",
		icon: "📊",
		maxAdminLevel: 5
	},
	openstreetmap: {
		name: "openstreetmap",
		displayName: "OpenStreetMap",
		description: "Community-driven open geographic database of the world",
		license: "ODbL 1.0",
		licenseUrl: "https://www.openstreetmap.org/copyright",
		attribution: "© OpenStreetMap contributors",
		color: "#9C27B0",
		icon: "🚗",
		maxAdminLevel: 4
	}
};
function formatBytes(bytes) {
	if (bytes === 0) return "0 Bytes";
	const k = 1024;
	const sizes = [
		"Bytes",
		"KB",
		"MB",
		"GB",
		"TB"
	];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return Math.round(bytes / k ** i * 100) / 100 + " " + sizes[i];
}
function formatNumber(num) {
	return new Intl.NumberFormat("en-US").format(num);
}
function calculateEstimatedSize(totalSelections) {
	return totalSelections * 5 * 1024 * 1024;
}
function calculateEstimatedFeatures(totalSelections, countries) {
	const avgPopulation = countries.reduce((sum, c) => sum + (c.population || 0), 0) / countries.length;
	return Math.floor(totalSelections * (avgPopulation / 1e6) * 100);
}
function calculateEstimatedProcessingTime(totalSelections) {
	const seconds = totalSelections * 30;
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor(seconds % 3600 / 60);
	if (hours > 0) return `${hours}h ${minutes}m`;
	return `${minutes}m`;
}

//#endregion
//#region src/common/components/steps/Step2DataSource.tsx
/**
* Step 2: Data Source Selection
* Uses @hierarchidb/_app-datasource components for data source selection
*/
const Step2DataSource = ({ workingCopy, onUpdate, disabled }) => {
	const options = Object.values(DATA_SOURCE_CONFIGS).map((source) => ({
		id: source.name,
		name: source.displayName,
		description: source.description,
		icon: source.icon,
		metadata: {
			license: source.license,
			licenseUrl: source.licenseUrl,
			attribution: source.attribution
		}
	}));
	const handleDataSourceSelect = (dataSourceName) => {
		onUpdate({
			dataSourceName,
			licenseAgreement: false,
			licenseAgreedAt: void 0
		});
	};
	const normalizedValue = normalizeDataSourceName(workingCopy.dataSourceName);
	const fallbackValue = options.find((option) => option.id === "geoboundaries")?.id ?? options[0]?.id ?? "";
	return /* @__PURE__ */ jsxs(Box, {
		sx: { p: 3 },
		children: [
			/* @__PURE__ */ jsx(Typography, {
				variant: "h6",
				gutterBottom: true,
				children: "Select Data Source"
			}),
			/* @__PURE__ */ jsx(Typography, {
				variant: "body2",
				color: "text.secondary",
				paragraph: true,
				children: "Choose a geographic data provider. Each source has different coverage, accuracy, and licensing requirements."
			}),
			/* @__PURE__ */ jsx(Box, {
				sx: { mt: 3 },
				children: /* @__PURE__ */ jsx(DataSourceSelector, {
					options,
					value: normalizedValue ?? fallbackValue,
					onChange: (next) => handleDataSourceSelect(next),
					disabled
				})
			})
		]
	});
};

//#endregion
//#region src/common/components/steps/Step3License.tsx
/**
* Step 3: License Agreement
* Uses @hierarchidb/_app-datasource components for license display
*/
const Step3License = ({ workingCopy, onUpdate, disabled }) => {
	const dataSourceKey = workingCopy.dataSourceName ?? "";
	const dataSource = dataSourceKey ? DATA_SOURCE_CONFIGS[dataSourceKey] : void 0;
	if (!dataSource) return /* @__PURE__ */ jsx(Box, {
		sx: { p: 3 },
		children: /* @__PURE__ */ jsx(Typography, {
			variant: "body2",
			color: "text.secondary",
			children: "Please select a data source first."
		})
	});
	const handleLicenseAgreement = () => {
		if (dataSource.licenseUrl) window.open(dataSource.licenseUrl, "_blank", "noopener,noreferrer");
		onUpdate({
			licenseAgreement: true,
			licenseAgreedAt: (/* @__PURE__ */ new Date()).toISOString()
		});
	};
	return /* @__PURE__ */ jsxs(Box, {
		sx: { p: 3 },
		children: [/* @__PURE__ */ jsx(Typography, {
			variant: "h6",
			gutterBottom: true,
			children: "License Agreement"
		}), /* @__PURE__ */ jsx(LicenseAgreementStep, {
			sourceName: dataSource.displayName,
			details: {
				licenseName: dataSource.license,
				attribution: dataSource.attribution,
				url: dataSource.licenseUrl
			},
			state: {
				agreed: Boolean(workingCopy.licenseAgreement),
				agreedAt: workingCopy.licenseAgreedAt
			},
			onAgree: handleLicenseAgreement,
			disabled
		})]
	});
};

//#endregion
//#region src/common/components/steps/Step4Processing.tsx
/**
* Step 4: Processing Configuration
* Uses @hierarchidb/ui-accordion-config for processing settings
*/
const Step4Processing = ({ workingCopy, onUpdate, disabled }) => {
	const config = mergeProcessingConfig(workingCopy.processingConfig ?? DEFAULT_PROCESSING_CONFIG);
	const baseDownloadConfig = config.downloadConfig ?? DEFAULT_PROCESSING_CONFIG.downloadConfig ?? { maxConcurrent: config.concurrentDownloads ?? 2 };
	const baseSimplificationConfig = config.simplificationConfig ?? DEFAULT_PROCESSING_CONFIG.simplificationConfig ?? {
		enableFiltering: config.enableFeatureFiltering ?? false,
		featureFilterMethod: config.featureFilterMethod ?? "hybrid",
		areaThreshold: config.featureAreaThreshold ?? .1,
		level1Workers: config.concurrentProcesses ?? 2,
		level2Workers: config.concurrentProcesses ?? 2,
		tolerance: config.simplificationTolerance ?? .01
	};
	const baseTileConfig = config.tileConfig ?? DEFAULT_PROCESSING_CONFIG.tileConfig ?? {
		workers: config.concurrentProcesses ?? 2,
		maxZoom: config.maxZoomLevel ?? 12
	};
	const applyConfigUpdate = (partial) => {
		onUpdate({ processingConfig: mergeProcessingConfig({
			...config,
			...partial
		}) });
	};
	return /* @__PURE__ */ jsxs(Box, {
		sx: { p: 2 },
		children: [
			/* @__PURE__ */ jsx(Typography, {
				variant: "h6",
				sx: { mb: 2 },
				children: "Configure Processing Parameters"
			}),
			/* @__PURE__ */ jsxs(Accordion, {
				defaultExpanded: true,
				children: [/* @__PURE__ */ jsx(AccordionSummary, {
					expandIcon: /* @__PURE__ */ jsx(ExpandMore, {}),
					children: /* @__PURE__ */ jsxs(Stack, {
						direction: "row",
						spacing: 2,
						alignItems: "center",
						children: [
							/* @__PURE__ */ jsx(CloudDownload, { color: "primary" }),
							/* @__PURE__ */ jsx(Typography, {
								variant: "subtitle1",
								children: "Download Configuration"
							}),
							/* @__PURE__ */ jsx(Chip, {
								label: `${config?.downloadConfig?.maxConcurrent ?? config?.concurrentDownloads ?? 2} concurrent`,
								size: "small",
								variant: "outlined"
							})
						]
					})
				}), /* @__PURE__ */ jsx(AccordionDetails, { children: /* @__PURE__ */ jsxs(Grid, {
					container: true,
					spacing: 3,
					children: [/* @__PURE__ */ jsxs(Grid, {
						size: {
							xs: 12,
							sm: 6
						},
						children: [/* @__PURE__ */ jsx(Typography, {
							gutterBottom: true,
							children: "Concurrent Downloads"
						}), /* @__PURE__ */ jsx(Slider, {
							value: baseDownloadConfig.maxConcurrent ?? config.concurrentDownloads ?? 2,
							onChange: (_, value) => {
								const maxConcurrent = value;
								applyConfigUpdate({
									concurrentDownloads: maxConcurrent,
									downloadConfig: {
										...baseDownloadConfig,
										maxConcurrent
									}
								});
							},
							min: 1,
							max: 8,
							step: 1,
							marks: [
								{
									value: 1,
									label: "1"
								},
								{
									value: 4,
									label: "4"
								},
								{
									value: 8,
									label: "8"
								}
							],
							valueLabelDisplay: "auto",
							disabled
						})]
					}), /* @__PURE__ */ jsx(Grid, {
						size: {
							xs: 12,
							sm: 6
						},
						children: /* @__PURE__ */ jsx(TextField, {
							label: "CORS Proxy Base URL",
							value: config?.corsProxyBaseURL || baseDownloadConfig.corsProxyUrl || "",
							onChange: (e) => {
								const corsProxyUrl = e.target.value;
								applyConfigUpdate({
									corsProxyBaseURL: corsProxyUrl,
									downloadConfig: {
										...baseDownloadConfig,
										corsProxyUrl
									}
								});
							},
							fullWidth: true,
							disabled,
							placeholder: "https://cors-anywhere.herokuapp.com/",
							helperText: "Optional proxy for cross-origin requests"
						})
					})]
				}) })]
			}),
			/* @__PURE__ */ jsxs(Accordion, { children: [/* @__PURE__ */ jsx(AccordionSummary, {
				expandIcon: /* @__PURE__ */ jsx(ExpandMore, {}),
				children: /* @__PURE__ */ jsxs(Stack, {
					direction: "row",
					spacing: 2,
					alignItems: "center",
					children: [
						/* @__PURE__ */ jsx(FilterAlt, { color: "secondary" }),
						/* @__PURE__ */ jsx(Typography, {
							variant: "subtitle1",
							children: "Feature Processing (Stage 1)"
						}),
						/* @__PURE__ */ jsx(Chip, {
							label: config?.enableFeatureFiltering ? "Filtering ON" : "Filtering OFF",
							size: "small",
							color: config?.enableFeatureFiltering ? "success" : "default",
							variant: "outlined"
						})
					]
				})
			}), /* @__PURE__ */ jsx(AccordionDetails, { children: /* @__PURE__ */ jsxs(Stack, {
				spacing: 3,
				children: [/* @__PURE__ */ jsx(FormControlLabel, {
					control: /* @__PURE__ */ jsx(Switch, {
						checked: baseSimplificationConfig.enableFiltering ?? config.enableFeatureFiltering ?? false,
						onChange: (e) => {
							const enableFiltering = e.target.checked;
							applyConfigUpdate({
								enableFeatureFiltering: enableFiltering,
								simplificationConfig: {
									...baseSimplificationConfig,
									enableFiltering
								}
							});
						},
						disabled
					}),
					label: "Enable Feature Filtering"
				}), (baseSimplificationConfig.enableFiltering ?? config.enableFeatureFiltering) && /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs(FormControl, {
					component: "fieldset",
					children: [/* @__PURE__ */ jsx(FormLabel, {
						component: "legend",
						children: "Filtering Method"
					}), /* @__PURE__ */ jsxs(RadioGroup, {
						value: baseSimplificationConfig.featureFilterMethod || config.featureFilterMethod || "hybrid",
						onChange: (e) => {
							const method = e.target.value;
							applyConfigUpdate({
								featureFilterMethod: method,
								simplificationConfig: {
									...baseSimplificationConfig,
									featureFilterMethod: method
								}
							});
						},
						children: [
							/* @__PURE__ */ jsx(FormControlLabel, {
								value: "bbox_only",
								control: /* @__PURE__ */ jsx(Radio, {}),
								label: "Bounding Box Only (Fastest)",
								disabled
							}),
							/* @__PURE__ */ jsx(FormControlLabel, {
								value: "polygon_only",
								control: /* @__PURE__ */ jsx(Radio, {}),
								label: "Polygon Area Only (Most Accurate)",
								disabled
							}),
							/* @__PURE__ */ jsx(FormControlLabel, {
								value: "hybrid",
								control: /* @__PURE__ */ jsx(Radio, {}),
								label: "Hybrid Method (Balanced)",
								disabled
							})
						]
					})]
				}), /* @__PURE__ */ jsxs(Box, { children: [/* @__PURE__ */ jsx(Typography, {
					gutterBottom: true,
					children: "Feature Area Threshold (%)"
				}), /* @__PURE__ */ jsx(Slider, {
					value: baseSimplificationConfig.areaThreshold ?? config.featureAreaThreshold ?? .1,
					onChange: (_, value) => {
						const threshold = value;
						applyConfigUpdate({
							featureAreaThreshold: threshold,
							simplificationConfig: {
								...baseSimplificationConfig,
								areaThreshold: threshold
							}
						});
					},
					min: .001,
					max: 10,
					step: .001,
					valueLabelFormat: (value) => `${value}%`,
					valueLabelDisplay: "auto",
					disabled
				})] })] })]
			}) })] }),
			/* @__PURE__ */ jsxs(Accordion, { children: [/* @__PURE__ */ jsx(AccordionSummary, {
				expandIcon: /* @__PURE__ */ jsx(ExpandMore, {}),
				children: /* @__PURE__ */ jsxs(Stack, {
					direction: "row",
					spacing: 2,
					alignItems: "center",
					children: [
						/* @__PURE__ */ jsx(Layers, { color: "success" }),
						/* @__PURE__ */ jsx(Typography, {
							variant: "subtitle1",
							children: "Vector Tile Generation"
						}),
						/* @__PURE__ */ jsx(Chip, {
							label: `${baseTileConfig.workers ?? config.concurrentProcesses ?? 2} concurrent`,
							size: "small",
							variant: "outlined"
						})
					]
				})
			}), /* @__PURE__ */ jsx(AccordionDetails, { children: /* @__PURE__ */ jsxs(Grid, {
				container: true,
				spacing: 3,
				children: [/* @__PURE__ */ jsx(Grid, {
					size: {
						xs: 12,
						sm: 6
					},
					children: /* @__PURE__ */ jsx(TextField, {
						label: "Concurrent Processes",
						type: "number",
						value: baseTileConfig.workers ?? config.concurrentProcesses ?? 2,
						onChange: (e) => {
							const workers = parseInt(e.target.value) || 2;
							applyConfigUpdate({
								concurrentProcesses: workers,
								tileConfig: {
									...baseTileConfig,
									workers
								}
							});
						},
						inputProps: {
							min: 1,
							max: 8
						},
						fullWidth: true,
						disabled,
						helperText: "Number of simultaneous tile processors (1-8)"
					})
				}), /* @__PURE__ */ jsx(Grid, {
					size: {
						xs: 12,
						sm: 6
					},
					children: /* @__PURE__ */ jsx(TextField, {
						label: "Max Zoom Level",
						type: "number",
						value: baseTileConfig.maxZoom ?? config.maxZoomLevel ?? 12,
						onChange: (e) => {
							const maxZoom = parseInt(e.target.value) || 12;
							applyConfigUpdate({
								maxZoomLevel: maxZoom,
								tileConfig: {
									...baseTileConfig,
									maxZoom
								}
							});
						},
						inputProps: {
							min: 8,
							max: 18
						},
						fullWidth: true,
						disabled,
						helperText: "Maximum zoom level for vector tiles (8-18)"
					})
				})]
			}) })] })
		]
	});
};

//#endregion
//#region src/services/metadata/MetadataLoader.ts
/**
* MetadataLoader service
* Loads country metadata from @hierarchidb/fetch-save-metadata output files
*/
var MetadataLoader = class MetadataLoader {
	static instance = null;
	metadataCache = /* @__PURE__ */ new Map();
	metadataModules = {
		gadm: gadmMetadata,
		geoboundaries: geoboundariesMetadata,
		naturalearth: naturalearthMetadata,
		openstreetmap: osmMetadata
	};
	constructor() {}
	static getInstance() {
		if (!MetadataLoader.instance) MetadataLoader.instance = new MetadataLoader();
		return MetadataLoader.instance;
	}
	/**
	* Load metadata for a specific data source
	*/
	async loadMetadata(dataSource) {
		const normalized = normalizeDataSourceName(dataSource);
		if (!normalized) {
			console.warn(`No metadata file mapping for data source: ${dataSource}`);
			return [];
		}
		if (this.metadataCache.has(normalized)) return this.metadataCache.get(normalized);
		try {
			const moduleData = this.metadataModules[normalized];
			if (!moduleData) {
				console.warn(`Unknown data source: ${normalized}`);
				return [];
			}
			const rawData = moduleData;
			const metadata = this.transformMetadata(rawData, normalized);
			this.metadataCache.set(normalized, metadata);
			return metadata;
		} catch (error) {
			console.error(`Error loading metadata for ${normalized}:`, error);
			return [];
		}
	}
	/**
	* Transform raw metadata to CountryMetadata format
	*/
	transformMetadata(rawData, _dataSource) {
		return rawData.map((item) => ({
			countryCode: item.countryCode ?? "UNKNOWN",
			countryName: item.countryName || "",
			continent: item.continent || "",
			availableAdminLevels: item.availableAdminLevels || [],
			population: item.population,
			area: item.area,
			dataQuality: this.determineDataQuality(item)
		}));
	}
	/**
	* Determine data quality based on metadata
	*/
	determineDataQuality(item) {
		const numLevels = item.adminLevels?.length || 0;
		if (numLevels >= 4) return "high";
		if (numLevels >= 2) return "medium";
		return "low";
	}
	/**
	* Get metadata for a specific country
	*/
	async getCountryMetadata(dataSource, countryCode) {
		return (await this.loadMetadata(dataSource)).find((country) => country.countryCode === countryCode || country.countryCode.toLowerCase() === countryCode.toLowerCase());
	}
	/**
	* Get metadata for multiple countries
	*/
	async getCountriesMetadata(dataSource, countryCodes) {
		const allMetadata = await this.loadMetadata(dataSource);
		const lowerCodes = countryCodes.map((code) => code.toLowerCase());
		return allMetadata.filter((country) => lowerCodes.includes(country.countryCode.toLowerCase()));
	}
	/**
	* Clear cache for a specific data source or all
	*/
	clearCache(dataSource) {
		if (dataSource) {
			const normalized = normalizeDataSourceName(dataSource);
			if (normalized) this.metadataCache.delete(normalized);
		} else this.metadataCache.clear();
	}
	/**
	* Get all available data sources
	*/
	getAvailableDataSources() {
		return Object.keys(this.metadataModules);
	}
};
const metadataLoader = MetadataLoader.getInstance();

//#endregion
//#region src/common/hooks/useCountryMetadata.ts
/**
* Hook to load and use country metadata from 02-fetch-save-metadata
*/
function useCountryMetadata({ dataSource, countryCodes }) {
	const normalizedDataSource = normalizeDataSourceName(dataSource ?? "") ?? "";
	const [metadata, setMetadata] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const loadMetadata = useCallback(async () => {
		if (!normalizedDataSource) {
			setMetadata([]);
			setLoading(false);
			return;
		}
		setLoading(true);
		setError(null);
		try {
			let data;
			if (countryCodes && countryCodes.length > 0) data = await metadataLoader.getCountriesMetadata(normalizedDataSource, countryCodes);
			else data = await metadataLoader.loadMetadata(normalizedDataSource);
			setMetadata(data);
		} catch (err) {
			setError(err instanceof Error ? err : /* @__PURE__ */ new Error("Failed to load metadata"));
			setMetadata([]);
		} finally {
			setLoading(false);
		}
	}, [normalizedDataSource, countryCodes]);
	useEffect(() => {
		loadMetadata();
	}, [loadMetadata]);
	return {
		metadata,
		loading,
		error,
		reload: loadMetadata,
		getCountryName: useCallback((countryCode) => {
			return metadata.find((c) => c.countryCode.toLowerCase() === countryCode.toLowerCase())?.countryName || countryCode;
		}, [metadata]),
		getCountryByCode: useCallback((countryCode) => {
			return metadata.find((c) => c.countryCode.toLowerCase() === countryCode.toLowerCase());
		}, [metadata])
	};
}

//#endregion
//#region src/common/components/steps/Step5CountrySelection.tsx
/**
* Step 5: Country & Admin Level Selection
* Uses real country metadata from @hierarchidb/fetch-save-metadata
*/
const Step5CountrySelection = ({ workingCopy, onUpdate, disabled }) => {
	const { enqueueSnackbar } = useSnackbar();
	const dataSourceKey = normalizeDataSourceName(workingCopy.dataSourceName) ?? "gadm";
	const { metadata: countries, loading, error } = useCountryMetadata({ dataSource: dataSourceKey });
	const maxAdminLevel = DATA_SOURCE_CONFIGS[dataSourceKey]?.maxAdminLevel ?? 0;
	const checkboxMatrix = useMemo(() => {
		if (Array.isArray(workingCopy.checkboxState)) return workingCopy.checkboxState.map((row) => {
			if (!Array.isArray(row)) return Array.from({ length: maxAdminLevel + 1 }, () => false);
			return Array.from({ length: maxAdminLevel + 1 }, (_, idx) => Boolean(row[idx]));
		});
		return countries.map(() => Array.from({ length: maxAdminLevel + 1 }, () => false));
	}, [
		workingCopy.checkboxState,
		countries,
		maxAdminLevel
	]);
	const stats = useMemo(() => {
		let totalSelected = 0;
		let countriesWithSelection = 0;
		const levelCounts = Array(maxAdminLevel + 1).fill(0);
		checkboxMatrix.forEach((row) => {
			let hasAnySelection = false;
			row.forEach((selected, levelIndex) => {
				if (selected && levelIndex <= maxAdminLevel) {
					totalSelected++;
					levelCounts[levelIndex]++;
					hasAnySelection = true;
				}
			});
			if (hasAnySelection) countriesWithSelection++;
		});
		return {
			totalSelected,
			countriesWithSelection,
			levelCounts,
			estimatedSize: calculateEstimatedSize(totalSelected),
			estimatedFeatures: calculateEstimatedFeatures(totalSelected, countries),
			estimatedTime: calculateEstimatedProcessingTime(totalSelected)
		};
	}, [
		checkboxMatrix,
		countries,
		maxAdminLevel
	]);
	const handleCellChange = useCallback((countryIndex, levelIndex, checked) => {
		const clonedMatrix = checkboxMatrix.map((row$1) => [...row$1]);
		const row = clonedMatrix[countryIndex];
		if (!row || levelIndex < 0 || levelIndex >= row.length) return;
		const nextRow = [...row];
		nextRow[levelIndex] = checked;
		clonedMatrix[countryIndex] = nextRow;
		onUpdate({ checkboxState: clonedMatrix });
	}, [checkboxMatrix, onUpdate]);
	const handleValidateSelection = useCallback(() => {
		enqueueSnackbar(`${stats.totalSelected} selections validated. Est. size: ${formatBytes(stats.estimatedSize)}, processing time: ${stats.estimatedTime}`, { variant: "success" });
	}, [stats, enqueueSnackbar]);
	if (loading) return /* @__PURE__ */ jsxs(Box, {
		sx: {
			height: "70vh",
			display: "flex",
			alignItems: "center",
			justifyContent: "center"
		},
		children: [/* @__PURE__ */ jsx(CircularProgress, {}), /* @__PURE__ */ jsx(Typography, {
			sx: { ml: 2 },
			children: "Loading country metadata..."
		})]
	});
	if (error) return /* @__PURE__ */ jsx(Box, {
		sx: {
			height: "70vh",
			display: "flex",
			flexDirection: "column"
		},
		children: /* @__PURE__ */ jsxs(Alert, {
			severity: "error",
			children: ["Failed to load country metadata: ", error.message]
		})
	});
	return /* @__PURE__ */ jsxs(Box, {
		sx: {
			height: "70vh",
			display: "flex",
			flexDirection: "column"
		},
		children: [
			/* @__PURE__ */ jsx(Typography, {
				variant: "h6",
				gutterBottom: true,
				children: "Select Countries & Administrative Levels"
			}),
			/* @__PURE__ */ jsx(Typography, {
				variant: "body2",
				color: "text.secondary",
				paragraph: true,
				children: "Select countries and their administrative levels to download. Use the matrix to make precise selections."
			}),
			/* @__PURE__ */ jsx(Paper, {
				sx: {
					p: 2,
					mb: 2,
					backgroundColor: "grey.50"
				},
				children: /* @__PURE__ */ jsxs(Stack, {
					direction: "row",
					spacing: 4,
					alignItems: "center",
					children: [
						/* @__PURE__ */ jsxs(Stack, {
							direction: "row",
							spacing: 1,
							alignItems: "center",
							children: [/* @__PURE__ */ jsx(Chip, {
								label: `${stats.countriesWithSelection} countries`,
								size: "small",
								color: "primary",
								variant: "outlined"
							}), /* @__PURE__ */ jsx(Chip, {
								label: `${stats.totalSelected} selections`,
								size: "small",
								color: "secondary",
								variant: "outlined"
							})]
						}),
						/* @__PURE__ */ jsx(Stack, {
							direction: "row",
							spacing: 1,
							children: stats.levelCounts.map((count, level) => count > 0 && /* @__PURE__ */ jsx(Chip, {
								label: `L${level}: ${count}`,
								size: "small",
								variant: "outlined"
							}, level))
						}),
						/* @__PURE__ */ jsxs(Stack, {
							direction: "row",
							spacing: 2,
							sx: { ml: "auto" },
							children: [
								/* @__PURE__ */ jsxs(Typography, {
									variant: "caption",
									color: "text.secondary",
									children: ["Est. Size: ", formatBytes(stats.estimatedSize)]
								}),
								/* @__PURE__ */ jsxs(Typography, {
									variant: "caption",
									color: "text.secondary",
									children: ["Est. Features: ", formatNumber(stats.estimatedFeatures)]
								}),
								/* @__PURE__ */ jsx(Button, {
									variant: "outlined",
									size: "small",
									startIcon: /* @__PURE__ */ jsx(Check, {}),
									onClick: handleValidateSelection,
									disabled: stats.totalSelected === 0 || disabled,
									children: "Validate"
								})
							]
						})
					]
				})
			}),
			/* @__PURE__ */ jsx(TableContainer, {
				component: Paper,
				sx: {
					flex: 1,
					overflow: "auto"
				},
				children: /* @__PURE__ */ jsxs(Table, {
					stickyHeader: true,
					size: "small",
					children: [/* @__PURE__ */ jsx(TableHead, { children: /* @__PURE__ */ jsxs(TableRow, { children: [/* @__PURE__ */ jsx(TableCell, { children: "Country" }), Array.from({ length: maxAdminLevel + 1 }, (_, i) => /* @__PURE__ */ jsxs(TableCell, {
						align: "center",
						children: ["Level ", i]
					}, i))] }) }), /* @__PURE__ */ jsx(TableBody, { children: countries.map((country, countryIndex) => /* @__PURE__ */ jsxs(TableRow, { children: [/* @__PURE__ */ jsx(TableCell, { children: /* @__PURE__ */ jsxs(Stack, {
						direction: "row",
						spacing: 1,
						alignItems: "center",
						children: [/* @__PURE__ */ jsx(Typography, {
							variant: "body2",
							children: country.countryCode
						}), /* @__PURE__ */ jsx(Typography, {
							variant: "caption",
							color: "text.secondary",
							children: country.countryName
						})]
					}) }), Array.from({ length: maxAdminLevel + 1 }, (_, levelIndex) => /* @__PURE__ */ jsx(TableCell, {
						align: "center",
						children: country.availableAdminLevels.includes(levelIndex) ? /* @__PURE__ */ jsx(Checkbox, {
							checked: checkboxMatrix[countryIndex]?.[levelIndex] || false,
							onChange: (e) => handleCellChange(countryIndex, levelIndex, e.target.checked),
							disabled,
							size: "small"
						}) : /* @__PURE__ */ jsx(Typography, {
							variant: "caption",
							color: "text.disabled",
							children: "-"
						})
					}, levelIndex))] }, country.countryCode)) })]
				})
			}),
			stats.totalSelected === 0 && /* @__PURE__ */ jsx(Alert, {
				severity: "info",
				sx: { mt: 2 },
				children: "Please select at least one country and administrative level to proceed."
			})
		]
	});
};

//#endregion
//#region src/common/components/steps/StepTabularUpload.tsx
function StepTabularUpload({ data: workingCopy, onChange, setValid, setError, disabled }) {
	const tabularApi = useMemo(() => createShapeTabularApi(), []);
	const [localError, setLocalError] = useState(null);
	const applyMetadata = useCallback((metadata) => {
		const inferredType = metadata.filename?.toLowerCase().endsWith(".tsv") ? "text/tab-separated-values" : metadata.filename?.toLowerCase().endsWith(".json") ? "application/json" : "text/csv";
		const nextFile = {
			name: metadata.filename,
			sizeBytes: metadata.fileSizeBytes ?? 0,
			type: inferredType,
			lastModifiedAt: Date.now()
		};
		onChange({
			...workingCopy,
			tabularMetadataId: metadata.id,
			tabularMetadata: metadata,
			tabularFile: nextFile
		});
		setLocalError(null);
		setError?.(null);
		setValid?.(true);
	}, [
		onChange,
		setError,
		setValid,
		workingCopy
	]);
	const handleUploadError = useCallback((message) => {
		setLocalError(message);
		setValid?.(false);
		setError?.(message);
	}, [setError, setValid]);
	useEffect(() => {
		if (Boolean(workingCopy?.tabularMetadataId)) {
			setValid?.(true);
			setError?.(null);
		} else if (!localError) {
			setValid?.(false);
			setError?.("Upload a dataset before continuing.");
		}
	}, [
		localError,
		setError,
		setValid,
		workingCopy?.tabularMetadataId
	]);
	return /* @__PURE__ */ jsxs(Box, {
		sx: { p: 3 },
		children: [
			/* @__PURE__ */ jsx(Typography, {
				variant: "h6",
				gutterBottom: true,
				children: "Upload Dataset"
			}),
			/* @__PURE__ */ jsx(Typography, {
				variant: "body2",
				color: "text.secondary",
				paragraph: true,
				children: "Import Tabular/TSV files that describe the shapes you plan to process. The data will be stored in the shared tabular store so other plugins can reuse it."
			}),
			/* @__PURE__ */ jsx(TabularProvider, {
				tabularApi,
				children: /* @__PURE__ */ jsx(TabularFileUploadStep, {
					pluginId: SHAPE_PLUGIN_ID,
					onFileUploaded: applyMetadata,
					onError: handleUploadError,
					disabled
				})
			}),
			!workingCopy?.tabularMetadataId && /* @__PURE__ */ jsx(Typography, {
				variant: "body2",
				color: "text.secondary",
				sx: { mt: 2 },
				children: "Select a file to enable preview and filtering in the next step."
			})
		]
	});
}

//#endregion
//#region src/common/components/steps/StepTabularFilter.tsx
function StepTabularFilter({ data: workingCopy, onChange, setValid, setError }) {
	const tabularApi = useMemo(() => createShapeTabularApi(), []);
	const { metadata, loading, error } = useTabularData({
		tableMetadataId: workingCopy?.tabularMetadataId,
		pluginId: SHAPE_PLUGIN_ID,
		autoload: Boolean(workingCopy?.tabularMetadataId)
	});
	useEffect(() => {
		if (workingCopy?.tabularMetadataId) {
			setValid?.(true);
			setError?.(error ?? null);
		} else {
			setValid?.(false);
			setError?.("Upload a dataset before applying filters.");
		}
	}, [
		error,
		setError,
		setValid,
		workingCopy?.tabularMetadataId
	]);
	const handleFiltersChanged = useCallback((filters) => {
		onChange({
			...workingCopy,
			tabularFilters: filters
		});
	}, [onChange, workingCopy]);
	const handlePreviewData = useCallback((preview) => {
		onChange({
			...workingCopy,
			tabularLastPreview: preview
		});
	}, [onChange, workingCopy]);
	const content = (() => {
		if (!workingCopy?.tabularMetadataId) return /* @__PURE__ */ jsx(Typography, {
			color: "text.secondary",
			children: "Upload a dataset in the previous step to configure filters."
		});
		if (loading) return /* @__PURE__ */ jsxs(Box, {
			display: "flex",
			alignItems: "center",
			gap: 1,
			children: [/* @__PURE__ */ jsx(CircularProgress, { size: 18 }), /* @__PURE__ */ jsx(Typography, {
				variant: "body2",
				color: "text.secondary",
				children: "Loading table metadata..."
			})]
		});
		if (error) return /* @__PURE__ */ jsx(Typography, {
			color: "error",
			children: error
		});
		if (!metadata) return /* @__PURE__ */ jsx(Typography, {
			color: "text.secondary",
			children: "No table metadata found for the selected dataset."
		});
		return /* @__PURE__ */ jsx(TabularFilterStep, {
			tableMetadata: metadata,
			pluginId: SHAPE_PLUGIN_ID,
			onFiltersChanged: handleFiltersChanged,
			onPreviewData: handlePreviewData
		});
	})();
	return /* @__PURE__ */ jsxs(Box, {
		sx: { p: 3 },
		children: [
			/* @__PURE__ */ jsx(Typography, {
				variant: "h6",
				gutterBottom: true,
				children: "Preview & Filter"
			}),
			/* @__PURE__ */ jsx(Typography, {
				variant: "body2",
				color: "text.secondary",
				paragraph: true,
				children: "Inspect rows and define filters that downstream batch processing should respect."
			}),
			/* @__PURE__ */ jsx(TabularProvider, {
				tabularApi,
				children: content
			})
		]
	});
}

//#endregion
//#region src/ui/components/steps-provider.tsx
const registry = PluginStepRegistry.getInstance();
function createStepAdapter(Component) {
	return function ShapeStepAdapter(props) {
		const workingCopy = props.data ?? {};
		const handleUpdate = (updates) => {
			props.onChange({
				...props.data ?? {},
				...updates
			});
		};
		return /* @__PURE__ */ jsx(Component, {
			workingCopy,
			onUpdate: handleUpdate,
			disabled: Boolean(props.disabled)
		});
	};
}
const Step1 = createStepAdapter(Step1BasicInfo);
const Step2 = createStepAdapter(Step2DataSource);
const Step3 = createStepAdapter(Step3License);
const Step4 = createStepAdapter(Step4Processing);
const Step5 = createStepAdapter(Step5CountrySelection);
registry.registerConfigProvider({
	nodeType: "shape",
	getCreateStepConfigs() {
		return [
			{
				id: "tabular-upload",
				label: "Dataset Upload",
				componentFactory: (props) => /* @__PURE__ */ jsx(StepTabularUpload, { ...props }),
				validate: (data) => Boolean(data?.tabularMetadataId)
			},
			{
				id: "tabular-filter",
				label: "Dataset Filter",
				componentFactory: (props) => /* @__PURE__ */ jsx(StepTabularFilter, { ...props }),
				validate: (data) => Boolean(data?.tabularMetadataId)
			},
			{
				id: "basic-info",
				label: "Basic Information",
				componentFactory: (props) => /* @__PURE__ */ jsx(Step1, { ...props }),
				validate: (data) => Boolean(data?.name?.trim())
			},
			{
				id: "data-source",
				label: "Data Source",
				componentFactory: (props) => /* @__PURE__ */ jsx(Step2, { ...props }),
				validate: (data) => Boolean(data?.dataSourceName)
			},
			{
				id: "license-agreement",
				label: "License Agreement",
				componentFactory: (props) => /* @__PURE__ */ jsx(Step3, { ...props }),
				validate: (data) => Boolean(data?.licenseAgreement)
			},
			{
				id: "processing-configuration",
				label: "Processing Configuration",
				componentFactory: (props) => /* @__PURE__ */ jsx(Step4, { ...props }),
				validate: (data) => validateProcessingConfig(mergeProcessingConfig(data?.processingConfig ?? DEFAULT_PROCESSING_CONFIG)).isValid
			},
			{
				id: "country-selection",
				label: "Country Selection",
				componentFactory: (props) => /* @__PURE__ */ jsx(Step5, { ...props }),
				validate: (data) => summarizeCheckboxState(data?.checkboxState).hasSelection
			}
		];
	},
	getEditStepConfigs(_nodeId, _data) {
		return this.getCreateStepConfigs();
	}
});

//#endregion
//#region src/ui/components/ShapeDialog.tsx
function ShapeDialog({ mode, nodeId, parentId, open, onClose, onSuccess, onError }) {
	const [name, setName] = useState("");
	const handleSubmit = () => {
		try {
			const now = Date.now();
			const id = nodeId ?? `shape-${now}`;
			const entity = {
				id,
				nodeId: id,
				name: name.trim() || (mode === "create" ? "New shape" : "Shape"),
				description: "",
				dataSourceName: "naturalearth",
				licenseAgreement: true,
				processingConfig: mergeProcessingConfig(DEFAULT_PROCESSING_CONFIG),
				checkboxState: [],
				selectedCountries: [],
				adminLevels: [],
				urlMetadata: [],
				createdAt: now,
				updatedAt: now,
				version: 1
			};
			onSuccess?.(entity);
			onClose();
		} catch (error) {
			onError?.(error instanceof Error ? error : /* @__PURE__ */ new Error("failed to submit shape"));
		}
	};
	return /* @__PURE__ */ jsxs(Dialog, {
		open,
		onClose,
		maxWidth: "sm",
		fullWidth: true,
		children: [
			/* @__PURE__ */ jsx(DialogTitle, { children: mode === "create" ? "Create Shape" : "Edit Shape" }),
			/* @__PURE__ */ jsx(DialogContent, { children: /* @__PURE__ */ jsx(TextField, {
				fullWidth: true,
				label: "Name",
				value: name,
				onChange: (event) => setName(event.target.value),
				margin: "dense"
			}) }),
			/* @__PURE__ */ jsxs(DialogActions, { children: [/* @__PURE__ */ jsx(Button, {
				onClick: onClose,
				children: "Cancel"
			}), /* @__PURE__ */ jsx(Button, {
				variant: "contained",
				onClick: handleSubmit,
				children: "Save"
			})] })
		]
	});
}

//#endregion
//#region src/ui/components/ShapePanel.tsx
function ShapePanel({ nodeId, entity }) {
	return /* @__PURE__ */ jsx(Card, {
		variant: "outlined",
		children: /* @__PURE__ */ jsxs(CardContent, { children: [
			/* @__PURE__ */ jsx(Typography, {
				variant: "h6",
				children: "Shape Summary"
			}),
			/* @__PURE__ */ jsxs(Typography, {
				variant: "body2",
				color: "text.secondary",
				children: ["Node: ", nodeId]
			}),
			/* @__PURE__ */ jsx(Typography, {
				variant: "body1",
				children: entity.name ?? "Untitled shape"
			}),
			/* @__PURE__ */ jsxs(Typography, {
				variant: "body2",
				color: "text.secondary",
				children: ["Data source: ", entity.dataSourceName ?? "unknown"]
			})
		] })
	});
}

//#endregion
//#region src/ui/components/TilePreview.tsx
function TilePreview({ sessionId, nodeId }) {
	return null;
}

//#endregion
//#region src/ui/hooks/useShapeAPI.ts
function useShapeAPI() {
	return useMemo(() => Promise.reject(/* @__PURE__ */ new Error("Shape API is not available in the refactored UI yet.")), []);
}
function useShapeAPIGetter() {
	return useMemo(() => () => Promise.reject(/* @__PURE__ */ new Error("Shape API getter is not available.")), []);
}

//#endregion
//#region src/ui/hooks/useShapeBatchCommand.ts
function useShapeBatchCommand() {
	return useCallback(async (_command, _payload) => {
		throw new Error("Shape batch command API is not available in the refactored UI yet.");
	}, []);
}

//#endregion
//#region src/ui/hooks/useShapeProgress.ts
function useShapeProgress(_sessionId, _options = {}) {
	return {
		progress: null,
		status: null,
		isSubscribed: false,
		error: null,
		subscribe: () => void 0,
		unsubscribe: () => void 0,
		refresh: async () => void 0
	};
}

//#endregion
//#region src/ui/auth/setShapeAuthToken.ts
async function setShapeAuthToken(_token, _type = "Bearer") {}
function injectWorkerAPIGetter() {}

//#endregion
export { ShapeDialog, ShapePanel, TilePreview, injectWorkerAPIGetter, setShapeAuthToken, useShapeAPI, useShapeAPIGetter, useShapeBatchCommand, useShapeProgress };
//# sourceMappingURL=index.js.map