import { Button, Card, CardContent, Divider, LinearProgress, ListItemIcon, ListItemText, Menu, MenuItem, Stack, Tooltip, Typography } from '@mui/material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import type { BuildSessionSnapshot } from '~/hooks/useBuildSessionSnapshots';
import type { NodeId, NodeType, TreeId } from '@hierarchidb/core-types';
import { useGlobalI18nTranslator } from '@hierarchidb/ui-i18n';
import { useIconRegistry } from '@hierarchidb/components';
import { Box } from '@mui/material';
import { useOptionalBuildSessionRuntimeContext } from '~/contexts/TreeBuildSessionContexts';
import { useBuildSessionSnapshots } from '~/hooks/useBuildSessionSnapshots';
import {
  type BuildSessionLauncherEntry,
  useBuildSessionLauncherPanel,
} from './useBuildSessionLauncherPanel';

export type { BuildSessionLauncherEntry };

type BuildSessionLauncherPanelProps = {
  treeId?: TreeId;
  pageNodeId?: NodeId;
  nodeType: NodeType;
  excludeNodeId?: NodeId;
  onNavigateToBuild?: (entry: BuildSessionLauncherEntry, options?: { openInNewTab?: boolean }) => void;
};

type BuildSessionLauncherPanelInnerProps = Omit<BuildSessionLauncherPanelProps, 'nodeType'> & {
  sessions: readonly BuildSessionSnapshot[];
};

export function BuildSessionLauncherPanel({
  nodeType,
  treeId,
  pageNodeId,
  excludeNodeId,
  onNavigateToBuild,
}: BuildSessionLauncherPanelProps) {
  const runtimeContext = useOptionalBuildSessionRuntimeContext();
  if (runtimeContext && runtimeContext.nodeType === nodeType) {
    return (
      <BuildSessionLauncherPanelInner
        treeId={treeId}
        pageNodeId={pageNodeId}
        excludeNodeId={excludeNodeId}
        onNavigateToBuild={onNavigateToBuild}
        sessions={runtimeContext.sessions}
      />
    );
  }
  return (
    <BuildSessionLauncherPanelWithSubscription
      nodeType={nodeType}
      treeId={treeId}
      pageNodeId={pageNodeId}
      excludeNodeId={excludeNodeId}
      onNavigateToBuild={onNavigateToBuild}
    />
  );
}

function BuildSessionLauncherPanelWithSubscription({
  nodeType,
  treeId,
  pageNodeId,
  excludeNodeId,
  onNavigateToBuild,
}: BuildSessionLauncherPanelProps) {
  const { sessions } = useBuildSessionSnapshots(nodeType);
  return (
    <BuildSessionLauncherPanelInner
      treeId={treeId}
      pageNodeId={pageNodeId}
      excludeNodeId={excludeNodeId}
      onNavigateToBuild={onNavigateToBuild}
      sessions={sessions}
    />
  );
}

function BuildSessionLauncherPanelInner({
  onNavigateToBuild,
  excludeNodeId,
  sessions,
}: BuildSessionLauncherPanelInnerProps) {
  const { t } = useGlobalI18nTranslator();
  const { resolveIcon } = useIconRegistry();
  const { filteredEntries, menuAnchorEl, menuEntry, handleOpenMenu, handleCloseMenu } =
    useBuildSessionLauncherPanel({
      sessions,
      excludeNodeId,
      t,
    });

  if (filteredEntries.length === 0) return null;
  return (
    <Card
      variant="outlined"
      sx={{
        px: 1,
        py: 0.5,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        {filteredEntries.map((entry) => {
          const nodeName = entry.node?.metadata?.name ?? String(entry.session.nodeId);
          const nodeTypeResolved = entry.node?.nodeType ?? 'folder';
          const nodePath = entry.nodePath || nodeName;
          const icon = resolveIcon({ nodeType: nodeTypeResolved });
          const isActive = entry.session.isActive;
          const variant = isActive ? 'outlined' : 'text';
          const color = isActive ? 'primary' : 'inherit';
          const countsText = t(
            'stage.progress.countsWithUnit',
            '{{percentage}}% ・ {{completed}}/{{total}} {{unit}} completed ・ failed {{failed}} ・ skipped {{skipped}}',
          );
          return (
            <Tooltip
              key={String(entry.session.nodeId)}
              arrow
              placement="bottom-end"
              title={
                <Box sx={{ minWidth: 320, maxWidth: 420 }}>
                  <Stack spacing={1}>
                    <Stack spacing={0.5}>
                      <Typography variant="caption" color="text.secondary">
                        {t('stage.progress.nodePath', 'Path')}
                      </Typography>
                      <Typography variant="body2">{nodePath}</Typography>
                    </Stack>
                    <Divider />
                    <Card variant="outlined">
                      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                          <Stack spacing={0.25} flex={1}>
                            <Typography variant="caption" color="text.secondary">
                              {t('stage.progress.stage', 'Stage')}
                            </Typography>
                            <Typography variant="body2">{entry.stageLabel}</Typography>
                          </Stack>
                          <Stack spacing={0.25} flex={1}>
                            <Typography variant="caption" color="text.secondary">
                              {entry.taskUnitLabel || t('stage.progress.task', 'Tasks')}
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{
                                overflow: 'hidden',
                                display: '-webkit-box',
                                WebkitBoxOrient: 'vertical',
                                WebkitLineClamp: 2,
                                lineHeight: 1.4,
                                minHeight: '2.8em',
                                maxHeight: '2.8em',
                              }}
                            >
                              {entry.taskLabel}
                            </Typography>
                          </Stack>
                        </Stack>
                        <Stack gap={1}>
                          <LinearProgress variant="determinate" value={entry.percentage} />
                          <Typography variant="caption" color="text.secondary">
                            {countsText
                              .replace('{{percentage}}', String(Math.round(entry.percentage)))
                              .replace('{{completed}}', String(entry.counts.completed))
                              .replace('{{total}}', String(entry.counts.total))
                              .replace('{{unit}}', entry.taskUnitLabel || t('stage.progress.task', 'Tasks'))
                              .replace('{{failed}}', String(entry.counts.failed))
                              .replace('{{skipped}}', String(entry.counts.skipped))}
                          </Typography>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Stack>
                </Box>
              }
            >
              <Button
                size="small"
                variant={variant}
                color={color}
                startIcon={icon}
                onClick={(event) => handleOpenMenu(event, entry)}
              >
                {nodeName}
              </Button>
            </Tooltip>
          );
        })}
      </Stack>
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl && menuEntry)}
        onClose={handleCloseMenu}
      >
        <MenuItem
          disabled={!menuEntry || !onNavigateToBuild}
          onClick={() => {
            if (!menuEntry || !onNavigateToBuild) return;
            onNavigateToBuild(menuEntry);
            handleCloseMenu();
          }}
        >
          <ListItemIcon>
            <FolderOpenIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t('stage.progress.menu.open', 'Open')} />
        </MenuItem>
      </Menu>
    </Card>
  );
}
