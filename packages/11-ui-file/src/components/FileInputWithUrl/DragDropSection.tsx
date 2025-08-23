import React from 'react';
import { Box, Button, Paper, Typography } from '@mui/material';
import { InsertDriveFile } from '@mui/icons-material';

interface DragDropSectionProps {
  isDragging: boolean;
  disabled: boolean;
  loading: boolean;
  isDownloading: boolean;
  buttonLabel: string;
  fileInputRef: React.RefObject<HTMLInputElement>;
  accept: string;
  hoveredSection: 'drag' | 'url' | undefined;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  compact?: boolean;
}

export const DragDropSection: React.FC<DragDropSectionProps> = ({
  isDragging,
  disabled,
  loading,
  isDownloading,
  buttonLabel,
  fileInputRef,
  accept,
  hoveredSection,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileSelect,
  onMouseEnter,
  onMouseLeave,
  compact = false,
}) => {
  return (
    <Paper
      variant="outlined"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      sx={{
        p: compact ? 2 : 3,
        mb: compact ? 0 : 3,
        textAlign: 'center',
        backgroundColor: isDragging ? 'action.hover' : 'background.paper',
        borderStyle: 'dashed',
        borderWidth: 2,
        borderColor: isDragging ? 'primary.main' : 'divider',
        borderRadius: 2,
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        opacity: hoveredSection === 'url' ? 0.4 : 1,
        '&:hover': {
          backgroundColor: 'action.hover',
          borderColor: 'primary.light',
          '& .drop-hint-animation': {
            animationPlayState: 'running',
          },
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: isDragging
            ? 'radial-gradient(circle at center, transparent 0%, rgba(25, 118, 210, 0.05) 100%)'
            : 'none',
          pointerEvents: 'none',
        },
      }}
      onClick={() => !disabled && !loading && !isDownloading && fileInputRef.current?.click()}
    >
      {/* Drag overlay - now inside the Paper to limit its scope */}
      {isDragging && (
        <Paper
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(25, 118, 210, 0.08)',
            border: '2px dashed',
            borderColor: 'primary.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            pointerEvents: 'none',
            borderRadius: 2, // Match parent border radius
          }}
        >
          <Typography variant="h6" color="primary">
            Drop file here
          </Typography>
        </Paper>
      )}
      {/* Animated border effect */}
      <Box
        className="drop-hint-animation"
        sx={{
          position: 'absolute',
          top: -2,
          left: -2,
          right: -2,
          bottom: -2,
          borderRadius: 2,
          border: '2px solid',
          borderColor: 'primary.main',
          opacity: 0,
          animation: 'pulse-border 2s ease-in-out infinite',
          animationPlayState: 'paused',
          pointerEvents: 'none',
          '@keyframes pulse-border': {
            '0%': {
              opacity: 0,
              transform: 'scale(0.95)',
            },
            '50%': {
              opacity: 0.3,
              transform: 'scale(1)',
            },
            '100%': {
              opacity: 0,
              transform: 'scale(1.05)',
            },
          },
        }}
      />
      {/* Title with icon - matching bottom section layout */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: compact ? 1 : 2 }}>
        <InsertDriveFile
          sx={{
            mr: 1,
            color: 'text.secondary',
            fontSize: compact ? '1rem' : '1.5rem',
          }}
        />
        <Typography variant={compact ? 'body1' : 'subtitle1'} fontWeight={500}>
          Select local file
        </Typography>
      </Box>

      {/* Drag & Drop instruction and button */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: compact ? 1 : 2,
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        <Typography variant={compact ? 'body2' : 'h6'}>
          {compact ? 'Drag & Drop file' : 'Drag & Drop your local file here'}
        </Typography>

        <Typography variant={compact ? 'caption' : 'body2'} color="text.secondary">
          or
        </Typography>

        {/* File selection button */}
        <Button
          variant="contained"
          size={compact ? 'medium' : 'large'}
          component="label"
          disabled={disabled || loading || isDownloading}
          startIcon={<InsertDriveFile />}
          onClick={(e) => e.stopPropagation()}
          sx={{
            textTransform: 'none',
            p: compact ? 1.5 : 2,
            borderRadius: '8px',
            fontSize: compact ? '0.875rem' : '1rem',
          }}
        >
          {buttonLabel}
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            hidden
            onChange={onFileSelect}
            disabled={disabled || loading || isDownloading}
          />
        </Button>
      </Box>
    </Paper>
  );
};
