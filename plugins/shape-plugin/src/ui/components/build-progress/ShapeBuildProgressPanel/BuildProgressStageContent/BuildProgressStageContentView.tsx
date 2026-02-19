import { ArrowCircleDown as ArrowCircleDownIcon, ArrowCircleUp as ArrowCircleUpIcon } from '@mui/icons-material';
import { Box, Skeleton, Stack, Tooltip, Typography, IconButton } from '@mui/material';
import type { BuildProgressStageContentState } from './useBuildProgressStageContentState.js';
import { TaskItemCardListCard } from '~/ui/components/build-progress/TaskItemCardListCard/TaskItemCardListCard';

type BuildProgressStageContentViewProps = BuildProgressStageContentState & {
  showHeader?: boolean;
};

export const BuildProgressStageContentView = ({
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
}: BuildProgressStageContentViewProps) => (
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
        />
        {showUpArrow ? (
          <Tooltip title={t('stage.progress.scrollToRunningUp', 'Scroll up to running or queued task')}>
            <IconButton
              aria-label={t('stage.progress.scrollToRunningUp', 'Scroll up to running or queued task')}
              color="primary"
              onClick={() => handleScrollToDirection('up')}
              sx={{
                position: 'absolute',
                left: '50%',
                top: 0,
                transform: 'translateX(-50%)',
                bgcolor: 'transparent',
                boxShadow: 'none',
                zIndex: 2,
                width: 56,
                height: 56,
                '&:hover': { bgcolor: 'transparent' },
              }}
            >
              <ArrowCircleUpIcon sx={{ fontSize: 48 }} />
            </IconButton>
          </Tooltip>
        ) : null}
        {showDownArrow ? (
          <Tooltip title={t('stage.progress.scrollToRunningDown', 'Scroll down to running or queued task')}>
            <IconButton
              aria-label={t('stage.progress.scrollToRunningDown', 'Scroll down to running or queued task')}
              color="primary"
              onClick={() => handleScrollToDirection('down')}
              sx={{
                position: 'absolute',
                left: '50%',
                bottom: 0,
                transform: 'translateX(-50%)',
                bgcolor: 'transparent',
                boxShadow: 'none',
                zIndex: 2,
                width: 56,
                height: 56,
                '&:hover': { bgcolor: 'transparent' },
              }}
            >
              <ArrowCircleDownIcon sx={{ fontSize: 48 }} />
            </IconButton>
          </Tooltip>
        ) : null}
      </Box>
    )}
  </Stack>
);
