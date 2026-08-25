import { STAGED_FOLDER_ACTION_RUNTIME_NODE_TYPE } from '@hierarchidb/staged-folder-action';
import { useGlobalI18nTranslator } from '@hierarchidb/ui-plugin-shell/ui-i18n';
import type { OpenMaintenanceContext } from '@hierarchidb/ui-plugin-shell/ui-usermenu';
import { UserLoginButton } from '@hierarchidb/ui-plugin-shell/ui-usermenu';
import DeleteIcon from '@mui/icons-material/Delete';
import ReplayIcon from '@mui/icons-material/Replay';
import {
  AppBar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material';
import AppLogoIcon from '~/components/AppLogoIcon';
import {
  BuildSessionQueuePanel,
  BuildSessionQueuePanelBadgeButton,
} from '~/components/BuildSessionQueuePanel';
import type { LoadPageNodeReturn } from '~/router/loaders/treeLoaders';
import { useTreeConsoleAppBar } from './hooks/useTreeConsoleAppBar';

type TreeConsoleAppBarProps = {
  data: LoadPageNodeReturn;
  pageName: string;
  isUserMenuReady: boolean;
  onGoHome: () => void;
  onOpenMaintenance: (context: OpenMaintenanceContext) => void;
};

export function TreeConsoleAppBar({
  data,
  pageName,
  isUserMenuReady,
  onGoHome,
  onOpenMaintenance,
}: TreeConsoleAppBarProps) {
  const { t } = useGlobalI18nTranslator();
  const {
    resumeSessionNodeType,
    resumeDialogRows,
    resumeDialogSessionCount,
    canResumeDialogQueue,
    isResumeDialogOpen,
    isQueueAutoStartEnabled,
    isDeletingQueue,
    isResumingQueue,
    handleNavigateToBuild,
    handleNavigateToBuildJobEntry,
    handleResumeDialogEntriesChange,
    handleStagedFolderActionDialogEntriesChange,
    handleResumeQueue,
    handleDeleteQueue,
    handleSkipResumeDialog,
  } = useTreeConsoleAppBar({ data });

  return (
    <AppBar position="static" color="default" elevation={1}>
      <Toolbar>
        <IconButton
          onClick={onGoHome}
          edge="start"
          color="primary"
          aria-label={t(
            'treeConsole.toolbar.resumeQueueDialog.ariaLabelHome',
            'Go to HierarchiDB home'
          )}
          sx={{ marginLeft: '-20px' }}
        >
          <AppLogoIcon size={28} />
        </IconButton>

        <Typography variant="h6" component="div" sx={{ flexGrow: 0, mr: 3 }}>
          {pageName}
        </Typography>

        <Box sx={{ flexGrow: 1 }} />

        <Stack direction="row" spacing={2} alignItems="center">
          {data.tree?.id ? (
            <>
              <BuildSessionQueuePanelBadgeButton
                treeId={data.tree.id}
                nodeType={resumeSessionNodeType}
                onNavigateToBuild={handleNavigateToBuild}
                onNavigateToBuildJobEntry={handleNavigateToBuildJobEntry}
                autoStartTopSession={isQueueAutoStartEnabled}
                onEntriesChange={handleResumeDialogEntriesChange}
              />
              <BuildSessionQueuePanelBadgeButton
                treeId={data.tree.id}
                nodeType={STAGED_FOLDER_ACTION_RUNTIME_NODE_TYPE}
                autoStartTopSession={false}
                includeBuildJobQueues={false}
              />
            </>
          ) : null}
          {isUserMenuReady ? <UserLoginButton onOpenMaintenance={onOpenMaintenance} /> : null}
        </Stack>
      </Toolbar>
      <Dialog open={isResumeDialogOpen} onClose={handleSkipResumeDialog} fullWidth maxWidth="md">
        <DialogTitle>
          {t('treeConsole.toolbar.resumeQueueDialog.title', 'Build sessions: {{count}} sessions', {
            count: resumeDialogSessionCount,
          })}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <BuildSessionQueuePanel
              treeId={data.tree?.id}
              nodeType={resumeSessionNodeType}
              onNavigateToBuild={handleNavigateToBuild}
              onNavigateToBuildJobEntry={handleNavigateToBuildJobEntry}
              onEntriesChange={handleResumeDialogEntriesChange}
              autoStartTopSession={isQueueAutoStartEnabled}
              compact={false}
            />
            <BuildSessionQueuePanel
              treeId={data.tree?.id}
              nodeType={STAGED_FOLDER_ACTION_RUNTIME_NODE_TYPE}
              autoStartTopSession={false}
              onEntriesChange={handleStagedFolderActionDialogEntriesChange}
              includeBuildJobQueues={false}
              compact={false}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button
            onClick={handleDeleteQueue}
            color="error"
            startIcon={<DeleteIcon />}
            disabled={resumeDialogSessionCount === 0 || isDeletingQueue || isResumingQueue}
          >
            {t('treeConsole.toolbar.resumeQueueDialog.deleteQueue', 'Delete all sessions')}
          </Button>
          <Button
            onClick={handleResumeQueue}
            variant="contained"
            startIcon={<ReplayIcon />}
            disabled={!canResumeDialogQueue || isDeletingQueue || isResumingQueue}
          >
            {t(
              'treeConsole.toolbar.resumeQueueDialog.resumeQueue',
              'Resume execution of the first session'
            )}
          </Button>
          <Button onClick={handleSkipResumeDialog}>
            {t('treeConsole.toolbar.resumeQueueDialog.close', '× Close')}
          </Button>
        </DialogActions>
      </Dialog>
    </AppBar>
  );
}
