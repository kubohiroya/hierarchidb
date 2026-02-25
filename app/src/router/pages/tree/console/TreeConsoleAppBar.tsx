import { AppBar, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, Toolbar, Typography } from '@mui/material';
import AppLogoIcon from '~/components/AppLogoIcon';
import DeleteIcon from '@mui/icons-material/Delete';
import ReplayIcon from '@mui/icons-material/Replay';
import {
  BuildSessionQueuePanelBadgeButton,
  BuildSessionQueuePanel,
} from '~/components/BuildSessionQueuePanel';
import { UserLoginButton } from '@hierarchidb/ui-plugin-shell/ui-usermenu';
import type { OpenMaintenanceContext } from '@hierarchidb/ui-plugin-shell/ui-usermenu';
import type { LoadPageNodeReturn } from '~/router/loaders/treeLoaders';
import { useGlobalI18nTranslator } from '@hierarchidb/ui-plugin-shell/ui-i18n';
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
    isResumeDialogOpen,
    isQueueAutoStartEnabled,
    isDeletingQueue,
    isResumingQueue,
    handleNavigateToBuild,
    handleResumeDialogEntriesChange,
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
          aria-label={t('treeConsole.toolbar.resumeQueueDialog.ariaLabelHome', 'Go to HierarchiDB home')}
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
          <BuildSessionQueuePanelBadgeButton
            nodeType={resumeSessionNodeType}
            onNavigateToBuild={handleNavigateToBuild}
            autoStartTopSession={isQueueAutoStartEnabled}
            onEntriesChange={handleResumeDialogEntriesChange}
          />
          ) : null}
          {isUserMenuReady ? (
            <UserLoginButton onOpenMaintenance={onOpenMaintenance} />
          ) : null}
        </Stack>
      </Toolbar>
      <Dialog
        open={isResumeDialogOpen}
        onClose={handleSkipResumeDialog}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          {t('treeConsole.toolbar.resumeQueueDialog.title', 'Build sessions: {{count}} sessions', { count: resumeDialogRows.length })}
        </DialogTitle>
        <DialogContent dividers>
          <BuildSessionQueuePanel
            nodeType={resumeSessionNodeType}
            onNavigateToBuild={handleNavigateToBuild}
            onEntriesChange={handleResumeDialogEntriesChange}
            autoStartTopSession={isQueueAutoStartEnabled}
            compact={false}
          />
        </DialogContent>
        <DialogActions sx={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button
            onClick={handleDeleteQueue}
            color="error"
            startIcon={<DeleteIcon />}
            disabled={resumeDialogRows.length === 0 || isDeletingQueue || isResumingQueue}
          >
            {t('treeConsole.toolbar.resumeQueueDialog.deleteQueue', 'Delete all sessions')}
          </Button>
          <Button
            onClick={handleResumeQueue}
            variant="contained"
            startIcon={<ReplayIcon />}
            disabled={resumeDialogRows.length === 0 || isDeletingQueue || isResumingQueue}
          >
            {t('treeConsole.toolbar.resumeQueueDialog.resumeQueue', 'Resume execution of the first session')}
          </Button>
        </DialogActions>
      </Dialog>
    </AppBar>
  );
}
