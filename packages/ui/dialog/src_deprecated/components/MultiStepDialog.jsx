"use strict";
/**
 * @file MultiStepDialog.tsx
 * @description マルチステップダイアログコンポーネント
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiStepDialog = void 0;
var react_1 = require("react");
var material_1 = require("@mui/material");
var icons_material_1 = require("@mui/icons-material");
var StepWizardContext_1 = require("./StepWizardContext");
// ============================================================================
// トランジション
// ============================================================================
var SlideTransition = (function Transition(props, ref) {
    return <material_1.Slide direction="up" ref={ref} {...props}/>;
});
// ============================================================================
// 内部コンポーネント
// ============================================================================
/**
 * ステップコンテンツレンダラー
 */
function StepContentRenderer() {
    var _a = (0, StepWizardContext_1.useWizard)(), state = _a.state, actions = _a.actions, stepDefinitions = _a.stepDefinitions;
    var currentStepDef = stepDefinitions.find(function (s) { return s.stepNumber === state.currentStep; });
    if (!currentStepDef) {
        return <material_1.Typography>Step not found</material_1.Typography>;
    }
    var StepComponent = currentStepDef.component;
    var stepState = state.steps.get(state.currentStep);
    var handleChange = (0, react_1.useCallback)(function (data) {
        actions.updateStepData(state.currentStep, data);
    }, [actions, state.currentStep]);
    var handleNext = (0, react_1.useCallback)(function (data) {
        actions.updateStepData(state.currentStep, data);
        actions.goToNext();
    }, [actions, state.currentStep]);
    var handlePrevious = (0, react_1.useCallback)(function () {
        actions.goPrevious();
    }, [actions]);
    return (<material_1.Box sx={{ minHeight: 300, position: 'relative' }}>
      {state.isLoading && (<material_1.Box sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'rgba(255, 255, 255, 0.7)',
                zIndex: 1,
            }}>
          <material_1.CircularProgress />
        </material_1.Box>)}
      
      <material_1.Fade in key={state.currentStep}>
        <material_1.Box>
          <StepComponent data={(stepState === null || stepState === void 0 ? void 0 : stepState.data) || {}} onChange={handleChange} onNext={handleNext} onPrevious={handlePrevious} errors={(stepState === null || stepState === void 0 ? void 0 : stepState.errors) || []} isLoading={state.isLoading}/>
        </material_1.Box>
      </material_1.Fade>
    </material_1.Box>);
}
/**
 * ステップナビゲーション
 */
function StepNavigation(_a) {
    var _b = _a.allowStepNavigation, allowStepNavigation = _b === void 0 ? false : _b;
    var _c = (0, StepWizardContext_1.useWizard)(), state = _c.state, actions = _c.actions, helpers = _c.helpers, stepDefinitions = _c.stepDefinitions;
    var handleStepClick = function (stepNumber) {
        if (allowStepNavigation && helpers.canGoToStep(stepNumber)) {
            actions.goToStep(stepNumber);
        }
    };
    return (<material_1.Stepper activeStep={state.currentStep - 1} sx={{ pt: 3, pb: 5 }}>
      {stepDefinitions.map(function (step) {
            var stepState = state.steps.get(step.stepNumber);
            var canNavigate = allowStepNavigation && helpers.canGoToStep(step.stepNumber);
            return (<material_1.Step key={step.stepNumber} completed={stepState === null || stepState === void 0 ? void 0 : stepState.isCompleted}>
            {allowStepNavigation ? (<material_1.StepButton onClick={function () { return handleStepClick(step.stepNumber); }} disabled={!canNavigate}>
                <material_1.StepLabel error={(stepState === null || stepState === void 0 ? void 0 : stepState.errors) && stepState.errors.length > 0} optional={step.isOptional ? (<material_1.Typography variant="caption">Optional</material_1.Typography>) : undefined}>
                  {step.title}
                </material_1.StepLabel>
              </material_1.StepButton>) : (<material_1.StepLabel error={(stepState === null || stepState === void 0 ? void 0 : stepState.errors) && stepState.errors.length > 0} optional={step.isOptional ? (<material_1.Typography variant="caption">Optional</material_1.Typography>) : undefined}>
                {step.title}
              </material_1.StepLabel>)}
          </material_1.Step>);
        })}
    </material_1.Stepper>);
}
/**
 * ダイアログアクション
 */
