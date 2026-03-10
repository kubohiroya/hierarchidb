import { useRef, useLayoutEffect, useState, type ReactNode } from 'react';
import { Box, Button, CircularProgress } from '@mui/material';

const SPINNER_SIZE_PX = 16;

/**
 * Renders an icon slot that keeps a stable width across icon/spinner swaps.
 * Measures the rendered icon width and ensures the container never shrinks
 * below the largest observed width (or the spinner size).
 */
function StableIconSlot({ icon, loading }: { icon: ReactNode; loading: boolean }): React.JSX.Element {
  const iconRef = useRef<HTMLSpanElement | null>(null);
  const [minWidth, setMinWidth] = useState(SPINNER_SIZE_PX);

  useLayoutEffect(() => {
    const el = iconRef.current;
    if (el) {
      const measured = el.getBoundingClientRect().width;
      setMinWidth((prev) => Math.max(prev, measured));
    }
  }, [icon, loading]);

  const spinner = (
    <CircularProgress
      size={SPINNER_SIZE_PX}
      thickness={5}
      color="inherit"
    />
  );

  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth,
        height: SPINNER_SIZE_PX,
      }}
    >
      {loading ? (
        spinner
      ) : (
        <Box component="span" ref={iconRef} sx={{ display: 'inline-flex' }}>
          {icon}
        </Box>
      )}
    </Box>
  );
}

type LoadingButtonProps = React.ComponentProps<typeof Button> & { loading?: boolean };
export const LoadingButton: React.FC<LoadingButtonProps> = ({
                                                              loading = false,
                                                              disabled,
                                                              startIcon,
                                                              endIcon,
                                                              sx,
                                                              children,
                                                              ...rest
                                                            }) => {
  const stableEndIcon = (
    <StableIconSlot
      icon={endIcon ?? <Box component="span" sx={{ display: 'inline-flex', width: SPINNER_SIZE_PX, height: SPINNER_SIZE_PX }} />}
      loading={loading}
    />
  );
  const mergedSx = sx
    ? [{ minWidth: 160 }, ...(Array.isArray(sx) ? sx : [sx])]
    : [{ minWidth: 160 }];
  return (
    <Button
      {...rest}
      disabled={disabled || loading}
      startIcon={startIcon}
      endIcon={stableEndIcon}
      sx={mergedSx}
      data-loading={loading ? 'true' : undefined}
    >
      {children}
    </Button>
  );
};