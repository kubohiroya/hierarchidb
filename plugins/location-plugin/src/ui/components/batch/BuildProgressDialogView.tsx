import { BuildSessionProgressPanel } from '@hierarchidb/ui-build-progress';
import { CrossViewSnackbar, DataGridPreview } from '@hierarchidb/ui-grid';
import {
  Assessment,
  CheckCircle,
  Close,
  Error as ErrorIcon,
  Map as MapIcon,
  TableView,
  Timeline,
  Warning,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import type React from 'react';
import type { BuildProgressDialogProps, BuildProgressDialogState } from './types.js';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <Box
    role="tabpanel"
    hidden={value !== index}
    sx={{ height: '100%', display: value === index ? 'flex' : 'none', flexDirection: 'column' }}
  >
    {value === index && children}
  </Box>
);

export interface BuildProgressDialogViewProps
  extends Pick<BuildProgressDialogProps, 'open' | 'onClose'>,
    BuildProgressDialogState {}

export const BuildProgressDialogView: React.FC<BuildProgressDialogViewProps> = ({
  open,
  onClose,
  tabValue,
  onTabChange,
  tableId,
  datasetId,
  locale,
  dialogTitle,
  closeAriaLabel,
  closeLabel,
  progressTabLabel,
  logsTabLabel,
  mapPreviewTabLabel,
  dataTableTabLabel,
  phaseLabel,
  showAuthRequired,
  authAlertMessage,
  visibleError,
  logs,
  logsEmptyLabel,
  mapPlaceholderLabel,
  progressPanelProps,
}) => (
  <Dialog
    open={open}
    onClose={onClose}
    maxWidth="xl"
    fullWidth
    PaperProps={{
      sx: { height: '90vh', display: 'flex', flexDirection: 'column' },
    }}
  >
    <DialogTitle>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Typography variant="h6">{dialogTitle}</Typography>
        <Box display="flex" alignItems="center" gap={1}>
          <Chip label={phaseLabel} color="primary" size="small" />
          <IconButton size="small" onClick={onClose} aria-label={closeAriaLabel}>
            <Close />
          </IconButton>
        </Box>
      </Box>
    </DialogTitle>

    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Tabs value={tabValue} onChange={onTabChange}>
        <Tab icon={<Timeline />} label={progressTabLabel} />
        <Tab icon={<Assessment />} label={logsTabLabel} />
        <Tab icon={<MapIcon />} label={mapPreviewTabLabel} />
        <Tab icon={<TableView />} label={dataTableTabLabel} />
      </Tabs>
    </Box>

    <DialogContent sx={{ flex: 1, overflow: 'hidden', p: 0 }}>
      {datasetId ? <CrossViewSnackbar datasetId={datasetId} /> : null}
      {showAuthRequired ? (
        <Alert severity="warning" sx={{ m: 2 }}>
          {authAlertMessage}
        </Alert>
      ) : null}
      <TabPanel value={tabValue} index={0}>
        <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
          {visibleError ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {visibleError}
            </Alert>
          ) : null}
          <BuildSessionProgressPanel {...progressPanelProps} />
        </Box>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
          <List>
            {logs.length === 0 ? (
              <ListItem>
                <ListItemText primary={logsEmptyLabel} />
              </ListItem>
            ) : (
              logs.map((log, index) => (
                <ListItem key={String(index)} divider>
                  <ListItemIcon>
                    {log.level === 'error' ? (
                      <ErrorIcon color="error" />
                    ) : log.level === 'warning' ? (
                      <Warning color="warning" />
                    ) : (
                      <CheckCircle color="success" />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={log.message}
                    secondary={`${log.timestamp.toLocaleTimeString(locale === 'ja' ? 'ja-JP' : 'en-US')} - ${log.source}`}
                  />
                </ListItem>
              ))
            )}
          </List>
        </Box>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Alert severity="info">{mapPlaceholderLabel}</Alert>
        </Box>
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        <Box sx={{ flex: 1, minHeight: 360 }}>
          <DataGridPreview pluginId="location" tableId={tableId || undefined} />
        </Box>
      </TabPanel>
    </DialogContent>

    <DialogActions>
      <Button onClick={onClose}>{closeLabel}</Button>
    </DialogActions>
  </Dialog>
);
