import React from 'react';
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
export declare const DragDropSection: React.FC<DragDropSectionProps>;
export {};
//# sourceMappingURL=DragDropSection.d.ts.map
