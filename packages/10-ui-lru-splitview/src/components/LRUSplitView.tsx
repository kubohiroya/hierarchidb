/**
 * @fileoverview LRUSplitView - Main split view component with LRU pane management
 * @module @hierarchidb/ui-lru-splitview/components
 */

import React from 'react';
import { Box } from '@mui/material';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';

import { useLRUPanes } from '../hooks/useLRUPanes';
import { PaneHeader } from './PaneHeader';
import type { LRUSplitViewConfig } from '../types/LRUSplitView';

export interface LRUSplitViewProps extends LRUSplitViewConfig {
  /** Component height */
  height?: string | number;
  /** Component width */  
  width?: string | number;
  /** Additional CSS styles */
  sx?: any;
}

/**
 * LRUSplitView - Intelligent split view with LRU pane management
 * 
 * Features:
 * - LRU (Least Recently Used) pane expansion management
 * - Configurable maximum expanded panes
 * - Auto-expand on progress completion or task start
 * - Customizable pane headers and content
 * - Vertical or horizontal orientation
 * - Smooth animations and transitions
 */
export const LRUSplitView: React.FC<LRUSplitViewProps> = ({
  panes,
  maxExpandedPanes = 2,
  defaultCollapsedSize = 60,
  vertical = false,
  autoExpand,
  progress = [],
  onPaneToggle,
  onPaneReorder,
  height = '100%',
  width = '100%',
  sx,
}) => {
  const {
    paneStates,
    togglePane,
    getSizes,
  } = useLRUPanes({
    panes,
    maxExpandedPanes,
    defaultCollapsedSize,
    autoExpand,
    progress,
    onPaneToggle,
  });

  const sizes = getSizes();

  // Find progress info for each pane
  const getProgressForPane = (paneId: string) => {
    return progress.find(p => p.paneId === paneId);
  };

  // Get pane config by ID
  const getPaneConfig = (paneId: string) => {
    return panes.find(p => p.id === paneId);
  };

  return (
    <Box sx={{ height, width, ...sx }}>
      {React.createElement(Allotment as any, {
        key: paneStates
          .filter((p) => p.isExpanded)
          .map((p) => p.id)
          .join('-'),
        vertical: vertical,
        proportionalLayout: false,
        defaultSizes: sizes,
        onDragEnd: (_newSizes: number[]) => {
          // Optional: Handle pane resize completion
          if (onPaneReorder) {
            const expandedPanes = paneStates.filter(p => p.isExpanded);
            onPaneReorder(expandedPanes.map(p => p.id));
          }
        },
      },
        paneStates.map((state, index) => {
          const config = getPaneConfig(state.id);
          const progressInfo = getProgressForPane(state.id);
          
          if (!config) return null;

          return React.createElement((Allotment as any).Pane, {
            key: state.id,
            minSize: state.collapsedSize || defaultCollapsedSize,
            preferredSize: sizes[index],
          },
            <Box
              sx={{ 
                height: '100%', 
                width: '100%',
                display: 'flex', 
                flexDirection: 'column',
              }}
            >
              {/* Custom header or default header */}
              {config.customHeader || (
                <PaneHeader
                  pane={config}
                  state={state}
                  progress={progressInfo}
                  onToggle={togglePane}
                />
              )}
              
              {/* Pane content - only render when expanded or always visible */}
              {(state.isExpanded || !config.content) && (
                <Box 
                  sx={{ 
                    flex: 1, 
                    overflow: 'auto',
                    display: state.isExpanded ? 'block' : 'none',
                  }}
                >
                  {config.content}
                </Box>
              )}
            </Box>
          );
        })
      )}
    </Box>
  );
};