function DialogActionsContent(_a) {
    var _this = this;
    var onComplete = _a.onComplete, onClose = _a.onClose;
    var _b = (0, StepWizardContext_1.useWizard)(), state = _b.state, actions = _b.actions, helpers = _b.helpers, stepDefinitions = _b.stepDefinitions;
    var _c = (0, react_1.useState)(false), isSubmitting = _c[0], setIsSubmitting = _c[1];
    var _d = (0, react_1.useState)(null), submitError = _d[0], setSubmitError = _d[1];
    var isLastStep = (0, react_1.useMemo)(function () {
        var _a;
        var sortedSteps = __spreadArray([], stepDefinitions, true).sort(function (a, b) { return a.stepNumber - b.stepNumber; });
        return state.currentStep === ((_a = sortedSteps[sortedSteps.length - 1]) === null || _a === void 0 ? void 0 : _a.stepNumber);
    }, [state.currentStep, stepDefinitions]);
    var handleNext = function () { return __awaiter(_this, void 0, void 0, function () {
        var currentStepDef, stepState, result, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    currentStepDef = stepDefinitions.find(function (s) { return s.stepNumber === state.currentStep; });
                    stepState = state.steps.get(state.currentStep);
                    if (!(currentStepDef === null || currentStepDef === void 0 ? void 0 : currentStepDef.validation)) return [3 /*break*/, 2];
                    return [4 /*yield*/, currentStepDef.validation.validate((stepState === null || stepState === void 0 ? void 0 : stepState.data) || {})];
                case 1:
                    result = _a.sent();
                    actions.validateStep(state.currentStep, result);
                    if (!result.isValid) {
                        return [2 /*return*/];
                    }
                    _a.label = 2;
                case 2:
                    actions.completeStep(state.currentStep);
                    if (!isLastStep) return [3 /*break*/, 8];
                    // 最後のステップの場合は完了処理
                    setIsSubmitting(true);
                    setSubmitError(null);
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 5, 6, 7]);
                    return [4 /*yield*/, onComplete(helpers.getAllData())];
                case 4:
                    _a.sent();
                    actions.complete();
                    onClose();
                    return [3 /*break*/, 7];
                case 5:
                    error_1 = _a.sent();
                    setSubmitError(error_1 instanceof Error ? error_1.message : 'An error occurred');
                    return [3 /*break*/, 7];
                case 6:
                    setIsSubmitting(false);
                    return [7 /*endfinally*/];
                case 7: return [3 /*break*/, 9];
                case 8:
                    actions.goToNext();
                    _a.label = 9;
                case 9: return [2 /*return*/];
            }
        });
    }); };
    return (<>
      {submitError && (<material_1.Alert severity="error" sx={{ mr: 2 }}>
          {submitError}
        </material_1.Alert>)}
      
      <material_1.Button onClick={function () { return actions.goPrevious(); }} disabled={!helpers.canGoPrevious() || isSubmitting} startIcon={<icons_material_1.NavigateBefore />}>
        Previous
      </material_1.Button>
      
      <material_1.Box sx={{ flex: '1 0 auto' }}/>
      
      <material_1.Button onClick={onClose} disabled={isSubmitting}>
        Cancel
      </material_1.Button>
      
      <material_1.Button onClick={handleNext} variant="contained" disabled={isSubmitting} startIcon={isSubmitting ? <material_1.CircularProgress size={20}/> : isLastStep ? <icons_material_1.Check /> : <icons_material_1.NavigateNext />}>
        {isLastStep ? 'Complete' : 'Next'}
      </material_1.Button>
    </>);
}
//import { useDialogMode } from '../hooks/useDialogMode.ts.bak';
// ============================================================================
// メインコンポーネント
// ============================================================================
/**
 * マルチステップダイアログコンポーネント
 */
