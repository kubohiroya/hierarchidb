/**
 * アプリケーション情報ページ
 */

import { Container, Typography, Paper, Box, List, ListItem, ListItemText } from '@mui/material';
import { useOutletContext } from 'react-router-dom';

export default function InfoRoute() {
  const { appConfig } = useOutletContext<{ appConfig: any }>();

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>
          Application Information
        </Typography>

        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            Version Information
          </Typography>
          <List>
            <ListItem>
              <ListItemText primary="Application" secondary={appConfig.title} />
            </ListItem>
            <ListItem>
              <ListItemText primary="Version" secondary={appConfig.version} />
            </ListItem>
            <ListItem>
              <ListItemText primary="Environment" secondary={appConfig.environment} />
            </ListItem>
          </List>
        </Box>

        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            Features
          </Typography>
          <List>
            <ListItem>
              <ListItemText
                primary="Hierarchical Data Management"
                secondary="Tree-based organization of resources and projects"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Geospatial Visualization"
                secondary="MapLibre GL JS integration for interactive maps"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Plugin System"
                secondary="Extensible architecture with AOP support"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Offline Support"
                secondary="IndexedDB for client-side data persistence"
              />
            </ListItem>
          </List>
        </Box>

        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            Technologies
          </Typography>
          <List>
            <ListItem>
              <ListItemText primary="Frontend" secondary="React 18, TypeScript, Material-UI" />
            </ListItem>
            <ListItem>
              <ListItemText primary="Routing" secondary="React Router v7 with file-based routing" />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="State Management"
                secondary="Worker-based architecture with Comlink"
              />
            </ListItem>
            <ListItem>
              <ListItemText primary="Database" secondary="Dexie.js (IndexedDB wrapper)" />
            </ListItem>
          </List>
        </Box>
      </Paper>
    </Container>
  );
}
