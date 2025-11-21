import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Chip, FormControlLabel, IconButton, List, ListItem, ListItemText, Paper, Slider, Stack, Switch, TextField, Tooltip, Typography } from "@mui/material";
import { jsx, jsxs } from "react/jsx-runtime";
import { Map, Pause, PlayArrow, SkipNext, SkipPrevious } from "@mui/icons-material";
import { FRAME_CONSTANTS, HeadlessMultiStepDialog, getPresetSize, getViewportSize, initialPosition, normalizeDialogState, positionsEqual, sizesEqual } from "@hierarchidb/ui-dialog";
import { PluginStepRegistry } from "@hierarchidb/plugin-base";

//#region src/ui/steps/BasicInfoStep.tsx
function BasicInfoStep({ values, onChange }) {
	return /* @__PURE__ */ jsxs(Box, {
		sx: {
			display: "flex",
			flexDirection: "column",
			gap: 2
		},
		children: [/* @__PURE__ */ jsx(TextField, {
			label: "Name",
			size: "small",
			value: values.name,
			onChange: (e) => onChange({
				...values,
				name: e.target.value
			}),
			required: true
		}), /* @__PURE__ */ jsx(TextField, {
			label: "Description",
			size: "small",
			value: values.description || "",
			onChange: (e) => onChange({
				...values,
				description: e.target.value
			}),
			multiline: true,
			minRows: 2
		})]
	});
}

//#endregion
//#region src/ui/steps/FramesPreviewStep.tsx
function FramesPreviewStep({ frames, title = "Frames (flattened descendants)" }) {
	const sorted = useMemo(() => [...frames].sort((a, b) => a.name.localeCompare(b.name)), [frames]);
	return /* @__PURE__ */ jsxs(Box, { children: [/* @__PURE__ */ jsx(Typography, {
		variant: "subtitle1",
		sx: { mb: 1 },
		children: title
	}), /* @__PURE__ */ jsxs(List, {
		dense: true,
		sx: {
			maxHeight: 300,
			overflow: "auto",
			border: "1px solid",
			borderColor: "divider"
		},
		children: [sorted.map((f) => /* @__PURE__ */ jsx(ListItem, {
			disableGutters: true,
			children: /* @__PURE__ */ jsx(ListItemText, {
				primary: f.name,
				secondary: f.id
			})
		}, f.id)), sorted.length === 0 && /* @__PURE__ */ jsx(ListItem, { children: /* @__PURE__ */ jsx(ListItemText, { primary: "No frames found" }) })]
	})] });
}

