import type { OpenMaintenanceContext } from '@hierarchidb/ui-plugin-shell/ui-usermenu';
import { AppBar, Box, IconButton, Stack, Toolbar, Typography } from '@mui/material';
import AppLogoIcon from '~/components/AppLogoIcon';
import { BuildSessionLauncherButtons } from '~/components/BuildSessionLauncherButtons';
import { UserLoginButton } from '@hierarchidb/ui-plugin-shell/ui-usermenu';
import type { LoadPageNodeReturn } from '~/router/loaders/treeLoaders';

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
  return (
    <AppBar position="static" color="default" elevation={1}>
      <Toolbar>
        <IconButton
          onClick={onGoHome}
          edge="start"
          color="primary"
          aria-label="Go to HierarchiDB home"
          sx={{ marginLeft: '-20px' }}
        >
          <AppLogoIcon size={28} />
        </IconButton>

        <Typography variant="h6" component="div" sx={{ flexGrow: 0, mr: 3 }}>
          {pageName}
        </Typography>

        <Box sx={{ flexGrow: 1 }} />

        <Stack direction="row" spacing={1} alignItems="center">
          {data.tree?.id ? <BuildSessionLauncherButtons treeId={data.tree.id} pageNodeId={data.pageNodeId} /> : null}
          {isUserMenuReady ? (
            <Box sx={{ ml: '8px' }}>
              <UserLoginButton onOpenMaintenance={onOpenMaintenance} />
            </Box>
          ) : null}
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
