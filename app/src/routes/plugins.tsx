import React, { useEffect, useState } from 'react';
import {
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Box,
  CircularProgress,
  Alert,
  IconButton,
  Collapse,
  Stack,
  Tooltip,
  Card,
  CardContent,
} from '@mui/material';
import {
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  Extension as ExtensionIcon,
  Science as ScienceIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { WorkerAPIClient } from '../WorkerAPIClient';
import { type PluginDefinition, type PluginDatabaseConfig, type TreeId } from '@hierarchidb/common-core';
import { getUIPluginRegistry } from '@hierarchidb/ui-core';
import { FullScreenDialog } from '@hierarchidb/ui-dialog';
import { useNavigate } from 'react-router';

// Meta function for React Router v7
export function meta() {
  return [
    { title: 'Plugin Registry - HierarchiDB' },
    { name: 'description', content: 'View and manage all registered plugins' }
  ];
}

interface PluginRowProps {
  plugin: PluginDefinition;
  index: number;
}

function PluginRow({ plugin, index }: PluginRowProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell>
          <IconButton
            aria-label="expand row"
            size="small"
            onClick={() => setOpen(!open)}
          >
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell component="th" scope="row">
          {index + 1}
        </TableCell>
        <TableCell>
          <Stack direction="row" spacing={1} alignItems="center">
            <ExtensionIcon fontSize="small" color="primary" />
            <Typography variant="body1" fontWeight="medium">
              {plugin.nodeType}
            </Typography>
          </Stack>
        </TableCell>
        <TableCell>
          {plugin.displayName}
        </TableCell>
        <TableCell>
          <Stack direction="row" spacing={1}>
            {plugin.ui && (
              <Chip
                label="UI"
                size="small"
                color="primary"
                variant="outlined"
              />
            )}
            {plugin.database && (
              <Chip
                label="DB"
                size="small"
                color="secondary"
                variant="outlined"
              />
            )}
            {plugin.lifecycle && (
              <Chip
                label="Lifecycle"
                size="small"
                color="success"
                variant="outlined"
              />
            )}
            {plugin.validation && (
              <Chip
                label="Validation"
                size="small"
                color="warning"
                variant="outlined"
              />
            )}
            {plugin.api && (
              <Chip
                label="API"
                size="small"
                color="info"
                variant="outlined"
              />
            )}
          </Stack>
        </TableCell>
        <TableCell align="center">
          {plugin.category?.createOrder || 'N/A'}
        </TableCell>
        <TableCell>
          <Tooltip title="Plugin is active">
            <CheckCircleIcon color="success" fontSize="small" />
          </Tooltip>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 2 }}>
              <Typography variant="h6" gutterBottom component="div">
                Plugin Details
              </Typography>
              
              <Stack spacing={2}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Name
                  </Typography>
                  <Typography variant="body2">
                    {plugin.name}
                  </Typography>
                </Box>
                
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Display Name
                  </Typography>
                  <Typography variant="body2">
                    {plugin.displayName}
                  </Typography>
                </Box>
                
                {plugin.category && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Category
                    </Typography>
                    <Typography variant="body2">
                      Tree: {plugin.category.treeId} | 
                      Group: {plugin.category.menuGroup || 'default'} | 
                      Order: {plugin.category.createOrder || 'N/A'}
                    </Typography>
                  </Box>
                )}
                
                {plugin.icon && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Icon Configuration
                    </Typography>
                    <Typography variant="body2">
                      {plugin.icon.muiIconName && `MUI Icon: ${plugin.icon.muiIconName}`}
                      {plugin.icon.emoji && ` | Emoji: ${plugin.icon.emoji}`}
                      {plugin.icon.color && ` | Color: ${plugin.icon.color}`}
                      {plugin.icon.description && ` | ${plugin.icon.description}`}
                    </Typography>
                  </Box>
                )}
                
                {plugin.database && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Database Configuration
                    </Typography>
                    <Typography variant="body2">
                      DB: {plugin.database.dbName} | 
                      Table: {plugin.database.tableName} | 
                      Version: {plugin.database.version}
                    </Typography>
                    {plugin.database.schema && (
                      <Typography variant="caption" component="div" sx={{ mt: 1, fontFamily: 'monospace' }}>
                        Schema: {plugin.database.schema}
                      </Typography>
                    )}
                  </Box>
                )}
                
                {plugin.ui && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      UI Components
                    </Typography>
                    <Typography variant="body2">
                      {plugin.ui.dialogComponentPath && '✓ Dialog '}
                      {plugin.ui.panelComponentPath && '✓ Panel '}
                      {plugin.ui.formComponentPath && '✓ Form '}
                      {plugin.ui.iconComponentPath && '✓ Icon'}
                    </Typography>
                  </Box>
                )}
                
                {plugin.validation && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Validation Rules
                    </Typography>
                    <Typography variant="body2">
                      {plugin.validation.namePattern && `Name Pattern: ${plugin.validation.namePattern.toString()}`}
                      {plugin.validation.maxChildren && ` | Max Children: ${plugin.validation.maxChildren}`}
                      {plugin.validation.allowedChildTypes && ` | Allowed Child Types: ${plugin.validation.allowedChildTypes.join(', ')}`}
                    </Typography>
                  </Box>
                )}
                
                {plugin.lifecycle && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Lifecycle Hooks
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                      {plugin.lifecycle.hasBeforeCreate && <Chip label="beforeCreate" size="small" variant="outlined" />}
                      {plugin.lifecycle.hasAfterCreate && <Chip label="afterCreate" size="small" variant="outlined" />}
                      {plugin.lifecycle.hasBeforeUpdate && <Chip label="beforeUpdate" size="small" variant="outlined" />}
                      {plugin.lifecycle.hasAfterUpdate && <Chip label="afterUpdate" size="small" variant="outlined" />}
                      {plugin.lifecycle.hasBeforeDelete && <Chip label="beforeDelete" size="small" variant="outlined" />}
                      {plugin.lifecycle.hasAfterDelete && <Chip label="afterDelete" size="small" variant="outlined" />}
                      {plugin.lifecycle.hasBeforeMove && <Chip label="beforeMove" size="small" variant="outlined" />}
                      {plugin.lifecycle.hasAfterMove && <Chip label="afterMove" size="small" variant="outlined" />}
                      {plugin.lifecycle.hasBeforeCommit && <Chip label="beforeCommit" size="small" variant="outlined" />}
                      {plugin.lifecycle.hasAfterCommit && <Chip label="afterCommit" size="small" variant="outlined" />}
                      {plugin.lifecycle.hasBeforeDiscard && <Chip label="beforeDiscard" size="small" variant="outlined" />}
                      {plugin.lifecycle.hasAfterDiscard && <Chip label="afterDiscard" size="small" variant="outlined" />}
                    </Stack>
                  </Box>
                )}
                
                {plugin.api && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      API Extensions
                    </Typography>
                    <Typography variant="body2">
                      {plugin.api.workerExtensions && `Worker Extensions: ${Object.keys(plugin.api.workerExtensions).join(', ')}`}
                      {plugin.api.clientExtensions && ` | Client Extensions: ${Object.keys(plugin.api.clientExtensions).join(', ')}`}
                    </Typography>
                  </Box>
                )}
                
                {plugin.i18n && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Internationalization
                    </Typography>
                    <Typography variant="body2">
                      {plugin.i18n.namespace && `Namespace: ${plugin.i18n.namespace}`}
                      {plugin.i18n.defaultLocale && ` | Default Locale: ${plugin.i18n.defaultLocale}`}
                      {plugin.i18n.resources && ` | Available Locales: ${Object.keys(plugin.i18n.resources).join(', ')}`}
                    </Typography>
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

export default function PluginsPage() {
  const navigate = useNavigate();
  const [workerPlugins, setWorkerPlugins] = useState<PluginDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPlugins() {
      try {
        setLoading(true);
        const client = await WorkerAPIClient.getSingleton();
        const api = client;
        
        // Get plugins from worker
        const plugins = await api.getPluginsForTree('*' as TreeId);
        setWorkerPlugins(plugins || []);
      } catch (err) {
        console.error('Failed to load plugins:', err);
        setError(err instanceof Error ? err.message : 'Failed to load plugins');
      } finally {
        setLoading(false);
      }
    }

    loadPlugins();
  }, []);

  // Get UI plugins
  const uiRegistry = getUIPluginRegistry();
  const uiPlugins = uiRegistry.getAll();

  if (loading) {
    return (
      <FullScreenDialog
        open={true}
        onClose={() => navigate("/")}
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
        onClose={() => navigate("/")}
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
      onClose={() => navigate("/")}
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
              <Typography variant="h4">
                {workerPlugins.length}
              </Typography>
            </CardContent>
          </Card>
          
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                UI Plugins
              </Typography>
              <Typography variant="h4">
                {uiPlugins.length}
              </Typography>
            </CardContent>
          </Card>
          
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Experimental
              </Typography>
              <Typography variant="h4">
                {0}
              </Typography>
            </CardContent>
          </Card>
        </Stack>

        {/* Worker Plugins Table */}
        <Paper elevation={2}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6">
              Worker Layer Plugins
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Plugins registered in the Worker layer for data processing
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
                  <TableCell>Features</TableCell>
                  <TableCell align="center">Priority</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {workerPlugins.map((plugin, index) => (
                  <PluginRow key={plugin.nodeType} plugin={plugin} index={index} />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* UI Plugins Table */}
        <Paper elevation={2}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6">
              UI Layer Plugins
            </Typography>
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
                  <TableCell>Components</TableCell>
                  <TableCell>Create Order</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {uiPlugins.map((plugin, index) => (
                  <TableRow key={plugin.nodeType}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <ExtensionIcon fontSize="small" color="primary" />
                        <Typography variant="body1" fontWeight="medium">
                          {plugin.nodeType}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        {plugin.components?.createDialog && (
                          <Chip label="Dialog" size="small" variant="outlined" />
                        )}
                        {plugin.components?.editDialog && (
                          <Chip label="Edit" size="small" variant="outlined" />
                        )}
                        {plugin.components?.icon && (
                          <Chip label="Icon" size="small" variant="outlined" />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell align="center">
                      {plugin.menu?.createOrder || 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Plugin is active">
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