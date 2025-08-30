"use strict";
/**
 * @file StepWizardContext.tsx
 * @description マルチステップウィザードのコンテキスト
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
exports.useWizard = exports.WizardProvider = void 0;
var react_1 = require("react");
// ============================================================================
// Reducer
// ============================================================================
function wizardReducer(state, action) {
    switch (action.type) {
        case 'SET_CURRENT_STEP':
            return __assign(__assign({}, state), { currentStep: action.payload });
        case 'UPDATE_STEP_DATA': {
            var _a = action.payload, stepNumber = _a.stepNumber, data = _a.data;
            var step = state.steps.get(stepNumber) || createEmptyStep(stepNumber);
            var updatedStep = __assign(__assign({}, step), { data: __assign(__assign({}, step.data), data) });
            var newSteps = new Map(state.steps);
            newSteps.set(stepNumber, updatedStep);
            // 全体データも更新
            var allData = __assign(__assign({}, state.data), data);
            return __assign(__assign({}, state), { steps: newSteps, data: allData });
        }
        case 'VALIDATE_STEP': {
            var _b = action.payload, stepNumber = _b.stepNumber, isValid = _b.isValid, _c = _b.errors, errors = _c === void 0 ? [] : _c;
            var step = state.steps.get(stepNumber) || createEmptyStep(stepNumber);
            var updatedStep = __assign(__assign({}, step), { isValidated: true, errors: isValid ? [] : errors });
            var newSteps = new Map(state.steps);
            newSteps.set(stepNumber, updatedStep);
            return __assign(__assign({}, state), { steps: newSteps });
        }
        case 'COMPLETE_STEP': {
            var stepNumber = action.payload;
            var step = state.steps.get(stepNumber) || createEmptyStep(stepNumber);
            var updatedStep = __assign(__assign({}, step), { isCompleted: true });
            var newSteps = new Map(state.steps);
            newSteps.set(stepNumber, updatedStep);
            return __assign(__assign({}, state), { steps: newSteps });
        }
        case 'SET_LOADING':
            return __assign(__assign({}, state), { isLoading: action.payload });
        case 'RESET_WIZARD':
            return createInitialState([]);
        case 'COMPLETE_WIZARD':
            return __assign(__assign({}, state), { isCompleted: true });
        default:
            return state;
    }
}
// ============================================================================
// ヘルパー関数
// ============================================================================
function createEmptyStep(stepNumber) {
    return {
        stepNumber: stepNumber,
        isCompleted: false,
        isValidated: false,
        errors: [],
        data: {},
    };
}
function createInitialState(stepDefinitions) {
    var _a;
    var steps = new Map();
    stepDefinitions.forEach(function (def) {
        steps.set(def.stepNumber, createEmptyStep(def.stepNumber));
    });
    return {
        currentStep: ((_a = stepDefinitions[0]) === null || _a === void 0 ? void 0 : _a.stepNumber) || 1,
        steps: steps,
        data: {},
        isCompleted: false,
        isLoading: false,
    };
}
// ============================================================================
// Context
// ============================================================================
var WizardContext = (0, react_1.createContext)(undefined);
function WizardProvider(_a) {
    var children = _a.children, stepDefinitions = _a.stepDefinitions, _b = _a.initialData, initialData = _b === void 0 ? {} : _b, initialStep = _a.initialStep, onStepChange = _a.onStepChange;
    var _c = (0, react_1.useReducer)(wizardReducer, (function () {
        var initialState = createInitialState(stepDefinitions);
        // 初期ステップが指定されていれば設定
        if (initialStep !== undefined && stepDefinitions.some(function (s) { return s.stepNumber === initialStep; })) {
            initialState.currentStep = initialStep;
        }
        // Set initial data for the first step
        if (stepDefinitions.length > 0 && Object.keys(initialData).length > 0) {
            var firstStepNumber = stepDefinitions[0].stepNumber;
            var firstStep = initialState.steps.get(firstStepNumber);
            if (firstStep) {
                var updatedFirstStep = __assign(__assign({}, firstStep), { data: initialData });
                initialState.steps.set(firstStepNumber, updatedFirstStep);
            }
        }
        return __assign(__assign({}, initialState), { data: initialData });
    })()), state = _c[0], dispatch = _c[1];
    // アクション
    var actions = (0, react_1.useMemo)(function () { return ({
        goToNext: function () {
            var sortedSteps = __spreadArray([], stepDefinitions, true).sort(function (a, b) { return a.stepNumber - b.stepNumber; });
            var currentIndex = sortedSteps.findIndex(function (s) { return s.stepNumber === state.currentStep; });
            if (currentIndex < sortedSteps.length - 1) {
                var nextStep = sortedSteps[currentIndex + 1];
                if (nextStep) {
                    dispatch({ type: 'SET_CURRENT_STEP', payload: nextStep.stepNumber });
                }
            }
        },
        goPrevious: function () {
            var sortedSteps = __spreadArray([], stepDefinitions, true).sort(function (a, b) { return a.stepNumber - b.stepNumber; });
            var currentIndex = sortedSteps.findIndex(function (s) { return s.stepNumber === state.currentStep; });
            if (currentIndex > 0) {
                var prevStep = sortedSteps[currentIndex - 1];
                if (prevStep) {
                    dispatch({ type: 'SET_CURRENT_STEP', payload: prevStep.stepNumber });
                }
            }
        },
        goToStep: function (stepNumber) {
            dispatch({ type: 'SET_CURRENT_STEP', payload: stepNumber });
            // ステップ変更のコールバックを呼び出し
            if (onStepChange) {
                onStepChange(stepNumber);
            }
        },
        updateStepData: function (stepNumber, data) {
            dispatch({ type: 'UPDATE_STEP_DATA', payload: { stepNumber: stepNumber, data: data } });
        },
        validateStep: function (stepNumber, result) {
            dispatch({
                type: 'VALIDATE_STEP',
                payload: { stepNumber: stepNumber, isValid: result.isValid, errors: result.errors },
            });
        },
        completeStep: function (stepNumber) {
            dispatch({ type: 'COMPLETE_STEP', payload: stepNumber });
        },
        reset: function () {
            dispatch({ type: 'RESET_WIZARD' });
        },
        complete: function () {
            dispatch({ type: 'COMPLETE_WIZARD' });
        },
    }); }, [state.currentStep, stepDefinitions]);
    // ヘルパー
    var helpers = (0, react_1.useMemo)(function () { return ({
        canGoNext: function () {
            var currentStepState = state.steps.get(state.currentStep);
            return (currentStepState === null || currentStepState === void 0 ? void 0 : currentStepState.isValidated) === true && currentStepState.errors.length === 0;
        },
        canGoPrevious: function () {
            var sortedSteps = __spreadArray([], stepDefinitions, true).sort(function (a, b) { return a.stepNumber - b.stepNumber; });
            var currentIndex = sortedSteps.findIndex(function (s) { return s.stepNumber === state.currentStep; });
            return currentIndex > 0;
        },
        canGoToStep: function (stepNumber) {
            // 依存関係をチェック
            var targetStep = stepDefinitions.find(function (s) { return s.stepNumber === stepNumber; });
            if (!targetStep)
                return false;
            if (targetStep.dependsOn) {
                return targetStep.dependsOn.every(function (depNum) {
                    var depStep = state.steps.get(depNum);
                    return (depStep === null || depStep === void 0 ? void 0 : depStep.isCompleted) === true;
                });
            }
            return true;
        },
        getCurrentStep: function () {
            return state.steps.get(state.currentStep);
        },
        getAllData: function () {
            return state.data;
        },
    }); }, [state, stepDefinitions]);
    var value = (0, react_1.useMemo)(function () { return ({ state: state, actions: actions, helpers: helpers, stepDefinitions: stepDefinitions }); }, [state, actions, helpers, stepDefinitions]);
    return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
}
exports.WizardProvider = WizardProvider;
/**
 * ウィザードコンテキストを使用するフック
 */
function useWizard() {
    var context = (0, react_1.useContext)(WizardContext);
    if (!context) {
        throw new Error('useWizard must be used within a WizardProvider');
    }
    return context;
}
exports.useWizard = useWizard;
