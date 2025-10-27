import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
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
// import { WorkerAPIClient } from '../WorkerAPIClient.ts';
// import type { Remote } from 'comlink';
// import type { WorkerAPI } from '@hierarchidb/common-api';
import type { NodeType } from '@hierarchidb/common-types';
// UIPluginRegistry is legacy; this page now reads vite-generated metadata
// import { getUIPluginRegistry } from '@hierarchidb/ui-core';
import { AutoHideFullScreenDialog as FullScreenDialog } from '@hierarchidb/ui-dialog';
import { useNavigate } from '@tanstack/react-router';
import { getInstalledPlugins } from '~/services/plugin-registry.js';
import { getMuiIconWithColor as getMuiIconComponent } from '@hierarchidb/ui-icon';
import { useTranslation } from 'react-i18next';

// Meta function for React Router v7
export function meta() {
  return [
    { title: 'Plugin Registry - HierarchiDB' },
    { name: 'description', content: 'View and manage all registered plugin-loader' },
  ];
}

interface EnhancedPluginRowProps {
  plugin: DisplayPlugin;
  index: number;
  dependencies: string[];
  onDelete: (pluginName: string) => void;
  onReload: (pluginName: string, clearDatabase: boolean) => void;
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
type DisplayPlugin = {
  nodeType: NodeType;
  displayName: string;
  description: string;
  dependencies: string[];
  menuGroup: string;
  createOrder: number;
  icon: { muiIconName?: string; emoji?: string; color?: string };
  iconColor?: string;
  backgroundColor: string;
  hasUI: boolean;
  hasWorker: boolean;
  hasCommon: boolean;
  packageName: string;
  version: string | null;
};

function EnhancedPluginRow({
  plugin,
  index,
  dependencies,
  onDelete,
  onReload,
  disabled = false,
}: EnhancedPluginRowProps) {
  const [open, setOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);
  const { t } = useTranslation('common');

  const isFolderPlugin = plugin.nodeType === 'folder';
  const canDelete = !isFolderPlugin;
  const iconNode = getMuiIconComponent(
    plugin.icon.muiIconName,
    plugin.icon.emoji,
    plugin.iconColor,
  );
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
    onReload(plugin.nodeType, true);
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
            aria-label="more"
            aria-controls={menuOpen ? 'plugin-menu' : undefined}
            aria-haspopup="true"
            aria-expanded={menuOpen ? 'true' : undefined}
            onClick={handleMenuClick}
            disabled={disabled}
          >
            <MoreVertIcon />
          </IconButton>
          <Menu
            id="plugin-menu"
            anchorEl={anchorEl}
            open={menuOpen}
            onClose={handleMenuClose}
            MenuListProps={{
              'aria-labelledby': 'plugin-menu-button',
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
                        <strong>{t('plugins.corePlugin', 'Core Plugin')}:</strong> {t(
                          'plugins.corePluginMessage',
                          'This plugin cannot be deleted as it provides the foundation for all other plugins.',
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

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      aria-labelledby="reset-dialog-title"
      aria-describedby="reset-dialog-description"
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle id="reset-dialog-title">
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
          <DialogContentText id="reset-dialog-description">
            {isFolderPlugin
              ? 'This will reset the entire system, clearing ALL data including TreeNodes, all plugin entities, and recreating initial trees and root nodes.'
              : 'This will clear GroupEntity and RelationalEntity data for this plugin type. TreeNodes and PeerEntity data will be preserved.'}
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
                entities (PeerEntity, GroupEntity, RelationalEntity), and cannot be undone. The
                system will be reset to its initial state with new trees and root nodes.
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
                <br />• PeerEntity data will be <strong>preserved</strong>
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

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      aria-labelledby="delete-dialog-title"
      aria-describedby="delete-dialog-description"
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle id="delete-dialog-title">
        <Stack direction="row" spacing={1} alignItems="center">
          <DeleteIcon color="error" />
          <Typography>Delete Plugin: {pluginName}</Typography>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <DialogContentText id="delete-dialog-description">
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
  const navigate = useNavigate();
  const { t } = useTranslation('common');
  const [workerPlugins, setWorkerPlugins] = useState<DisplayPlugin[]>([]);
  const [uiPluginsList, setUiPluginsList] = useState<DisplayPlugin[]>([]);
  const [pluginDependencies, setPluginDependencies] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null);
  const [affectedPlugins, setAffectedPlugins] = useState<string[]>([]);
  const [operationInProgress, setOperationInProgress] = useState(false);

  // Check if running in production mode
  const isProduction = import.meta.env.MODE === 'production';

  // Calculate affected plugin-loader (children) when operating on a parent
  const calculateAffectedPlugins = (pluginName: string): string[] => {
    const affected = new Set<string>([pluginName]);
    const queue = [pluginName];

    while (queue.length > 0) {
      const current = queue.shift()!;

      // Find all plugin-loader that depend on the current one
      for (const [plugin, deps] of Object.entries(pluginDependencies)) {
        if (deps.includes(current) && !affected.has(plugin)) {
          affected.add(plugin);
          queue.push(plugin);
        }
      }
    }

    return Array.from(affected);
  };

  // Handle delete plugin operation
  const handleDeletePlugin = (pluginName: string) => {
    setSelectedPlugin(pluginName);
    const affected = calculateAffectedPlugins(pluginName);
    setAffectedPlugins(affected);
    setDeleteDialogOpen(true);
  };

  // Confirm delete operation
  const confirmDelete = async (clearDatabase: boolean) => {
    if (!selectedPlugin) return;

    setOperationInProgress(true);
    try {
      // const client: Remote<WorkerAPI> = await WorkerAPIClient.getSingleton();

      // Delete plugin and its descendants
      for (const plugin of affectedPlugins) {
        console.log(`Deleting plugin: ${plugin}, clearDatabase: ${clearDatabase}`);
        // TODO: Implement actual deletion logic with Worker API
        // await client.deletePlugin(plugin, { clearDatabase });
      }

      // Reload plugin-loader
      await loadPlugins();
    } catch (err) {
      console.error('Failed to delete plugin:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete plugin');
    } finally {
      setOperationInProgress(false);
      setDeleteDialogOpen(false);
      setSelectedPlugin(null);
      setAffectedPlugins([]);
    }
  };

  // Handle reset plugin operation
  const handleResetPlugin = (pluginName: string) => {
    setSelectedPlugin(pluginName);
    const affected = calculateAffectedPlugins(pluginName);
    setAffectedPlugins(affected);
    setResetDialogOpen(true);
  };

  // Confirm reset operation
  const confirmReset = async () => {
    if (!selectedPlugin) return;

    setOperationInProgress(true);
    try {
      // const client: Remote<WorkerAPI> = await WorkerAPIClient.getSingleton();
      const affected = affectedPlugins;

      // Reset plugin and its descendants
      if (selectedPlugin === 'folder') {
        // Special case: Complete system reset
        console.warn('⚠️ Performing complete system reset');
        // TODO: Implement complete system reset
        // This would:
        // 1. Clear ALL TreeNodes
        // 2. Clear ALL PeerEntity data
        // 3. Clear ALL GroupEntity data
        // 4. Clear ALL RelationalEntity data
        // 5. Recreate initial trees and root nodes
        // await client.resetSystem();
        console.log('System reset: Clearing ALL data and recreating initial state');
      } else {
        // Reset specific plugin and dependents
        // This only clears GroupEntity and RelationalEntity data
        // TreeNodes and PeerEntity data are preserved
        for (const plugin of affected) {
          console.log(`Resetting plugin: ${plugin} (GroupEntity and RelationalEntity only)`);
          // TODO: Implement actual reset logic with Worker API
          // This would:
          // 1. Clear GroupEntity data for this plugin type
          // 2. Clear RelationalEntity data for this plugin type
          // 3. TreeNodes remain intact
          // 4. PeerEntity data remains intact
          // await client.resetPluginEntities(plugin, { preserveTreeNodes: true, preservePeerEntities: true });
        }
      }

      // Reload plugin-loader
      await loadPlugins();
    } catch (err) {
      console.error('Failed to reset plugin:', err);
      setError(err instanceof Error ? err.message : 'Failed to reset plugin');
    } finally {
      setOperationInProgress(false);
      setResetDialogOpen(false);
      setSelectedPlugin(null);
      setAffectedPlugins([]);
    }
  };

  // Handle reload plugin operation (deprecated - replaced by reset)
  /*
  const handleReloadPlugin = async (pluginName: string, clearDatabase: boolean) => {
    // This is now handled by handleResetPlugin
    if (clearDatabase) {
      handleResetPlugin(pluginName);
    }
  };
   */
  const loadPlugins = useCallback(() => {
    try {
      setLoading(true);
      const installed = getInstalledPlugins();
      const display: DisplayPlugin[] = installed.map((plugin) => ({
        nodeType: plugin.nodeType as NodeType,
        displayName: plugin.label,
        description: plugin.description,
        dependencies: plugin.dependencies,
        menuGroup: plugin.menuGroup,
        createOrder: plugin.createOrder,
        icon: plugin.icon,
        iconColor: plugin.iconColor,
        backgroundColor: plugin.backgroundColor,
        hasUI: plugin.hasUI,
        hasWorker: plugin.hasWorker,
        hasCommon: plugin.hasCommon,
        packageName: plugin.packageName,
        version: plugin.version,
      }));

      const dependencyMap: Record<string, string[]> = {};
      for (const plugin of display) {
        dependencyMap[plugin.nodeType] = plugin.dependencies;
      }

      setWorkerPlugins(display);
      setUiPluginsList(display);
      setPluginDependencies(dependencyMap);
      setError(null);
    } catch (err) {
      console.error('Failed to load plugins:', err);
      setError(err instanceof Error ? err.message : 'Failed to load plugin metadata');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlugins();
  }, [loadPlugins]);

  // UI plugin-loader list now comes from vite metadata (uiPluginsList)

  if (loading) {
    return (
      <FullScreenDialog
        open={true}
        onClose={() => navigate({to:'/'})}
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
        onClose={() => navigate({to:'/'})}
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
      onClose={() => navigate({to:'/'})}
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
                    onReload={handleResetPlugin}
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
          onCancel={() => {
            setResetDialogOpen(false);
            setSelectedPlugin(null);
            setAffectedPlugins([]);
          }}
          loading={operationInProgress}
        />

        {/* Delete Confirmation Dialog */}
        <DeletePluginDialog
          open={deleteDialogOpen}
          pluginName={selectedPlugin || ''}
          affectedPlugins={affectedPlugins}
          onConfirm={confirmDelete}
          onCancel={() => {
            setDeleteDialogOpen(false);
            setSelectedPlugin(null);
            setAffectedPlugins([]);
          }}
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
                          {getMuiIconComponent(plugin.icon.muiIconName, plugin.icon.emoji, plugin.iconColor) ?? (
                            <ExtensionIcon fontSize="small" color="primary" />
                          )}
                        </Box>
                        <Typography variant="body1" fontWeight="medium">
                          {plugin.nodeType}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        {plugin.hasUI && <Chip label="UI" size="small" variant="outlined" />}
                        {plugin.hasWorker && <Chip label="Worker" size="small" variant="outlined" />}
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
