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
import { WorkerAPIClient } from '@hierarchidb/ui-client';
import { type PluginDefinition } from '@hierarchidb/common-core';
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
  plugin: PluginDefinition<any, any, any>;
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
          {plugin.metadata?.version || 'N/A'}
        </TableCell>
        <TableCell>
          <Stack direction="row" spacing={1}>
            {plugin.metadata?.experimental && (
              <Chip
                label="Experimental"
                size="small"
                color="warning"
                icon={<ScienceIcon />}
              />
            )}
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
          </Stack>
        </TableCell>
        <TableCell align="center">
          {plugin.metadata?.priority || 'N/A'}
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
                {plugin.metadata?.description && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Description
                    </Typography>
                    <Typography variant="body2">
                      {plugin.metadata.description}
                    </Typography>
                  </Box>
                )}
                
                {plugin.metadata?.author && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Author
                    </Typography>
                    <Typography variant="body2">
                      {plugin.metadata.author}
                    </Typography>
                  </Box>
                )}
                
                {plugin.metadata?.tags && plugin.metadata.tags.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Tags
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                      {plugin.metadata.tags.map((tag: string) => (
                        <Chip key={tag} label={tag} size="small" />
                      ))}
                    </Stack>
                  </Box>
                )}
                
                {plugin.database && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Database Configuration
                    </Typography>
                    <Typography variant="body2">
                      Table: {plugin.database.tableName || plugin.database.entityStore} | 
                      Version: {plugin.database.version}
                    </Typography>
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
                
                {plugin.dependencies && plugin.dependencies.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Dependencies
                    </Typography>
                    <Typography variant="body2">
                      {plugin.dependencies.join(', ')}
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
  const [workerPlugins, setWorkerPlugins] = useState<PluginDefinition<any, any, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPlugins() {
      try {
        setLoading(true);
        const client = await WorkerAPIClient.getSingleton();
        const api = client.getAPI();
        
        // Get plugins from worker
        const plugins = await api.getPluginsForTree('*' as any);
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
                {workerPlugins.filter(p => p.metadata?.experimental).length}
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
                  <TableCell>Version</TableCell>
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
                        {plugin.ui?.createDialog && (
                          <Chip label="Dialog" size="small" variant="outlined" />
                        )}
                        {plugin.ui?.editDialog && (
                          <Chip label="Edit" size="small" variant="outlined" />
                        )}
                        {plugin.ui?.icon && (
                          <Chip label="Icon" size="small" variant="outlined" />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell align="center">
                      {plugin.metadata?.createOrder || 'N/A'}
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