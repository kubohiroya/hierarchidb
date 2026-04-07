/**
 * console Tags Route for TanStack Router
 *
 * This route handles the `/d/:treeId/:pageNodeId/tags` path
 * and renders tags content inside a modal dialog.
 */

import { ArrowBack, FilterList, LocalOffer, Search, Sort } from '@mui/icons-material';
import {
  Badge,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Dialog,
  DialogContent,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { createRoute, Outlet, useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import TagDetailRoute from '~/router/routes/tags.($tagName)';
import { type TagWithUsage, useTagsPage } from '~/router/routes/useTagsPage';
import { treePageRoute } from './pageRoute.js';

function TreeTagsDialog() {
  const navigate = useNavigate();
  const { treeId, pageNodeId } = treeTagsRoute.useParams();
  const { allTags, isConnected, isLoadingTags } = useTagsPage();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'usageCount'>('usageCount');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const resolvedPageNodeId = pageNodeId ?? `${treeId}:root`;
  const basePath = `/d/${treeId}/${resolvedPageNodeId}/tags`;
  const handleClose = () => {
    if (!treeId) return;
    navigate({ to: `/d/${treeId}/${resolvedPageNodeId}` });
  };

  const tags = useMemo(() => {
    const dir = sortOrder === 'asc' ? 1 : -1;
    return [...allTags].sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name) * dir;
      }
      return ((a.usageCount || 0) - (b.usageCount || 0)) * dir;
    });
  }, [allTags, sortBy, sortOrder]);

  const filteredTags = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return tags.filter((tag) => {
      return (
        tag.name.toLowerCase().includes(query) ||
        tag.description?.toLowerCase().includes(query)
      );
    });
  }, [searchQuery, tags]);

  const toggleSort = (field: 'name' | 'usageCount') => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortBy(field);
    setSortOrder('desc');
  };

  const handleTagClick = (tag: TagWithUsage) => {
    navigate({ to: `${basePath}/${encodeURIComponent(tag.name)}` });
  };

  const showLoading = (!isConnected && tags.length === 0) || (isLoadingTags && tags.length === 0);

  if (!treeId) return null;

  return (
    <Dialog
      open
      onClose={handleClose}
      keepMounted
      fullWidth
      maxWidth="lg"
      scroll="paper"
      PaperProps={{ sx: { maxHeight: '90vh' } }}
    >
      <DialogContent sx={{ p: 0, minHeight: '60vh' }}>
        <Box sx={{ bgcolor: 'background.default' }}>
          <Paper elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Container maxWidth="lg">
              <Box sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                <IconButton onClick={handleClose} size="large">
                  <ArrowBack />
                </IconButton>

                <LocalOffer color="primary" />

                <Typography variant="h5" component="h1" sx={{ flexGrow: 0 }}>
                  Tags
                </Typography>

                <Typography variant="body2" color="text.secondary">
                  {tags.length} tags
                </Typography>

                <Box sx={{ flexGrow: 1 }} />

                <TextField
                  placeholder="Search tags..."
                  variant="outlined"
                  size="small"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  sx={{ width: 300 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search />
                      </InputAdornment>
                    ),
                  }}
                />

                <Button
                  variant={sortBy === 'name' ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => toggleSort('name')}
                  startIcon={<Sort />}
                >
                  Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                </Button>

                <Button
                  variant={sortBy === 'usageCount' ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => toggleSort('usageCount')}
                  startIcon={<FilterList />}
                >
                  Usage {sortBy === 'usageCount' && (sortOrder === 'asc' ? '↑' : '↓')}
                </Button>
              </Box>
            </Container>
          </Paper>

          <Container maxWidth="lg" sx={{ py: 4 }}>
            {showLoading ? (
              <Typography>Loading tags...</Typography>
            ) : filteredTags.length === 0 ? (
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <LocalOffer sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  {searchQuery ? 'No tags found' : 'No tags yet'}
                </Typography>
                <Typography color="text.secondary">
                  {searchQuery
                    ? 'Try adjusting your search query'
                    : 'Tags will appear here when you start tagging your nodes'}
                </Typography>
              </Paper>
            ) : (
              <Grid container spacing={3}>
                <Box sx={{ width: '100%' }}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Tags
                      </Typography>
                      <Divider sx={{ mb: 2 }} />
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                        {filteredTags.map((tag) => (
                          <Badge
                            key={tag.id}
                            badgeContent={tag.usageCount}
                            color="secondary"
                            max={999}
                          >
                            <Chip
                              label={tag.name}
                              onClick={() => handleTagClick(tag)}
                              sx={{
                                backgroundColor: tag.color || '#e0e0e0',
                                color: '#fff',
                                fontWeight: 500,
                                '&:hover': {
                                  opacity: 0.8,
                                  cursor: 'pointer',
                                },
                              }}
                            />
                          </Badge>
                        ))}
                      </Box>
                    </CardContent>
                  </Card>
                </Box>
              </Grid>
            )}
            <Box sx={{ mt: 4 }}>
              <Divider sx={{ mb: 3 }} />
              <Outlet />
            </Box>
          </Container>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

export const treeTagsRoute = createRoute({
  getParentRoute: () => treePageRoute,
  path: 'tags',
  component: TreeTagsDialog,
});

export const treeTagDetailRoute = createRoute({
  getParentRoute: () => treeTagsRoute,
  path: '$tag',
  component: () => {
    const { tag } = treeTagDetailRoute.useParams();
    return <TagDetailRoute tagName={tag} />;
  },
});
