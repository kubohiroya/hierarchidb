import { Link } from 'react-router-dom';
import { Container, Typography, Button, Box } from '@mui/material';

export default function Index() {
  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Typography variant="h2" component="h1" gutterBottom>
        Welcome to HierarchiDB
      </Typography>
      <Typography variant="body1" paragraph>
        High-performance tree-structured data management framework
      </Typography>
      <Box sx={{ mt: 4 }}>
        <Button component={Link} to="/info" variant="contained">
          About
        </Button>
      </Box>
    </Container>
  );
}