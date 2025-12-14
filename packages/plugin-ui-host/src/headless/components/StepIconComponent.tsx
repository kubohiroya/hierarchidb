import type { StepIconProps } from '@mui/material/StepIcon';
import { StepStatusIcon } from './StepStatusIcon.js';
import type { Theme } from '@mui/material';
export const StepIconComponent = (iconProps: StepIconProps & { index: number, canNavigate: boolean, isValidatedButDisabled: boolean, theme: Theme}) => {
  const {index, canNavigate, isValidatedButDisabled, theme} = iconProps;
  const indexNumber =
    typeof iconProps.icon === 'number'
      ? Number(iconProps.icon) - 1
      : index;
  return (
    <StepStatusIcon
      {...iconProps}
      theme={theme}
      stepIndex={indexNumber}
      canNavigate={canNavigate}
      variant={isValidatedButDisabled ? 'validated-disabled' : undefined}
    />
  );
};