//#endregion
//#region src/ui/steps/MapPreviewStep.tsx
function MapPreviewStep({ frames, initialIndex = 0, onIndexChange }) {
	const [index, setIndex] = useState(Math.min(initialIndex, Math.max(0, frames.length - 1)));
	const [fps, setFps] = useState(12);
	const [loop, setLoop] = useState(true);
	const frame = useMemo(() => frames[index] || null, [frames, index]);
	const viewState = useMemo(() => {
		if (frame?.viewState) {
			const { longitude, latitude, zoom = 4, bearing = 0, pitch = 0 } = frame.viewState;
			return {
				longitude,
				latitude,
				zoom,
				bearing,
				pitch
			};
		}
		return {
			longitude: 139.7671,
			latitude: 35.6812,
			zoom: 4,
			bearing: 0,
			pitch: 0
		};
	}, [frame]);
	return /* @__PURE__ */ jsxs(Stack, {
		spacing: 2,
		children: [
			/* @__PURE__ */ jsx(Typography, {
				variant: "subtitle1",
				children: "Map Preview"
			}),
			/* @__PURE__ */ jsxs(Paper, {
				variant: "outlined",
				sx: {
					height: 260,
					position: "relative",
					overflow: "hidden",
					borderRadius: 2,
					background: "radial-gradient(circle at 20% 20%, rgba(123,174,255,0.35), transparent 55%),            radial-gradient(circle at 80% 30%, rgba(132, 215, 247, 0.45), transparent 60%),            linear-gradient(135deg, rgba(33,150,243,0.35), rgba(156,39,176,0.25))",
					"&::after": {
						content: "\"\"",
						position: "absolute",
						inset: 0,
						background: "radial-gradient(circle at 50% 120%, rgba(255,255,255,0.15), transparent 70%)",
						mixBlendMode: "screen"
					}
				},
				children: [/* @__PURE__ */ jsxs(Box, {
					sx: {
						position: "absolute",
						top: 16,
						left: 16,
						display: "flex",
						alignItems: "center",
						gap: 1,
						px: 1.5,
						py: .75,
						borderRadius: 1,
						bgcolor: (theme) => theme.palette.background.paper,
						boxShadow: 1
					},
					children: [
						/* @__PURE__ */ jsx(Map, {
							fontSize: "small",
							color: "action"
						}),
						/* @__PURE__ */ jsx(Typography, {
							variant: "body2",
							fontWeight: 600,
							children: frame?.name ?? "Frame"
						}),
						/* @__PURE__ */ jsx(Chip, {
							size: "small",
							label: `${viewState.longitude.toFixed(2)}, ${viewState.latitude.toFixed(2)} / z${viewState.zoom.toFixed(1)}`,
							sx: { fontWeight: 500 }
						})
					]
				}), /* @__PURE__ */ jsxs(Box, {
					sx: {
						position: "absolute",
						bottom: 16,
						left: 16,
						pr: 4,
						color: "common.white",
						textShadow: "0 0 8px rgba(0,0,0,0.35)"
					},
					children: [/* @__PURE__ */ jsxs(Typography, {
						variant: "body2",
						children: ["Active selections: ", frame ? index + 1 : 0]
					}), /* @__PURE__ */ jsxs(Typography, {
						variant: "caption",
						display: "block",
						children: [
							"Bearing ",
							viewState.bearing?.toFixed?.(1) ?? "0",
							"°, Pitch ",
							viewState.pitch?.toFixed?.(1) ?? "0",
							"°"
						]
					})]
				})]
			}),
			/* @__PURE__ */ jsxs(Box, { children: [/* @__PURE__ */ jsx(Typography, {
				variant: "body2",
				children: "Timeline"
			}), /* @__PURE__ */ jsx(Slider, {
				size: "small",
				min: 0,
				max: Math.max(0, frames.length - 1),
				value: index,
				valueLabelDisplay: "auto",
				onChange: (_, v) => {
					const nv = Array.isArray(v) ? v[0] : v;
					setIndex(nv);
					onIndexChange?.(nv);
				}
			})] }),
			/* @__PURE__ */ jsxs(Box, { children: [/* @__PURE__ */ jsx(Typography, {
				variant: "body2",
				children: "Auto Mode"
			}), /* @__PURE__ */ jsxs(Stack, {
				direction: "row",
				spacing: 2,
				alignItems: "center",
				children: [/* @__PURE__ */ jsx(TextField, {
					label: "FPS",
					size: "small",
					type: "number",
					InputProps: { inputProps: {
						min: 1,
						max: 60
					} },
					value: fps,
					onChange: (e) => setFps(Math.max(1, Math.min(60, Number(e.target.value) || 1))),
					sx: { width: 120 }
				}), /* @__PURE__ */ jsx(FormControlLabel, {
					control: /* @__PURE__ */ jsx(Switch, {
						checked: loop,
						onChange: (e) => setLoop(e.target.checked)
					}),
					label: "Loop"
				})]
			})] })
		]
	});
}

