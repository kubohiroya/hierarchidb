/**
 * TreeConsole Demo Page (Deprecated)
 * 
 * This demo page is no longer maintained.
 * Please use the actual tree routes for testing TreeConsole functionality.
 */

import { Container, Typography, Alert, Box } from "@mui/material";

export default function TreeConsoleDemo() {
  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Alert severity="warning">
        <Typography variant="h6">This demo page has been deprecated</Typography>
        <Box sx={{ mt: 2 }}>
          <Typography>
            Please use the actual tree routes for testing:
          </Typography>
          <ul>
            <li>/t/r - Main tree view</li>
            <li>/t/[treeId] - Specific tree view</li>
          </ul>
        </Box>
      </Alert>
    </Container>
  );
}