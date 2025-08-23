import React, { useState } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import { ImportExport as ImportExportIcon } from '@mui/icons-material';
import { ImportExportMenu } from './ImportExportMenu';
import type { ImportExportMenuProps } from './ImportExportMenu';


export interface ImportExportButtonProps
  extends Omit<ImportExportMenuProps, 'anchorEl' | 'open' | 'onClose'> {
  disabled?: boolean;
  tooltipTitle?: string;
  size?: 'small' | 'medium' | 'large';
  variant?: 'icon' | 'button';
  showLabel?: boolean;
}

export function ImportExportButton({
  disabled = false,
  tooltipTitle = 'Import and export options',
  size = 'small',
  variant = 'icon',
  showLabel = false,
  ...menuProps
}: ImportExportButtonProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  if (variant === 'button' && showLabel) {
    return (
      <>
        <Tooltip title={tooltipTitle}>
          <span>
            <IconButton
              onClick={handleClick}
              disabled={disabled}
              aria-label={tooltipTitle}
              size={size}
              sx={{
                display: 'flex',
                gap: 1,
                px: showLabel ? 2 : undefined,
              }}
            >
              <ImportExportIcon />
              {showLabel && 'Import/Export'}
            </IconButton>
          </span>
        </Tooltip>
        
        <ImportExportMenu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleClose}
          {...menuProps}
        />
      </>
    );
  }

  return (
    <>
      <Tooltip title={tooltipTitle}>
        <span>
          <IconButton
            onClick={handleClick}
            disabled={disabled}
            aria-label={tooltipTitle}
            size={size}
          >
            <ImportExportIcon />
          </IconButton>
        </span>
      </Tooltip>
      
      <ImportExportMenu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        {...menuProps}
      />
    </>
  );
}