"use strict";
/**
 * @fileoverview StepperDialog - Multi-step dialog with stepper navigation
 * Enhanced with fullscreen toggle and custom footer support
 */
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.StepperDialog = void 0;
var react_1 = require("react");
var material_1 = require("@mui/material");
var icons_material_1 = require("@mui/icons-material");
var UnsavedChangesDialog_1 = require("./UnsavedChangesDialog");
var StepperDialog = function (_a) {
    var _b;
    var mode = _a.mode, open = _a.open, nodeId = _a.nodeId, _parentId = _a.parentId, // TODO: Use for create mode
    title = _a.title, icon = _a.icon, steps = _a.steps, controlledActiveStep = _a.activeStep, onStepChange = _a.onStepChange, _c = _a.nonLinear, nonLinear = _c === void 0 ? false : _c, _d = _a.hasUnsavedChanges, hasUnsavedChanges = _d === void 0 ? false : _d, _e = _a.supportsDraft, supportsDraft = _e === void 0 ? false : _e, _f = _a.maxWidth, maxWidth = _f === void 0 ? 'lg' : _f, _g = _a.fullScreen, initialFullScreen = _g === void 0 ? false : _g, headerActions = _a.headerActions, customFooterContent = _a.customFooterContent, onSubmit = _a.onSubmit, onSaveDraft = _a.onSaveDraft, onCancel = _a.onCancel, onClose = _a.onClose;
    // Internal state
    var _h = (0, react_1.useState)(0), internalActiveStep = _h[0], setInternalActiveStep = _h[1];
    var _j = (0, react_1.useState)(initialFullScreen), isFullscreen = _j[0], setIsFullscreen = _j[1];
    var _k = (0, react_1.useState)(false), showUnsavedChangesDialog = _k[0], setShowUnsavedChangesDialog = _k[1];
    var _l = (0, react_1.useState)(false), isSubmitting = _l[0], setIsSubmitting = _l[1];
    // Use controlled or internal step state
    var currentStep = controlledActiveStep !== null && controlledActiveStep !== void 0 ? controlledActiveStep : internalActiveStep;
    // Step navigation helpers
    var isFirstStep = currentStep === 0;
    var isLastStep = currentStep === steps.length - 1;
    var totalSteps = steps.length;
    // Validation for current and all previous steps
    var canGoNext = (0, react_1.useMemo)(function () {
        var _a, _b;
        var currentStepConfig = steps[currentStep];
        return (_b = (_a = currentStepConfig === null || currentStepConfig === void 0 ? void 0 : currentStepConfig.validate) === null || _a === void 0 ? void 0 : _a.call(currentStepConfig)) !== null && _b !== void 0 ? _b : true;
    }, [steps, currentStep]);
    var canGoPrevious = currentStep > 0;
    var canSubmit = (0, react_1.useMemo)(function () {
        // All steps must be valid for submission
        return steps.every(function (step, index) {
            var _a, _b;
            if (index > currentStep)
                return true; // Don't validate future steps
            return (_b = (_a = step.validate) === null || _a === void 0 ? void 0 : _a.call(step)) !== null && _b !== void 0 ? _b : true;
        });
    }, [steps, currentStep]);
    // Step change handler
    var handleStepChange = (0, react_1.useCallback)(function (newStep) {
        if (onStepChange) {
            onStepChange(newStep);
        }
        else {
            setInternalActiveStep(newStep);
        }
    }, [onStepChange]);
    // Navigation handlers
    var handleNext = (0, react_1.useCallback)(function () {
        if (!isLastStep && canGoNext) {
            handleStepChange(currentStep + 1);
        }
    }, [currentStep, isLastStep, canGoNext, handleStepChange]);
    var handleBack = (0, react_1.useCallback)(function () {
        if (canGoPrevious) {
            handleStepChange(currentStep - 1);
        }
    }, [currentStep, canGoPrevious, handleStepChange]);
    // Dialog close handler
    var handleClose = (0, react_1.useCallback)(function () {
        if (hasUnsavedChanges) {
            setShowUnsavedChangesDialog(true);
        }
        else {
            (onClose === null || onClose === void 0 ? void 0 : onClose()) || onCancel();
        }
    }, [hasUnsavedChanges, onClose, onCancel]);
    // Submit handler
    var handleSubmit = (0, react_1.useCallback)(function () { return __awaiter(void 0, void 0, void 0, function () {
        var error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!canSubmit || isSubmitting)
                        return [2 /*return*/];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    setIsSubmitting(true);
                    return [4 /*yield*/, onSubmit()];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 3:
                    error_1 = _a.sent();
                    console.error('Dialog submission failed:', error_1);
                    return [3 /*break*/, 5];
                case 4:
                    setIsSubmitting(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); }, [canSubmit, isSubmitting, onSubmit]);
    // Save draft handler
    var handleSaveDraft = (0, react_1.useCallback)(function () { return __awaiter(void 0, void 0, void 0, function () {
        var error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!onSaveDraft)
                        return [2 /*return*/];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, onSaveDraft()];
                case 2:
                    _a.sent();
                    setShowUnsavedChangesDialog(false);
                    (onClose === null || onClose === void 0 ? void 0 : onClose()) || onCancel();
                    return [3 /*break*/, 4];
                case 3:
                    error_2 = _a.sent();
                    console.error('Save draft failed:', error_2);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); }, [onSaveDraft, onClose, onCancel]);
    // Discard changes handler
    var handleDiscardChanges = (0, react_1.useCallback)(function () {
        setShowUnsavedChangesDialog(false);
        (onClose === null || onClose === void 0 ? void 0 : onClose()) || onCancel();
    }, [onClose, onCancel]);
    // Fullscreen toggle
    var toggleFullscreen = (0, react_1.useCallback)(function () {
        setIsFullscreen(!isFullscreen);
    }, [isFullscreen]);
    // Step click handler (for non-linear navigation)
    var handleStepClick = (0, react_1.useCallback)(function (stepIndex) {
        if (!nonLinear)
            return;
        // Allow navigation to any completed step or the next incomplete step
        var canNavigateToStep = stepIndex <= currentStep || (stepIndex === currentStep + 1 && canGoNext);
        if (canNavigateToStep) {
            handleStepChange(stepIndex);
        }
    }, [nonLinear, currentStep, canGoNext, handleStepChange]);
    // Custom footer props
    var footerProps = {
        currentStep: currentStep,
        isFirstStep: isFirstStep,
        isLastStep: isLastStep,
        canGoNext: canGoNext,
        canGoPrevious: canGoPrevious,
        totalSteps: totalSteps,
        onNext: handleNext,
        onBack: handleBack,
        onCancel: handleClose,
        onSubmit: handleSubmit,
    };
    return (<>
      <material_1.Dialog open={open} onClose={handleClose} maxWidth={isFullscreen ? false : maxWidth} fullWidth={!isFullscreen} fullScreen={isFullscreen} disableEscapeKeyDown={hasUnsavedChanges}>
        {/* Dialog Title with Stepper */}
        <material_1.DialogTitle sx={{ pb: 1 }}>
          <material_1.Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <material_1.Stack direction="row" spacing={2} alignItems="center">
              {icon}
              <material_1.Typography variant="h6">{title}</material_1.Typography>
              {mode === 'edit' && (<material_1.Typography variant="caption" color="text.secondary">
                  ({nodeId})
                </material_1.Typography>)}
            </material_1.Stack>

            <material_1.Stack direction="row" spacing={1}>
              {/* Header actions (including fullscreen toggle) */}
              <material_1.IconButton onClick={toggleFullscreen} color="inherit" aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
                {isFullscreen ? <icons_material_1.FullscreenExit /> : <icons_material_1.Fullscreen />}
              </material_1.IconButton>

              {headerActions}

              <material_1.IconButton onClick={handleClose} color="inherit" aria-label="Close dialog">
                <icons_material_1.Close />
              </material_1.IconButton>
            </material_1.Stack>
          </material_1.Box>

          {/* Stepper */}
          <material_1.Stepper activeStep={currentStep} alternativeLabel={totalSteps > 4}>
            {steps.map(function (step, index) { return (<material_1.Step key={step.label} completed={index < currentStep}>
                <material_1.StepButton onClick={function () { return handleStepClick(index); }} disabled={!nonLinear || index > currentStep + 1} optional={step.optional ? (<material_1.Typography variant="caption" color="text.secondary">
                        Optional
                      </material_1.Typography>) : undefined}>
                  {step.label}
                </material_1.StepButton>
              </material_1.Step>); })}
          </material_1.Stepper>
        </material_1.DialogTitle>

        {/* Dialog Content */}
        <material_1.DialogContent sx={{ px: 0, flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <material_1.Box sx={{ height: '100%' }}>{(_b = steps[currentStep]) === null || _b === void 0 ? void 0 : _b.content}</material_1.Box>
        </material_1.DialogContent>

        {/* Dialog Actions */}
        <material_1.DialogActions sx={{ p: 0, justifyContent: 'stretch' }}>
          {customFooterContent ? (customFooterContent(footerProps)) : (<material_1.Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                p: 2,
                width: '100%',
            }}>
              {/* Left side buttons */}
              <material_1.Button onClick={isFirstStep ? handleClose : handleBack} variant="outlined" size="large" disabled={isSubmitting}>
                {isFirstStep ? 'Cancel' : 'Back'}
              </material_1.Button>

              {/* Right side buttons */}
              <material_1.Stack direction="row" spacing={2}>
                {!isLastStep && (<material_1.Button onClick={handleNext} variant="contained" size="large" disabled={!canGoNext || isSubmitting}>
                    Next
                  </material_1.Button>)}

                {isLastStep && (<material_1.Button onClick={handleSubmit} variant="contained" size="large" disabled={!canSubmit || isSubmitting}>
                    {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create' : 'Save'}
                  </material_1.Button>)}
              </material_1.Stack>
            </material_1.Box>)}
        </material_1.DialogActions>
      </material_1.Dialog>

      {/* Unsaved Changes Confirmation Dialog */}
      <UnsavedChangesDialog_1.UnsavedChangesDialog open={showUnsavedChangesDialog} title={"Discard ".concat(title, "?")} message={"You have unsaved changes. Are you sure you want to discard your changes?"} showSaveDraft={supportsDraft && !!onSaveDraft} onDiscard={handleDiscardChanges} onSaveDraft={handleSaveDraft} onCancel={function () { return setShowUnsavedChangesDialog(false); }}/>
    </>);
};
exports.StepperDialog = StepperDialog;
