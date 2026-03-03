/**
 * @fileoverview LRUSplitView2 - Split view with LRU pane management and render slots
 * @module @hierarchidb/ui-lru-splitview/components
 */

import type React from 'react';
import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';

import type { LRUSplitViewConfig, PaneProgress, PaneState } from '~/types/LRUSplitView';
import { useLRUSplitView2 } from './useLRUSplitView2';

export type LRUSplitView2Pane = {
  id: string;
  defaultExpanded?: boolean;
  collapsedSize?: number;
};

export type LRUSplitView2RenderContext = {
  id: string;
  isExpanded: boolean;
  collapsedSize: number;
  toggle: () => void;
  state: PaneState;
};

export interface LRUSplitView2Props {
  panes: LRUSplitView2Pane[];
  renderPane: (ctx: LRUSplitView2RenderContext) => React.ReactNode;
  maxExpandedPanes?: number;
  responsiveBreakpoints?: number[];
  initialPaneSizesByBreakpoint?: number[][];
  autoCloseCountsByBreakpoint?: number[];
  defaultCollapsedSize?: number;
  vertical?: boolean;
  autoExpand?: LRUSplitViewConfig['autoExpand'];
  progress?: PaneProgress[];
  onPaneToggle?: (paneId: string, isExpanded: boolean) => void;
  onPaneReorder?: (paneIds: string[]) => void;
  height?: string | number;
  width?: string | number;
  sx?: SxProps<Theme>;
}

export const LRUSplitView2: React.FC<LRUSplitView2Props> = ({
  panes,
  renderPane,
  maxExpandedPanes = 2,
  responsiveBreakpoints,
  initialPaneSizesByBreakpoint,
  autoCloseCountsByBreakpoint,
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
    containerRef,
    paneStates,
    sizes,
    layoutKey,
    handlePaneReorder,
    togglePane,
  } = useLRUSplitView2({
    panes,
    maxExpandedPanes,
    responsiveBreakpoints,
    initialPaneSizesByBreakpoint,
    autoCloseCountsByBreakpoint,
    defaultCollapsedSize,
    autoExpand,
    progress,
    onPaneToggle,
    onPaneReorder,
  });

  return (
    <Box ref={containerRef} sx={[{ height, width }, sx] as SxProps<Theme>}>
      <Allotment
        key={layoutKey}
        vertical={vertical}
        proportionalLayout={false}
        defaultSizes={sizes}
        onDragEnd={handlePaneReorder}
      >
        {paneStates.map((state, index) => (
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
              {renderPane({
                id: state.id,
                isExpanded: state.isExpanded,
                collapsedSize: state.collapsedSize ?? defaultCollapsedSize,
                toggle: () => togglePane(state.id),
                state,
              })}
            </Box>
          </Allotment.Pane>
        ))}
      </Allotment>
    </Box>
  );
};