//#endregion
//#region src/ui/utils/useFramePlayer.ts
function useFramePlayer({ length, initialIndex = 0, initialFps = 12, loop = true, onIndex }) {
	const [index, setIndex] = useState(Math.min(initialIndex, Math.max(0, length - 1)));
	const [fps, setFps] = useState(initialFps);
	const [playing, setPlaying] = useState(false);
	const [isLoop, setLoop] = useState(loop);
	const timerRef = useRef(null);
	const clamp = useCallback((i) => length <= 0 ? 0 : Math.max(0, Math.min(length - 1, i)), [length]);
	const goTo = useCallback((i) => {
		const nv = clamp(i);
		setIndex(nv);
		onIndex?.(nv);
	}, [clamp, onIndex]);
	const next = useCallback(() => {
		if (length <= 0) return;
		if (index + 1 < length) goTo(index + 1);
		else if (isLoop) goTo(0);
	}, [
		index,
		length,
		isLoop,
		goTo
	]);
	const prev = useCallback(() => {
		if (length <= 0) return;
		if (index - 1 >= 0) goTo(index - 1);
		else if (isLoop) goTo(Math.max(0, length - 1));
	}, [
		index,
		length,
		isLoop,
		goTo
	]);
	useEffect(() => {
		if (!playing) return;
		const interval = Math.max(16, Math.floor(1e3 / Math.max(1, fps)));
		timerRef.current = window.setInterval(() => {
			setIndex((cur) => {
				const atEnd = cur + 1 >= length;
				const nv = atEnd ? isLoop ? 0 : cur : cur + 1;
				if (!atEnd || isLoop) onIndex?.(nv);
				return nv;
			});
		}, interval);
		return () => {
			if (timerRef.current != null) window.clearInterval(timerRef.current);
			timerRef.current = null;
		};
	}, [
		playing,
		fps,
		length,
		isLoop,
		onIndex
	]);
	const play = useCallback(() => setPlaying(true), []);
	const pause = useCallback(() => setPlaying(false), []);
	useEffect(() => {
		onIndex?.(index);
	}, []);
	return {
		index,
		setIndex: goTo,
		fps,
		setFps,
		playing,
		play,
		pause,
		loop: isLoop,
		setLoop,
		next,
		prev
	};
}

//#endregion
//#region src/ui/steps/AnimationViewerStep.tsx
function AnimationViewerStep({ frames, initialIndex = 0, initialFps = 12, loop = true }) {
	const player = useFramePlayer({
		length: frames.length,
		initialIndex,
		initialFps,
		loop
	});
	const current = frames[player.index] || null;
	const viewState = useMemo(() => {
		if (current?.viewState) {
			const { longitude, latitude, zoom = 4, bearing = 0, pitch = 0 } = current.viewState;
			return {
				longitude,
				latitude,
				zoom,
				bearing,
				pitch
			};
		}
		return {
			longitude: 139.7671,
			latitude: 35.6812,
			zoom: 4,
			bearing: 0,
			pitch: 0
		};
	}, [current]);
	return /* @__PURE__ */ jsxs(Stack, {
		spacing: 2,
		children: [
			/* @__PURE__ */ jsx(Typography, {
				variant: "subtitle1",
				children: "Final Animation Preview"
			}),
			/* @__PURE__ */ jsxs(Paper, {
				variant: "outlined",
				sx: {
					height: 280,
					position: "relative",
					overflow: "hidden",
					borderRadius: 2,
					background: "radial-gradient(circle at 15% 25%, rgba(33,150,243,0.35), transparent 60%),            radial-gradient(circle at 82% 25%, rgba(156,39,176,0.32), transparent 55%),            linear-gradient(145deg, rgba(33,150,243,0.25), rgba(0,0,0,0.45))",
					"&::after": {
						content: "\"\"",
						position: "absolute",
						inset: 0,
						background: "linear-gradient(160deg, rgba(0,0,0,0.15), transparent 65%)"
					}
				},
				children: [/* @__PURE__ */ jsxs(Box, {
					sx: {
						position: "absolute",
						top: 16,
						left: 16,
						display: "flex",
						alignItems: "center",
						gap: 1,
						px: 1.5,
						py: .75,
						borderRadius: 1,
						bgcolor: (theme) => theme.palette.background.paper,
						boxShadow: 1
					},
					children: [
						/* @__PURE__ */ jsx(Map, {
							fontSize: "small",
							color: "action"
						}),
						/* @__PURE__ */ jsxs(Typography, {
							variant: "body2",
							fontWeight: 600,
							children: [
								current?.name ?? "Frame",
								" (",
								player.index + 1,
								"/",
								Math.max(1, frames.length),
								")"
							]
						}),
						/* @__PURE__ */ jsx(Chip, {
							size: "small",
							label: `${viewState.longitude.toFixed(2)}, ${viewState.latitude.toFixed(2)} / z${viewState.zoom.toFixed(1)}`,
							sx: { fontWeight: 500 }
						})
					]
				}), /* @__PURE__ */ jsxs(Box, {
					sx: {
						position: "absolute",
						bottom: 16,
						left: 16,
						color: "common.white",
						textShadow: "0 0 10px rgba(0,0,0,0.45)"
					},
					children: [/* @__PURE__ */ jsxs(Typography, {
						variant: "body2",
						children: [
							"Playback ",
							player.playing ? "running" : "paused",
							" at ",
							player.fps,
							" fps"
						]
					}), /* @__PURE__ */ jsxs(Typography, {
						variant: "caption",
						display: "block",
						children: [
							"Bearing ",
							viewState.bearing?.toFixed?.(1) ?? "0",
							"°, Pitch ",
							viewState.pitch?.toFixed?.(1) ?? "0",
							"°"
						]
					})]
				})]
			}),
			/* @__PURE__ */ jsxs(Stack, {
				direction: "row",
				spacing: 1,
				alignItems: "center",
				children: [
					/* @__PURE__ */ jsx(IconButton, {
						onClick: player.prev,
						size: "small",
						children: /* @__PURE__ */ jsx(SkipPrevious, { fontSize: "small" })
					}),
					player.playing ? /* @__PURE__ */ jsx(IconButton, {
						onClick: player.pause,
						size: "small",
						color: "primary",
						children: /* @__PURE__ */ jsx(Pause, { fontSize: "small" })
					}) : /* @__PURE__ */ jsx(IconButton, {
						onClick: player.play,
						size: "small",
						color: "primary",
						children: /* @__PURE__ */ jsx(PlayArrow, { fontSize: "small" })
					}),
					/* @__PURE__ */ jsx(IconButton, {
						onClick: player.next,
						size: "small",
						children: /* @__PURE__ */ jsx(SkipNext, { fontSize: "small" })
					}),
					/* @__PURE__ */ jsx(Box, {
						sx: {
							flex: 1,
							px: 2
						},
						children: /* @__PURE__ */ jsx(Slider, {
							size: "small",
							min: 0,
							max: Math.max(0, frames.length - 1),
							value: player.index,
							onChange: (_, v) => player.setIndex(Array.isArray(v) ? v[0] : v),
							valueLabelDisplay: "auto"
						})
					}),
					/* @__PURE__ */ jsx(Tooltip, {
						title: "Frames per second",
						children: /* @__PURE__ */ jsx(TextField, {
							label: "FPS",
							size: "small",
							type: "number",
							InputProps: { inputProps: {
								min: 1,
								max: 60
							} },
							value: player.fps,
							onChange: (e) => player.setFps(Math.max(1, Math.min(60, Number(e.target.value) || 1))),
							sx: { width: 110 }
						})
					}),
					/* @__PURE__ */ jsx(Tooltip, {
						title: "Loop animation",
						children: /* @__PURE__ */ jsxs(Stack, {
							direction: "row",
							alignItems: "center",
							spacing: 1,
							children: [/* @__PURE__ */ jsx(Typography, {
								variant: "body2",
								children: "Loop"
							}), /* @__PURE__ */ jsx(Switch, {
								checked: player.loop,
								onChange: (e) => player.setLoop(e.target.checked)
							})]
						})
					})
				]
			})
		]
	});
}

