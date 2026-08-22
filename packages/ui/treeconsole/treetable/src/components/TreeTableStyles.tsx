import type {
  BoxProps,
  SxProps,
  TableHeadProps,
  TableProps,
  TableRowProps,
  Theme,
} from '@mui/material';
import { Box, Table, TableHead, TableRow } from '@mui/material';
import { forwardRef } from 'react';

type WithSx<T> = T & { sx?: SxProps<Theme> };

type StyledRowProps = TableRowProps & { selected?: boolean };

const mergeSx = (base: SxProps<Theme>, incoming?: SxProps<Theme>): SxProps<Theme> => {
  if (!incoming) return base;
  const parts = Array.isArray(incoming) ? incoming : [incoming];
  return [base, ...parts] as SxProps<Theme>;
};

export const StyledTableContainer = forwardRef<HTMLDivElement, BoxProps>(
  function StyledTableContainer({ sx, ...props }, ref) {
    return (
      <Box
        ref={ref}
        {...props}
        sx={mergeSx(
          {
            width: '100%',
            height: '100%',
            overflow: 'auto',
            position: 'relative',
            '&::-webkit-scrollbar': {
              width: 12,
              height: 12,
            },
            '&::-webkit-scrollbar-track': {
              background: 'rgba(0, 0, 0, 0.05)',
            },
            '&::-webkit-scrollbar-thumb': {
              background: 'rgba(0, 0, 0, 0.2)',
              borderRadius: 6,
              '&:hover': {
                background: 'rgba(0, 0, 0, 0.3)',
              },
            },
          },
          sx
        )}
      />
    );
  }
);

export const StyledTable = ({ sx, ...props }: TableProps) => (
  <Table
    {...props}
    stickyHeader
    sx={mergeSx(
      {
        borderCollapse: 'collapse',
        width: '100%',
        tableLayout: 'fixed',
        minWidth: '100%',
      },
      sx
    )}
  />
);

export const StyledTableHead = ({ sx, ...props }: TableHeadProps) => (
  <TableHead
    {...props}
    sx={mergeSx(
      {
        position: 'sticky',
        top: 0,
        zIndex: 1,
        background: (theme) => theme.palette.background.paper,
        borderTop: (theme) => `1px solid ${theme.palette.divider}`,
        '& .MuiTableCell-root': {
          fontWeight: 600,
          borderBottom: (theme) => `3px solid ${theme.palette.divider}`,
          borderRight: (theme) => `2px solid ${theme.palette.divider}`,
          padding: '4px 0',
          userSelect: 'none',
          position: 'relative',
          '&:last-child': {
            borderRight: 'none',
          },
        },
      },
      sx
    )}
  />
);

export const ResizeHandle = ({ sx, ...props }: BoxProps) => (
  <Box
    component="div"
    {...props}
    sx={mergeSx(
      {
        position: 'absolute',
        right: -5,
        top: 0,
        bottom: 0,
        width: 10,
        cursor: 'col-resize',
        zIndex: 2,
        userSelect: 'none',
        '&:hover': {
          backgroundColor: 'rgba(25, 118, 210, 0.3)',
        },
        '&.resizing': {
          backgroundColor: 'rgba(25, 118, 210, 0.5)',
        },
      },
      sx
    )}
  />
);

export const StyledTableRow = ({ sx, selected, ...props }: StyledRowProps) => (
  <TableRow
    {...props}
    selected={selected}
    sx={mergeSx(
      {
        '&:hover': {
          backgroundColor: 'rgba(0, 0, 0, 0.04)',
        },
        ...(selected
          ? {
              backgroundColor: 'rgba(25, 118, 210, 0.08) !important',
            }
          : {}),
        '& .MuiTableCell-root': {
          padding: '4px 4px 4px 4px',
          borderRight: (theme) => `1px solid ${theme.palette.divider}`,
          borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
          transition: 'outline-color 120ms ease, background-color 120ms ease',
          '&:last-child': {
            borderRight: 'none',
          },
        },
      },
      sx
    )}
  />
);

export const NameCell = ({ sx, ...props }: WithSx<BoxProps>) => (
  <Box
    {...props}
    sx={mergeSx(
      {
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        minHeight: 24,
        paddingLeft: 0,
      },
      sx
    )}
  />
);

export const IndentSpace = ({ depth }: { depth: number }) => (
  <Box sx={{ width: depth * 24, flexShrink: 0 }} component="span" />
);
