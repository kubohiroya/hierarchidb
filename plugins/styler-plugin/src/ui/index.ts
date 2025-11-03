export type {
  StylerCreateConfig,
  StylerSimpleDialogProps,
} from './components/StylerSimpleDialog.js';
export { StylerSimpleDialog } from './components/StylerSimpleDialog.js';
export { BasicInfoStep } from './components/steps/BasicInfoStep.js';
// Register host-composed steps (idempotent)
import './components/steps-provider.tsx';
