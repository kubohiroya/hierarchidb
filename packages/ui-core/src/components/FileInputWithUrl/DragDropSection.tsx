import React from 'react';
import { Box, Typography } from '@mui/material';

interface DragDropSectionProps {
  onDrop: (files: FileList) => void;
  compact?: boolean;
}

export const DragDropSection: React.FC<DragDropSectionProps> = ({ onDrop, compact = false }) => {
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      onDrop(e.dataTransfer.files);
    }
  };

  return (
    <Box
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      sx={{
        border: '2px dashed #ccc',
        borderRadius: 1,
        p: compact ? 1 : 2,
        textAlign: 'center',
        '&:hover': { borderColor: 'primary.main' },
      }}
    >
      <Typography variant={compact ? 'caption' : 'body2'}>Drag and drop files here</Typography>
    </Box>
  );
};
