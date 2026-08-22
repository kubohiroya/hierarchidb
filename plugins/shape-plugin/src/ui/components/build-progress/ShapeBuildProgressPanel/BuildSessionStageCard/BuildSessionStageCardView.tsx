import {
  ArrowCircleDown as ArrowCircleDownIcon,
  ArrowCircleUp as ArrowCircleUpIcon,
} from '@mui/icons-material';
import { Box, IconButton, Skeleton, Stack, Typography } from '@mui/material';
import { TaskItemCardListCard } from '~/ui/components/build-progress/TaskItemCardListCard/TaskItemCardListCard';
import type { BuildSessionStageCardState } from './useBuildSessionStageCardState.js';

type BuildSessionStageCardViewProps = BuildSessionStageCardState & {
  showHeader?: boolean;
};

export const BuildSessionStageCardView = ({
  showHeader,
  stage,
  stageValue,
  resolveStatusLabel,
  resolveStatusColor,
  resolveTaskTitle,
  t,
  displayTasks,
  hasTasks,
  hasSummaryTasks,
  showSummarySkeleton,
  showTaskSkeleton,
  showUpArrow,
  showDownArrow,
  scrollTargetTaskId,
  scrollRequestId,
  listWrapperRef,
  listScrollRef,
  handleScrollToDirection,
  disableVirtualization,
  isDetailFloatingWindowOpen,
  isOpeningPending,
  buildConfig,
  onOpenDetailFloatingWindow,
  onCloseDetailFloatingWindow,
  floatingWindowZIndex,
  onRequestBringFloatingWindowToFront,
}: BuildSessionStageCardViewProps) => (
  <Stack spacing={1} sx={{ p: 2, height: '100%', minHeight: 0 }}>
    {showSummarySkeleton ? (
      <>
        <Skeleton variant="text" width="40%" />
        <Skeleton variant="text" width="70%" />
        <Skeleton variant="rounded" height={88} />
      </>
    ) : showTaskSkeleton ? (
      <>
        <Skeleton variant="text" width="35%" />
        <Skeleton variant="rounded" height={88} />
      </>
    ) : !hasTasks ? (
      <>
        {showHeader ? (
          <>
            <Typography variant="subtitle2">{stage.title}</Typography>
            {stage.description ? (
              <Typography variant="body2" color="text.secondary">
                {stage.description}
              </Typography>
            ) : null}
          </>
        ) : null}
        <Typography variant="caption" color="text.secondary">
          {hasSummaryTasks
            ? t('stage.tasks.summaryOnly', 'Tasks are summarized. Detailed list is unavailable.')
            : t('stage.tasks.empty', 'No tasks yet.')}
        </Typography>
      </>
    ) : (
      <Box
        sx={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
        ref={listWrapperRef}
      >
        <TaskItemCardListCard
          ref={listScrollRef}
          stageId={stage.id}
          tasks={displayTasks}
          stageValue={stageValue}
          resolveStatusLabel={resolveStatusLabel}
          resolveStatusColor={resolveStatusColor}
          resolveTaskTitle={resolveTaskTitle}
          scrollToTaskId={scrollTargetTaskId}
          scrollRequestId={scrollRequestId}
          virtualize={!disableVirtualization}
          isDetailFloatingWindowOpen={isDetailFloatingWindowOpen}
          isOpeningPending={isOpeningPending}
          buildConfig={buildConfig}
          onOpenDetailFloatingWindow={onOpenDetailFloatingWindow}
          onCloseDetailFloatingWindow={onCloseDetailFloatingWindow}
          floatingWindowZIndex={floatingWindowZIndex}
          onRequestBringFloatingWindowToFront={onRequestBringFloatingWindowToFront}
        />
        {showUpArrow ? (
          <IconButton
            aria-label={t(
              'stage.progress.scrollToRunningUp',
              'Scroll up to running or queued task'
            )}
            color="primary"
            onClick={() => handleScrollToDirection('up')}
            sx={{
              position: 'absolute',
              left: '50%',
              top: 0,
              transform: 'translateX(-50%)',
              bgcolor: 'background.paper',
              boxShadow: 3,
              border: 1,
              borderColor: 'divider',
              p: 1,
              zIndex: 2,
              width: 52,
              height: 52,
              borderRadius: '50%',
              '&:hover': { bgcolor: 'transparent' },
            }}
          >
            <ArrowCircleUpIcon sx={{ fontSize: 48 }} />
          </IconButton>
        ) : null}
        {showDownArrow ? (
          <IconButton
            aria-label={t(
              'stage.progress.scrollToRunningDown',
              'Scroll down to running or queued task'
            )}
            color="primary"
            onClick={() => handleScrollToDirection('down')}
            sx={{
              position: 'absolute',
              left: '50%',
              bottom: 0,
              transform: 'translateX(-50%)',
              bgcolor: 'background.paper',
              boxShadow: 3,
              border: 1,
              borderColor: 'divider',
              p: 1,
              zIndex: 2,
              width: 52,
              height: 52,
              borderRadius: '50%',
              '&:hover': { bgcolor: 'transparent' },
            }}
          >
            <ArrowCircleDownIcon sx={{ fontSize: 48 }} />
          </IconButton>
        ) : null}
      </Box>
    )}
  </Stack>
);
