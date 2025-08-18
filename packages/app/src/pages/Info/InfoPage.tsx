import { Container, Paper, Typography, Box, Button, Divider } from '@mui/material';
import { GitHub as GitHubIcon, Info as InfoIcon } from '@mui/icons-material';
import { LoadAppConfigReturn } from '~/loader';

export function InfoPage({ appConfig }: { appConfig: LoadAppConfigReturn }) {
  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <InfoIcon sx={{ mr: 2, fontSize: 40, color: 'primary.main' }} />
          <Typography variant="h3" component="h1">
            About HierarchiDB
          </Typography>
        </Box>

        <Divider sx={{ mb: 3 }} />

        <Typography variant="h5" gutterBottom>
          HierarchiDB
        </Typography>

        <Typography variant="body1" paragraph>
          High-performance tree-structured data management framework
        </Typography>

        <Typography variant="body2" paragraph>
          A powerful framework for managing hierarchical data in browser environments
        </Typography>

        <Typography variant="caption" display="block" sx={{ mt: 2, mb: 2 }}>
          Developed by Hiroya Kubo
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
          <Button
            variant="outlined"
            startIcon={<GitHubIcon />}
            href={appConfig.appHomepage}
            target="_blank"
          >
            View on GitHub
          </Button>

          <Button variant="contained" href={`/${appConfig.appPrefix}/`}>
            Close
          </Button>
        </Box>
      </Paper>
    </Container>
  );
}
