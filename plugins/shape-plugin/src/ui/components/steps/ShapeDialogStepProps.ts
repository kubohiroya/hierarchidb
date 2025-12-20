import type { ShapeEntity } from '../../../common/types/index.js';

export type ShapeDialogStepProps = {
  data: Partial<ShapeEntity>;
  onChange: (patch: Partial<ShapeEntity>) => void;
  disabled?: boolean;
};