//#endregion
//#region src/ui/utils/frames.ts
function toFramesFromNodes(nodes) {
	return nodes.map((n) => ({
		id: String(n.id),
		name: String(n.name || "")
	})).filter((f) => !!f.name).sort((a, b) => a.name.localeCompare(b.name));
}

//#endregion
//#region src/ui/components/TimelineDialog.tsx
function TimelineDialog(props) {
	const [basic, setBasic] = useState({
		name: "New Timeline",
		description: ""
	});
	const [frames] = useState([
		{
			id: "f1",
			name: "Frame A"
		},
		{
			id: "f2",
			name: "Frame B"
		},
		{
			id: "f3",
			name: "Frame C"
		}
	]);
	const [activeStepIndex, setActiveStepIndex] = useState(0);
	const viewportOnMount = getViewportSize();
	const defaultSize = getPresetSize("normal", viewportOnMount);
	const initialLayout = normalizeDialogState(defaultSize, initialPosition(defaultSize, viewportOnMount), viewportOnMount, { enforceTopLeftMargin: true });
	const [displayMode, setDisplayMode] = useState("normal");
	const [dialogSize, setDialogSize] = useState(initialLayout.size);
	const [dialogPosition, setDialogPosition] = useState(initialLayout.position);
	const dialogSizeRef = useRef(dialogSize);
	const dialogPositionRef = useRef(dialogPosition);
	const applyNormalizedState = useCallback((size, position) => {
		dialogSizeRef.current = size;
		dialogPositionRef.current = position;
		setDialogSize(size);
		setDialogPosition(position);
	}, [setDialogPosition, setDialogSize]);
	useEffect(() => {
		dialogSizeRef.current = dialogSize;
	}, [dialogSize]);
	useEffect(() => {
		dialogPositionRef.current = dialogPosition;
	}, [dialogPosition]);
	const steps = useMemo(() => [
		{
			id: "basic",
			label: "Basic Information",
			component: /* @__PURE__ */ jsx(BasicInfoStep, {
				values: basic,
				onChange: setBasic
			}),
			validate: async () => (basic?.name || "").trim().length > 0
		},
		{
			id: "frames",
			label: "Frames Preview",
			component: /* @__PURE__ */ jsx(FramesPreviewStep, { frames })
		},
		{
			id: "map",
			label: "Map Preview",
			component: /* @__PURE__ */ jsx(MapPreviewStep, { frames })
		},
		{
			id: "final",
			label: "Final Animation",
			component: /* @__PURE__ */ jsx(AnimationViewerStep, { frames })
		}
	], [basic, frames]);
	const filledSteps = useMemo(() => [
		(basic?.name || "").trim().length > 0,
		true,
		true,
		true
	], [basic]);
	const enabledStepIndices = useMemo(() => filledSteps.map((_, idx) => idx === 0 || filledSteps.slice(0, idx).every(Boolean) ? idx : -1).filter((idx) => idx >= 0), [filledSteps]);
	const validatedStepIndices = useMemo(() => filledSteps.map((valid, idx) => valid ? idx : -1).filter((idx) => idx >= 0), [filledSteps]);
	const committableStepIndices = useMemo(() => steps.length ? [steps.length - 1] : [], [steps.length]);
	const dialogTitle = useMemo(() => props.mode === "create" ? "Create Timeline" : "Edit Timeline", [props.mode]);
	const handleNavigation = useCallback((event) => {
		switch (event.type) {
			case "direct":
				setActiveStepIndex(event.targetIndex);
				break;
			case "next":
				setActiveStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
				break;
			case "back":
				setActiveStepIndex((prev) => Math.max(prev - 1, 0));
				break;
		}
	}, [steps.length]);
	const handleCommit = useCallback(() => {
		props.onSuccess(props.nodeId || "timeline-new");
	}, [props]);
	const stepDescriptors = useMemo(() => steps.map((step) => ({
		id: step.id,
		label: step.label,
		component: () => null
	})), [steps]);
	const renderHeader = useCallback((propsHeader) => /* @__PURE__ */ jsxs("header", {
		style: {
			display: "flex",
			justifyContent: "space-between",
			alignItems: "center",
			padding: "12px 16px",
			borderBottom: "1px solid #dde1eb"
		},
		children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("strong", { children: dialogTitle }), /* @__PURE__ */ jsxs("div", {
			style: {
				fontSize: 12,
				color: "#64748b"
			},
			children: [
				"Step ",
				propsHeader.activeStepIndex + 1,
				" / ",
				steps.length
			]
		})] }), /* @__PURE__ */ jsxs("div", {
			style: {
				display: "flex",
				gap: 8
			},
			children: [/* @__PURE__ */ jsx("button", {
				type: "button",
				onClick: () => handleNavigation({ type: "back" }),
				disabled: propsHeader.activeStepIndex === 0,
				children: "Back"
			}), /* @__PURE__ */ jsx("button", {
				type: "button",
				onClick: () => handleNavigation({ type: "next" }),
				disabled: propsHeader.activeStepIndex >= steps.length - 1,
				children: "Next"
			})]
		})]
	}), [
		dialogTitle,
		handleNavigation,
		steps.length
	]);
	const renderContent = useCallback((propsContent) => /* @__PURE__ */ jsx("div", {
		style: { padding: 16 },
		children: steps[propsContent.activeStepIndex]?.component
	}), [steps]);
	const renderFooter = useCallback((propsFooter) => {
		const allValid = filledSteps.every(Boolean);
		return /* @__PURE__ */ jsxs("footer", {
			style: {
				padding: "12px 16px",
				display: "flex",
				justifyContent: "space-between",
				borderTop: "1px solid #dde1eb"
			},
			children: [/* @__PURE__ */ jsx("button", {
				type: "button",
				onClick: () => propsFooter.onRequestClose?.("close"),
				children: "Cancel"
			}), /* @__PURE__ */ jsx("button", {
				type: "button",
				onClick: () => propsFooter.onRequestCommit?.(),
				disabled: !allValid,
				children: "Save"
			})]
		});
	}, [filledSteps]);
	useEffect(() => {
		if (typeof window === "undefined") return;
		let rafId = null;
		const normalize = () => {
			rafId = null;
			const viewport = getViewportSize();
			let targetSize = dialogSizeRef.current;
			let targetPosition = dialogPositionRef.current;
			let options = {
				enforceTopLeftMargin: displayMode === "normal",
				minPosition: displayMode === "normal" ? 0 : FRAME_CONSTANTS.NON_STANDARD_MARGIN,
				clampSizeToViewport: true
			};
			if (displayMode === "full-screen") {
				targetSize = {
					width: Math.max(viewport.width, FRAME_CONSTANTS.MIN_DIALOG_WIDTH),
					height: Math.max(viewport.height, FRAME_CONSTANTS.MIN_DIALOG_HEIGHT)
				};
				targetPosition = {
					x: 0,
					y: 0
				};
				options = {
					enforceTopLeftMargin: false,
					minPosition: 0,
					clampSizeToViewport: false
				};
			} else if (displayMode === "maximize") {
				targetSize = getPresetSize("maximize", viewport);
				targetPosition = {
					x: FRAME_CONSTANTS.NON_STANDARD_MARGIN,
					y: FRAME_CONSTANTS.NON_STANDARD_MARGIN
				};
				options = {
					enforceTopLeftMargin: false,
					minPosition: FRAME_CONSTANTS.NON_STANDARD_MARGIN,
					clampSizeToViewport: true
				};
			}
			const normalized = normalizeDialogState(targetSize, targetPosition, viewport, options);
			if (!sizesEqual(dialogSizeRef.current, normalized.size) || !positionsEqual(dialogPositionRef.current, normalized.position)) applyNormalizedState(normalized.size, normalized.position);
		};
		const schedule = () => {
			if (rafId !== null) return;
			rafId = window.requestAnimationFrame(normalize);
		};
		window.addEventListener("resize", schedule, { passive: true });
		schedule();
		return () => {
			window.removeEventListener("resize", schedule);
			if (rafId !== null) {
				window.cancelAnimationFrame(rafId);
				rafId = null;
			}
		};
	}, [applyNormalizedState, displayMode]);
	const transitionDisplayMode = useCallback((mode) => {
		const viewport = getViewportSize();
		if (mode === "full-screen") applyNormalizedState({
			width: Math.max(viewport.width, FRAME_CONSTANTS.MIN_DIALOG_WIDTH),
			height: Math.max(viewport.height, FRAME_CONSTANTS.MIN_DIALOG_HEIGHT)
		}, {
			x: 0,
			y: 0
		});
		else if (mode === "maximize") {
			const normalized = normalizeDialogState(getPresetSize("maximize", viewport), {
				x: FRAME_CONSTANTS.NON_STANDARD_MARGIN,
				y: FRAME_CONSTANTS.NON_STANDARD_MARGIN
			}, viewport, {
				enforceTopLeftMargin: false,
				minPosition: FRAME_CONSTANTS.NON_STANDARD_MARGIN,
				clampSizeToViewport: true
			});
			applyNormalizedState(normalized.size, normalized.position);
		} else {
			const preset = getPresetSize("normal", viewport);
			const normalized = normalizeDialogState(preset, initialPosition(preset, viewport), viewport, { enforceTopLeftMargin: true });
			applyNormalizedState(normalized.size, normalized.position);
		}
		setDisplayMode(mode);
	}, [applyNormalizedState, setDisplayMode]);
	const handleSizeChange = useCallback((next) => {
		if (!next) return;
		const normalized = normalizeDialogState(next, dialogPositionRef.current, getViewportSize(), {
			enforceTopLeftMargin: displayMode === "normal",
			minPosition: displayMode === "normal" ? 0 : FRAME_CONSTANTS.NON_STANDARD_MARGIN,
			clampSizeToViewport: true
		});
		if (!sizesEqual(dialogSizeRef.current, normalized.size) || !positionsEqual(dialogPositionRef.current, normalized.position)) applyNormalizedState(normalized.size, normalized.position);
	}, [applyNormalizedState, displayMode]);
	const handlePositionChange = useCallback((next) => {
		if (!next) return;
		const normalized = normalizeDialogState(dialogSizeRef.current, next, getViewportSize(), {
			enforceTopLeftMargin: displayMode === "normal",
			minPosition: displayMode === "normal" ? 0 : FRAME_CONSTANTS.NON_STANDARD_MARGIN,
			clampSizeToViewport: true
		});
		if (!sizesEqual(dialogSizeRef.current, normalized.size) || !positionsEqual(dialogPositionRef.current, normalized.position)) applyNormalizedState(normalized.size, normalized.position);
	}, [applyNormalizedState, displayMode]);
	const headlessProps = {
		open: props.open,
		stepComponents: stepDescriptors,
		stepData: {
			basic,
			frames
		},
		onStepDataChange: () => void 0,
		activeStepIndex,
		onStepNavigate: handleNavigation,
		enabledStepIndices,
		validatedStepIndices,
		committableStepIndices,
		invalidMessageMap: {},
		onRequestClose: () => props.onClose(),
		onRequestCommit: handleCommit,
		isDirty: true,
		position: dialogPosition,
		onPositionChange: handlePositionChange,
		size: dialogSize,
		onSizeChange: handleSizeChange,
		displayMode,
		onDisplayModeChange: (mode) => {
			transitionDisplayMode(mode);
		},
		renderHeader,
		renderContent,
		renderFooter
	};
	return /* @__PURE__ */ jsx("div", {
		style: useMemo(() => {
			const fullScreen = displayMode === "full-screen";
			return {
				width: fullScreen ? "100%" : `${dialogSize.width}px`,
				maxWidth: fullScreen ? "100%" : "min(calc(100vw - 48px), 1280px)",
				height: fullScreen ? "100%" : `${dialogSize.height}px`,
				maxHeight: fullScreen ? "100%" : "calc(100vh - 48px)",
				display: "flex",
				flexDirection: "column",
				borderRadius: fullScreen ? 0 : 12,
				boxShadow: fullScreen ? "none" : "0 22px 80px rgba(10, 14, 36, 0.38)",
				overflow: "hidden",
				backgroundColor: "#fff"
			};
		}, [
			dialogSize.height,
			dialogSize.width,
			displayMode
		]),
		role: "dialog",
		"aria-modal": props.open,
		children: /* @__PURE__ */ jsx(HeadlessMultiStepDialog, { ...headlessProps })
	});
}
async function getDialogComponent() {
	return TimelineDialog;
}

