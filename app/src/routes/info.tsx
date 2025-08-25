/**
 * アプリケーション情報ページ
 */

//import { Container, Typography, Paper, Box, List, ListItem, ListItemText } from '@mui/material';
/*
(
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>

      </Paper>
    </Container>
  );
 */
// import { useOutletContext } from 'react-router-dom';
import { InfoPage } from '~/pages/Info/InfoPage';
import { useLoaderData } from 'react-router';
import { loadAppConfig } from '~/loadAppConfig';

// Meta function for React Router v7
export function meta() {
  return [
    { title: 'About - HierarchiDB' },
    { name: 'description', content: 'Application information and licenses' }
  ];
}

export function clientLoader() {
  return loadAppConfig();
}

export default function InfoRoute() {
  const appConfig = useLoaderData();
  return <InfoPage appConfig={appConfig} />;
}
