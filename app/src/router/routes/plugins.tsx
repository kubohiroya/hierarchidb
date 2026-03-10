// import { WorkerAPIClient } from '../WorkerAPIClient.ts';
// import type { Remote } from 'comlink';
// import type { WorkerAPI } from '@hierarchidb/_obsolate_common-api';
import { useIconRegistry } from '@hierarchidb/components';
// UIPluginRegistry is legacy; this page now reads vite-generated metadata
// import { getUIPluginRegistry } from '@hierarchidb/ui-plugin-shell/ui-core';
import { AutoHideFullScreenDialog as FullScreenDialog } from '@hierarchidb/ui-plugin-shell/ui-dialog';
import { loadAppConfig } from '~/loadAppConfig';
import { formatAppTitle, useAppDocumentTitle } from '~/router/title/pageTitle';
import {
  AccountTree as AccountTreeIcon,
  CheckCircle as CheckCircleIcon,
  Delete as DeleteIcon,
  Extension as ExtensionIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  Link as LinkIcon,
  MoreVert as MoreVertIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { useNavigate } from '@tanstack/react-router';
import type React from 'react';
import { useId, useState } from 'react';
import { useTranslation } from '@hierarchidb/ui-i18n';
import { usePluginsPageState } from './usePluginsPageState.js';
import type { DisplayPlugin } from './pluginsTypes.js';

// Meta function for React Router v7
export function meta() {
  const { appName } = loadAppConfig();
  return [
    { title: formatAppTitle('plugin-loaders', appName) },
    { name: 'description', content: 'View and manage all registered plugin-loaders' },
  ];
}

interface EnhancedPluginRowProps {
  plugin: DisplayPlugin;
  index: number;
  dependencies: string[];
  onDelete: (pluginName: string) => void;
  onReset: (pluginName: string) => void;
  disabled?: boolean;
}

interface DeletePluginDialogProps {
  open: boolean;
  pluginName: string;
  affectedPlugins: string[];
  onConfirm: (clearDatabase: boolean) => void;
  onCancel: () => void;
  loading?: boolean;
}

interface ResetPluginDialogProps {
  open: boolean;
  pluginName: string;
  affectedPlugins: string[];
  isProduction: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

// Enhanced Plugin Row with Dependencies and Operations
function EnhancedPluginRow({
  plugin,
  index,
  dependencies,
  onDelete,
  onReset,
  disabled = false,
}: EnhancedPluginRowProps) {
  const [open, setOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);
  const { t } = useTranslation('common');
  const pluginMenuButtonId = useId();
  const pluginMenuId = useId();

  const isFolderPlugin = plugin.nodeType === 'folder';
  const canDelete = !isFolderPlugin;
  const { resolveIcon } = useIconRegistry();
  const iconNode = resolveIcon({
    nodeType: plugin.nodeType,
    icon: {
      muiIconName: plugin.icon.muiIconName,
      emoji: plugin.icon.emoji,
      color: plugin.iconColor,
    },
  });
  const description = t(`plugins.${plugin.nodeType}.description`, {
    defaultValue: plugin.description || plugin.displayName,
  });

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleReset = () => {
    onReset(plugin.nodeType);
    handleMenuClose();
  };

  const handleDelete = () => {
    if (!canDelete) return;
    onDelete(plugin.nodeType);
    handleMenuClose();
  };

  return (
    <>
      <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell>
          <IconButton aria-label="expand row" size="small" onClick={() => setOpen((v) => !v)}>
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell component="th" scope="row">
          {index + 1}
        </TableCell>
        <TableCell>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
              {iconNode ?? <ExtensionIcon fontSize="small" color="primary" />}
            </Box>
            <Typography variant="body1" fontWeight="medium">
              {plugin.nodeType}
            </Typography>
          </Stack>
        </TableCell>
        <TableCell>
          <Tooltip title={description} placement="top-start">
            <Typography variant="body2" sx={{ cursor: 'default' }}>
              {plugin.displayName}
            </Typography>
          </Tooltip>
        </TableCell>
        <TableCell>
          {dependencies.length > 0 ? (
            <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap">
              <LinkIcon fontSize="small" color="action" />
              {dependencies.map((dep) => (
                <Chip
                  key={dep}
                  label={dep}
                  size="small"
                  variant="outlined"
                  icon={<AccountTreeIcon />}
                  sx={{ m: 0.25 }}
                />
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {t('plugins.noDependencies', 'No dependencies')}
            </Typography>
          )}
        </TableCell>
        <TableCell>
          <Stack direction="row" spacing={1}>
            {plugin.hasUI && <Chip label="UI" size="small" color="primary" variant="outlined" />}
            {plugin.hasWorker && (
              <Chip label="Worker" size="small" color="success" variant="outlined" />
            )}
          </Stack>
        </TableCell>
        <TableCell align="center">{plugin.createOrder || 'N/A'}</TableCell>
        <TableCell>
          <IconButton
            id={pluginMenuButtonId}
            aria-label="more"
            aria-controls={menuOpen ? pluginMenuId : undefined}
            aria-haspopup="true"
            aria-expanded={menuOpen ? 'true' : undefined}
            onClick={handleMenuClick}
            disabled={disabled}
          >
            <MoreVertIcon />
          </IconButton>
          <Menu
            id={pluginMenuId}
            anchorEl={anchorEl}
            open={menuOpen}
            onClose={handleMenuClose}
            MenuListProps={{
              'aria-labelledby': pluginMenuButtonId,
            }}
          >
            <MenuItem onClick={handleReset}>
              <RefreshIcon fontSize="small" sx={{ mr: 1 }} />
              {t('plugins.actions.reset', 'Reset Plugin')}
            </MenuItem>
            <Divider />
            {canDelete ? (
              <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
                <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
                {t('plugins.actions.delete', 'Delete Plugin')}
              </MenuItem>
            ) : (
              <MenuItem disabled sx={{ color: 'text.disabled' }}>
                <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
                {t('plugins.actions.deleteDisabled', 'Delete (Disabled for Core Plugin)')}
              </MenuItem>
            )}
          </Menu>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={8}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 2 }}>
              <Typography variant="h6" gutterBottom component="div">
                {t('plugins.details', 'Plugin Details')}
              </Typography>

              <Stack spacing={2}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    {t('plugins.fields.package', 'Package')}
                  </Typography>
                  <Typography variant="body2">
                    {plugin.packageName} ({plugin.version ?? 'workspace'})
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    {t('plugins.fields.description', 'Description')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {description}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    {t('plugins.fields.dependencies', 'Dependencies')}
                  </Typography>
                  {dependencies.length > 0 ? (
                    <Box sx={{ mt: 1, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                      <Typography variant="body2" component="div">
                        {plugin.nodeType} → {dependencies.join(', ')}
                      </Typography>
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      {t('plugins.noDependencies', 'No dependencies')}
                    </Typography>
                  )}
                </Box>

                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    {t('plugins.fields.menuGroup', 'Menu Group')}
                  </Typography>
                  <Typography variant="body2">{plugin.menuGroup}</Typography>
                </Box>

                {isFolderPlugin && (
                  <Box>
                    <Alert severity="info" icon={<AccountTreeIcon />}>
                      <Typography variant="body2">
                        <strong>{t('plugins.corePlugin', 'Core Plugin')}:</strong>{' '}
                        {t(
                          'plugins.corePluginMessage',
                          'This plugin cannot be deleted as it provides the foundation for all other plugins.'
                        )}
                      </Typography>
                    </Alert>
                  </Box>
                )}
              </Stack>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

// Reset Plugin Confirmation Dialog
function ResetPluginDialog({
  open,
  pluginName,
  affectedPlugins,
  isProduction,
  onConfirm,
  onCancel,
  loading = false,
}: ResetPluginDialogProps) {
  const isFolderPlugin = pluginName === 'folder';
  const titleId = useId();
  const descriptionId = useId();

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle id={titleId}>
        <Stack direction="row" spacing={1} alignItems="center">
          <RefreshIcon color={isProduction && isFolderPlugin ? 'error' : 'warning'} />
          <Typography>
            Reset Plugin: {pluginName}
            {isFolderPlugin && ' (Complete System Reset)'}
          </Typography>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <DialogContentText id={descriptionId}>
            {isFolderPlugin
              ? 'This will reset the entire system, clearing ALL data including TreeNodes, all plugin entities, and recreating initial trees and root nodes.'
              : 'This will clear GroupEntity and RelationalEntity data for this plugin type. TreeNodes and TreeNode data/draftData will be preserved.'}
          </DialogContentText>

          {affectedPlugins.length > 1 && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                The following plugins will be reset:
              </Typography>
              <List dense>
                {affectedPlugins.map((plugin) => (
                  <ListItem key={plugin}>
                    <ListItemText
                      primary={plugin}
                      secondary={
                        plugin === pluginName ? 'Selected plugin' : 'Depends on selected plugin'
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {isProduction && isFolderPlugin && (
            <Alert severity="error" icon={<WarningIcon />}>
              <Typography variant="subtitle2" gutterBottom>
                <strong>DANGER! ALL DATA WILL BE DELETED!</strong>
              </Typography>
              <Typography variant="body2">
                This action will permanently delete ALL data including TreeNodes, all plugin
                entities (TreeNode data/draftData, GroupEntity, RelationalEntity), and cannot be
                undone. The system will be reset to its initial state with new trees and root nodes.
              </Typography>
            </Alert>
          )}

          {!isFolderPlugin && (
            <Alert severity="warning">
              <Typography variant="body2">
                This action will clear <strong>GroupEntity</strong> and{' '}
                <strong>RelationalEntity</strong> data for this plugin type.
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                • TreeNodes will be <strong>preserved</strong>
                <br />• TreeNode data/draftData will be <strong>preserved</strong>
                <br />• Only plugin-specific group and relational data will be deleted
              </Typography>
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          color={isProduction && isFolderPlugin ? 'error' : 'warning'}
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
        >
          {loading ? 'Resetting...' : isFolderPlugin ? 'Reset Entire System' : 'Reset Plugin'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Delete Plugin Confirmation Dialog
function DeletePluginDialog({
  open,
  pluginName,
  affectedPlugins,
  onConfirm,
  onCancel,
  loading = false,
}: DeletePluginDialogProps) {
  const [clearDatabase, setClearDatabase] = useState(true);
  const titleId = useId();
  const descriptionId = useId();

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle id={titleId}>
        <Stack direction="row" spacing={1} alignItems="center">
          <DeleteIcon color="error" />
          <Typography>Delete Plugin: {pluginName}</Typography>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <DialogContentText id={descriptionId}>
            This action will delete the selected plugin and all plugins that depend on it.
          </DialogContentText>

          {affectedPlugins.length > 1 && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                The following plugins will be affected:
              </Typography>
              <List dense>
                {affectedPlugins.map((plugin) => (
                  <ListItem key={plugin}>
                    <ListItemText
                      primary={plugin}
                      secondary={
                        plugin === pluginName ? 'Selected plugin' : 'Depends on selected plugin'
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          <FormControlLabel
            control={
              <Checkbox
                checked={clearDatabase}
                onChange={(e) => setClearDatabase(e.target.checked)}
                disabled={loading}
              />
            }
            label="Clear database tables for affected plugins"
          />

          <Alert severity="warning">
            This action cannot be undone. All data associated with these plugins will be permanently
            deleted.
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={() => onConfirm(clearDatabase)}
          color="error"
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : <DeleteIcon />}
        >
          {loading ? 'Deleting...' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function PluginsPage() {
  useAppDocumentTitle('plugin-loaders');
  const navigate = useNavigate();
  const { t } = useTranslation('common');
  const { resolveIcon } = useIconRegistry();
  const {
    workerPlugins,
    uiPluginsList,
    pluginDependencies,
    loading,
    error,
    deleteDialogOpen,
    resetDialogOpen,
    selectedPlugin,
    affectedPlugins,
    operationInProgress,
    isProduction,
    handleDeletePlugin,
    handleResetPlugin,
    confirmDelete,
    confirmReset,
    closeDeleteDialog,
    closeResetDialog,
  } = usePluginsPageState();

// UI plugin-loaders list now comes from vite metadata (uiPluginsList)

  if (loading) {
    return (
      <FullScreenDialog
        open={true}
        onClose={() => navigate({ to: '/' })}
        title="Plugin Registry"
        subtitle="View and manage all registered plugins"
        icon={<ExtensionIcon />}
      >
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </FullScreenDialog>
    );
  }

  if (error) {
    return (
      <FullScreenDialog
        open={true}
        onClose={() => navigate({ to: '/' })}
        title="Plugin Registry"
        subtitle="View and manage all registered plugins"
        icon={<ExtensionIcon />}
      >
        <Alert severity="error">{error}</Alert>
      </FullScreenDialog>
    );
  }

  return (
    <FullScreenDialog
      open={true}
      onClose={() => navigate({ to: '/' })}
      title="Plugin Registry"
      subtitle="View and manage all registered plugins in the HierarchiDB system"
      icon={<ExtensionIcon />}
    >
      <Stack spacing={4}>
        {/* Summary Cards */}
        <Stack direction="row" spacing={2}>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Worker Plugins
              </Typography>
              <Typography variant="h4">{workerPlugins.length}</Typography>
            </CardContent>
          </Card>

          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                UI Plugins
              </Typography>
              <Typography variant="h4">{uiPluginsList.length}</Typography>
            </CardContent>
          </Card>

          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Dependencies
              </Typography>
              <Typography variant="h4">
                {Object.values(pluginDependencies).flat().length}
              </Typography>
            </CardContent>
          </Card>
        </Stack>

        {/* Enhanced Worker Plugins Table with Dependencies and Operations */}
        <Paper elevation={2}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6">Worker Layer Plugins with Dependencies</Typography>
            <Typography variant="body2" color="text.secondary">
              Plugins registered in the Worker layer with dependency management
            </Typography>
          </Box>

          <TableContainer>
            <Table aria-label="worker plugins table">
              <TableHead>
                <TableRow>
                  <TableCell />
                  <TableCell>#</TableCell>
                  <TableCell>Node Type</TableCell>
                  <TableCell>Display Name</TableCell>
                  <TableCell>Dependencies</TableCell>
                  <TableCell>Features</TableCell>
                  <TableCell align="center">Priority</TableCell>
                  <TableCell>Operations</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {workerPlugins.map((plugin: DisplayPlugin, index: number) => (
                  <EnhancedPluginRow
                    key={plugin.nodeType}
                    plugin={plugin}
                    index={index}
                    dependencies={pluginDependencies[plugin.nodeType] || []}
                    onDelete={handleDeletePlugin}
                    onReset={handleResetPlugin}
                    disabled={operationInProgress}
                  />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Reset Confirmation Dialog */}
        <ResetPluginDialog
          open={resetDialogOpen}
          pluginName={selectedPlugin || ''}
          affectedPlugins={affectedPlugins}
          isProduction={isProduction}
          onConfirm={confirmReset}
          onCancel={closeResetDialog}
          loading={operationInProgress}
        />

        {/* Delete Confirmation Dialog */}
        <DeletePluginDialog
          open={deleteDialogOpen}
          pluginName={selectedPlugin || ''}
          affectedPlugins={affectedPlugins}
          onConfirm={confirmDelete}
          onCancel={closeDeleteDialog}
          loading={operationInProgress}
        />

        {/* UI Plugins Table */}
        <Paper elevation={2}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6">UI Layer Plugins</Typography>
            <Typography variant="body2" color="text.secondary">
              Plugins registered in the UI layer for user interface components
            </Typography>
          </Box>

          <TableContainer>
            <Table aria-label="ui plugins table">
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>Node Type</TableCell>
                  <TableCell>Capabilities</TableCell>
                  <TableCell>Create Order</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {uiPluginsList.map((plugin: DisplayPlugin, index: number) => (
                  <TableRow key={plugin.nodeType}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
                          {resolveIcon({
                            nodeType: plugin.nodeType,
                            icon: {
                              muiIconName: plugin.icon.muiIconName,
                              emoji: plugin.icon.emoji,
                              color: plugin.iconColor,
                            },
                          }) ?? <ExtensionIcon fontSize="small" color="primary" />}
                        </Box>
                        <Typography variant="body1" fontWeight="medium">
                          {plugin.nodeType}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        {plugin.hasUI && <Chip label="UI" size="small" variant="outlined" />}
                        {plugin.hasWorker && (
                          <Chip label="Worker" size="small" variant="outlined" />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell align="center">{plugin.createOrder || 'N/A'}</TableCell>
                    <TableCell>
                      <Tooltip
                        title={t(`plugins.${plugin.nodeType}.description`, {
                          defaultValue: plugin.description || plugin.displayName,
                        })}
                      >
                        <CheckCircleIcon color="success" fontSize="small" />
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Stack>
    </FullScreenDialog>
  );
}