function MultiStepDialog(_a) {
    var _this = this;
    var open = _a.open, onClose = _a.onClose, onComplete = _a.onComplete, steps = _a.steps, _b = _a.title, title = _b === void 0 ? 'Multi-Step Dialog' : _b, _c = _a.initialData, initialData = _c === void 0 ? {} : _c, _d = _a.maxWidth, maxWidth = _d === void 0 ? 'md' : _d, _e = _a.fullWidth, fullWidth = _e === void 0 ? true : _e, _f = _a.allowStepNavigation, allowStepNavigation = _f === void 0 ? false : _f, _g = _a.transition, transition = _g === void 0 ? 'fade' : _g, nodeId = _a.nodeId, nodeType = _a.nodeType, initialIconGroupSettings = _a.iconGroupSettings, initialStepFromUrl = _a.initialStepFromUrl, initialFullscreenFromUrl = _a.initialFullscreenFromUrl, initialMapParamsFromUrl = _a.initialMapParamsFromUrl, onStepChange = _a.onStepChange, onFullscreenChange = _a.onFullscreenChange, onMapParamsChange = _a.onMapParamsChange;
    if (steps.length === 0) {
        return null;
    }
    // PeerEntityベースのダイアログモード管理
    var _h = useDialogMode(nodeId, nodeType, 'normal'), savedDialogMode = _h.dialogMode, saveDialogMode = _h.setDialogMode, savedResumeStep = _h.resumeStep, setResumeStep = _h.setResumeStep, clearResumeStep = _h.clearResumeStep, savedMapParams = _h.mapParams, setMapParams = _h.setMapParams;
    var defaultIconGroupSettings = initialIconGroupSettings !== null && initialIconGroupSettings !== void 0 ? initialIconGroupSettings : {
        normalMode: 'always',
        fullscreenMode: 'hover',
    };
    // URL パラメータの優先順位: URL > PeerEntity > デフォルト
    var initialFullscreen = initialFullscreenFromUrl !== undefined
        ? initialFullscreenFromUrl
        : savedDialogMode === 'full';
    // 初期ステップの優先順位: URL > PeerEntity > デフォルト
    var initialStep = initialStepFromUrl || savedResumeStep || 1;
    // 初期地図パラメータの優先順位: URL > PeerEntity
    var initialMapParams = initialMapParamsFromUrl || savedMapParams;
    // 状態管理
    var _j = (0, react_1.useState)(initialFullscreen), isFullscreen = _j[0], setIsFullscreen = _j[1];
    var iconGroupSettings = (0, react_1.useState)(initialIconGroupSettings !== null && initialIconGroupSettings !== void 0 ? initialIconGroupSettings : defaultIconGroupSettings)[0];
    var _k = (0, react_1.useState)(false), isHovering = _k[0], setIsHovering = _k[1];
    var _l = (0, react_1.useState)(!initialFullscreen), isHeaderVisible = _l[0], setIsHeaderVisible = _l[1];
    var _m = (0, react_1.useState)(!initialFullscreen), isFooterVisible = _m[0], setIsFooterVisible = _m[1];
    var _o = (0, react_1.useState)(initialStep), currentStep = _o[0], setCurrentStep = _o[1];
    var dialogRef = (0, react_1.useRef)(null);
    var hoverTimeoutRef = (0, react_1.useRef)();
    var headerTimeoutRef = (0, react_1.useRef)();
    var footerTimeoutRef = (0, react_1.useRef)();
    // 全画面切り替え
    var toggleFullscreen = (0, react_1.useCallback)(function () {
        var newFullscreen = !isFullscreen;
        setIsFullscreen(newFullscreen);
        // フルスクリーン切り替え時にヘッダー・フッターの表示状態を調整
        if (newFullscreen) {
            setIsHeaderVisible(false);
            setIsFooterVisible(false);
        }
        else {
            setIsHeaderVisible(true);
            setIsFooterVisible(true);
        }
        // PeerEntityに保存
        if (nodeId && nodeType) {
            saveDialogMode(newFullscreen ? 'full' : 'normal');
        }
        // コールバックを呼び出し
        if (onFullscreenChange) {
            onFullscreenChange(newFullscreen);
        }
    }, [isFullscreen, nodeId, nodeType, saveDialogMode, onFullscreenChange]);
    // アイコングループの表示判定
    var shouldShowIconGroup = (0, react_1.useMemo)(function () {
        var currentMode = isFullscreen ? iconGroupSettings.fullscreenMode : iconGroupSettings.normalMode;
        switch (currentMode) {
            case 'hidden':
                return false;
            case 'always':
                return true;
            case 'hover':
                return isHovering;
            default:
                return true;
        }
    }, [isFullscreen, iconGroupSettings, isHovering]);
    // ホバー処理（全画面時のみ）
    var handleMouseMove = (0, react_1.useCallback)(function (e) {
        if (!isFullscreen) {
            return;
        }
        var headerThreshold = 60; // ヘッダー表示の閾値
        var footerThreshold = 60; // フッター表示の閾値
        var windowHeight = window.innerHeight;
        // ヘッダー領域のホバー判定
        if (e.clientY < headerThreshold) {
            if (!isHeaderVisible) {
                setIsHeaderVisible(true);
                setIsHovering(true); // アイコングループも表示
            }
            // タイムアウトをリセット
            if (headerTimeoutRef.current) {
                clearTimeout(headerTimeoutRef.current);
            }
            // 3秒後に自動的に非表示
            headerTimeoutRef.current = setTimeout(function () {
                setIsHeaderVisible(false);
                setIsHovering(false);
            }, 3000);
        }
        // フッター領域のホバー判定
        if (e.clientY > windowHeight - footerThreshold) {
            if (!isFooterVisible) {
                setIsFooterVisible(true);
            }
            // タイムアウトをリセット
            if (footerTimeoutRef.current) {
                clearTimeout(footerTimeoutRef.current);
            }
            // 3秒後に自動的に非表示
            footerTimeoutRef.current = setTimeout(function () {
                setIsFooterVisible(false);
            }, 3000);
        }
    }, [isFullscreen, isHeaderVisible, isFooterVisible]);
    var handleMouseLeave = (0, react_1.useCallback)(function () {
        // 各タイムアウトをクリア
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
        }
        if (headerTimeoutRef.current) {
            clearTimeout(headerTimeoutRef.current);
        }
        if (footerTimeoutRef.current) {
            clearTimeout(footerTimeoutRef.current);
        }
        // フルスクリーン時は即座に隠す
        if (isFullscreen) {
            setIsHovering(false);
            setIsHeaderVisible(false);
            setIsFooterVisible(false);
        }
    }, [isFullscreen]);
    // クリーンアップ
    (0, react_1.useEffect)(function () {
        return function () {
            if (hoverTimeoutRef.current) {
                clearTimeout(hoverTimeoutRef.current);
            }
            if (headerTimeoutRef.current) {
                clearTimeout(headerTimeoutRef.current);
            }
            if (footerTimeoutRef.current) {
                clearTimeout(footerTimeoutRef.current);
            }
        };
    }, []);
    // ステップ変更時にresumeStepを保存
    (0, react_1.useEffect)(function () {
        if (nodeId && nodeType && currentStep !== savedResumeStep) {
            setResumeStep(currentStep);
        }
    }, [currentStep, nodeId, nodeType, savedResumeStep, setResumeStep]);
    // ダイアログが閉じられる時にresumeStepを保存
    var handleDialogClose = (0, react_1.useCallback)(function () {
        // 現在のステップをresumeStepとして保存
        if (nodeId && nodeType) {
            setResumeStep(currentStep);
        }
        onClose();
    }, [currentStep, nodeId, nodeType, setResumeStep, onClose]);
    // ダイアログが完了した時にresumeStepをクリア
    var handleDialogComplete = (0, react_1.useCallback)(function (data) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(nodeId && nodeType)) return [3 /*break*/, 3];
                    return [4 /*yield*/, clearResumeStep()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, setMapParams(undefined)];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3: return [4 /*yield*/, onComplete(data)];
                case 4:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); }, [nodeId, nodeType, clearResumeStep, setMapParams, onComplete]);
    // 地図パラメータ変更の処理
    var handleMapParamsChange = (0, react_1.useCallback)(function (params) {
        // PeerEntityに保存
        if (nodeId && nodeType) {
            setMapParams(params);
        }
        // コールバックを呼び出し
        if (onMapParamsChange) {
            onMapParamsChange(params);
        }
    }, [nodeId, nodeType, setMapParams, onMapParamsChange]);
    var TransitionComponent = transition === 'slide' ? SlideTransition : material_1.Fade;
    return (<material_1.Dialog ref={dialogRef} open={open} onClose={handleDialogClose} maxWidth={isFullscreen ? false : maxWidth} fullWidth={!isFullscreen && fullWidth} fullScreen={isFullscreen} TransitionComponent={TransitionComponent} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      <StepWizardContext_1.WizardProvider stepDefinitions={steps} initialData={__assign(__assign({}, initialData), { mapInitialParams: initialMapParams, onMapParamsChange: handleMapParamsChange })} initialStep={currentStep} onStepChange={onStepChange}>
        <material_1.DialogTitle sx={{
            position: isFullscreen ? 'fixed' : 'relative',
            top: isFullscreen ? (isHeaderVisible ? 0 : -80) : 'auto',
            left: 0,
            right: 0,
            zIndex: isFullscreen ? 1300 : 'auto',
            transition: 'top 0.3s ease-in-out',
            backgroundColor: isFullscreen ? 'background.paper' : 'transparent',
            boxShadow: isFullscreen && isHeaderVisible ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
        }}>
          <material_1.Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <material_1.Typography variant="h6">{title}</material_1.Typography>
            
            {/* アイコンボタングループ */}
            <material_1.Fade in={shouldShowIconGroup}>
              <material_1.Stack direction="row" spacing={1} sx={{
            position: isFullscreen && iconGroupSettings.fullscreenMode === 'hover' ? 'absolute' : 'relative',
            right: isFullscreen && iconGroupSettings.fullscreenMode === 'hover' ? 16 : 0,
            top: isFullscreen && iconGroupSettings.fullscreenMode === 'hover' ? 16 : 0,
            backgroundColor: isFullscreen && iconGroupSettings.fullscreenMode === 'hover'
                ? 'rgba(255, 255, 255, 0.95)'
                : 'transparent',
            borderRadius: 1,
            padding: isFullscreen && iconGroupSettings.fullscreenMode === 'hover' ? 1 : 0,
            boxShadow: isFullscreen && iconGroupSettings.fullscreenMode === 'hover'
                ? '0 2px 8px rgba(0,0,0,0.15)'
                : 'none',
        }}>
                <material_1.IconButton onClick={toggleFullscreen} color="inherit" aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} size="small">
                  {isFullscreen ? <icons_material_1.FullscreenExit /> : <icons_material_1.Fullscreen />}
                </material_1.IconButton>
                <material_1.IconButton aria-label="close" onClick={onClose} color="inherit" size="small">
                  <icons_material_1.Close />
                </material_1.IconButton>
              </material_1.Stack>
            </material_1.Fade>
          </material_1.Box>
        </material_1.DialogTitle>
        
        <material_1.DialogContent sx={{
            // フルスクリーン時はヘッダー・フッターのスペースを考慮
            paddingTop: isFullscreen ? '80px' : undefined,
            paddingBottom: isFullscreen ? '80px' : undefined,
            height: isFullscreen ? '100vh' : 'auto',
            overflow: 'auto',
        }}>
          {/* ステッパーもヘッダーと一緒に隠す */}
          <material_1.Box sx={{
            opacity: isFullscreen ? (isHeaderVisible ? 1 : 0) : 1,
            transition: 'opacity 0.3s ease-in-out',
            pointerEvents: isFullscreen && !isHeaderVisible ? 'none' : 'auto',
        }}>
            <StepNavigation allowStepNavigation={allowStepNavigation}/>
          </material_1.Box>
          <StepContentRenderer />
        </material_1.DialogContent>
        
        <material_1.DialogActions sx={{
            p: 2,
            position: isFullscreen ? 'fixed' : 'relative',
            bottom: isFullscreen ? (isFooterVisible ? 0 : -80) : 'auto',
            left: 0,
            right: 0,
            zIndex: isFullscreen ? 1300 : 'auto',
            transition: 'bottom 0.3s ease-in-out',
            backgroundColor: isFullscreen ? 'background.paper' : 'transparent',
            boxShadow: isFullscreen && isFooterVisible ? '0 -2px 8px rgba(0,0,0,0.15)' : 'none',
            borderTop: isFullscreen && isFooterVisible ? '1px solid' : 'none',
            borderColor: 'divider',
        }}>
          <DialogActionsContent onComplete={handleDialogComplete} onClose={handleDialogClose}/>
        </material_1.DialogActions>
      </StepWizardContext_1.WizardProvider>
    </material_1.Dialog>);
}
exports.MultiStepDialog = MultiStepDialog;
exports.default = MultiStepDialog;
