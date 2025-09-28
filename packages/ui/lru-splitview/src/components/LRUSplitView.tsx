/**
 * @fileoverview LRUSplitView - Main split view component with LRU pane management
 * @module @hierarchidb/ui-lru-splitview/components
 */

import type React from 'react';
import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';

import { useLRUPanes } from '../hooks/useLRUPanes.js';
import { PaneHeader } from './PaneHeader.js';
import type { LRUSplitViewConfig } from '../types/LRUSplitView.js';

export interface LRUSplitViewProps extends LRUSplitViewConfig {
  /** Component height */
  height?: string | number;
  /** Component width */
  width?: string | number;
  /** Additional CSS styles */
  sx?: SxProps<Theme>;
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

  const expandedKey = paneStates
    .filter((pane) => pane.isExpanded)
    .map((pane) => pane.id)
    .join('-');

  return (
    <Box sx={[{ height, width }, sx] as SxProps<Theme>}>
      <Allotment
        key={expandedKey}
        vertical={vertical}
        proportionalLayout={false}
        defaultSizes={sizes}
        onDragEnd={() => {
          if (!onPaneReorder) return;
          const expandedPanes = paneStates.filter((pane) => pane.isExpanded);
          onPaneReorder(expandedPanes.map((pane) => pane.id));
        }}
      >
        {paneStates.map((state, index) => {
          const config = getPaneConfig(state.id);
          if (!config) return null;
          const progressInfo = getProgressForPane(state.id);

          return (
            <Allotment.Pane
              key={state.id}
              minSize={state.collapsedSize || defaultCollapsedSize}
              preferredSize={sizes[index]}
            >
              <Box
                sx={{
                  height: '100%',
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {config.customHeader || (
                  <PaneHeader
                    pane={config}
                    state={state}
                    progress={progressInfo}
                    onToggle={togglePane}
                  />
                )}

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
            </Allotment.Pane>
          );
        })}
      </Allotment>
    </Box>
  );
};
