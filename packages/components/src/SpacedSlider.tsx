import { Slider, type SliderProps } from '@mui/material';
import { forwardRef } from 'react';

type SpacedSliderProps = SliderProps & {
  /** Extra top spacing in px above the slider (default: 32). */
  topSpacing?: number;
};

/**
 * A Slider wrapped with configurable top spacing.
 * Useful when a valueLabelDisplay="on" tooltip needs room above the track.
 */
export const SpacedSlider = forwardRef<HTMLSpanElement, SpacedSliderProps>(function SpacedSlider(
  { topSpacing = 32, sx, ...rest },
  ref
) {
  return (
    <Slider
      ref={ref}
      sx={[{ mt: `${String(topSpacing)}px` }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
      {...rest}
    />
  );
});
