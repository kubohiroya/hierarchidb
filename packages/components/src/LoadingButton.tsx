import { Box, Button, CircularProgress } from '@mui/material';

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
  const spinner = (
    <CircularProgress
      size={16}
      thickness={5}
      color="inherit"
    />
  );
  const resolvedEndIcon = loading
    ? spinner
    : (
      endIcon ?? (
        <Box
          component="span"
          sx={{ display: 'inline-flex', width: 16, height: 16 }}
        />
      )
    );
  const mergedSx = sx
    ? [{ minWidth: 160 }, ...(Array.isArray(sx) ? sx : [sx])]
    : [{ minWidth: 160 }];
  return (
    <Button
      {...rest}
      disabled={disabled || loading}
      startIcon={startIcon}
      endIcon={resolvedEndIcon}
      sx={mergedSx}
      data-loading={loading ? 'true' : undefined}
    >
      {children}
    </Button>
  );
};