//#endregion
//#region src/ui/components/steps-provider.tsx
PluginStepRegistry.getInstance().registerConfigProvider({
	nodeType: "timeline",
	getCreateStepConfigs() {
		return [
			{
				id: "frames",
				label: "Frames Preview",
				localization: {
					defaultTitle: "Frames Preview",
					titles: {
						en: "Frames Preview",
						ja: "フレームプレビュー"
					}
				},
				componentFactory: (p) => /* @__PURE__ */ jsx(FramesPreviewStep, { frames: p.data?.frames || [] })
			},
			{
				id: "map",
				label: "Map Preview",
				localization: {
					defaultTitle: "Map Preview",
					titles: {
						en: "Map Preview",
						ja: "地図プレビュー"
					}
				},
				componentFactory: (p) => /* @__PURE__ */ jsx(MapPreviewStep, { frames: p.data?.frames || [] })
			},
			{
				id: "final",
				label: "Final Animation",
				localization: {
					defaultTitle: "Final Animation",
					titles: {
						en: "Final Animation",
						ja: "アニメーション確認"
					}
				},
				componentFactory: (p) => /* @__PURE__ */ jsx(AnimationViewerStep, { frames: p.data?.frames || [] })
			}
		];
	},
	getEditStepConfigs(_nodeId) {
		return this.getCreateStepConfigs();
	}
});

//#endregion
export { AnimationViewerStep, BasicInfoStep, FramesPreviewStep, MapPreviewStep, TimelineDialog, getDialogComponent, toFramesFromNodes };
//# sourceMappingURL=index.js.map