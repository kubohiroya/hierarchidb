// import { useWorker } from '../contexts/WorkerProvider.js';
import type { TagEntity } from '@hierarchidb/tag-api';
import { ArrowBack, FilterList, LocalOffer, Search, Sort } from '@mui/icons-material';
import {
  Badge,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { Outlet, useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useTagsPage } from './useTagsPage.js';

// Meta function for React Router v7
export function meta() {
  return [
    { title: 'Tags - HierarchiDB' },
    { name: 'description', content: 'Manage and browse tags in HierarchiDB' },
  ];
}

type TagsPageProps = {
  basePath?: string;
  embedded?: boolean;
  onBack?: () => void;
};

function normalizeBasePath(value?: string) {
  if (!value) return '/tags';
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

export default function TagsPage({ basePath, embedded, onBack }: TagsPageProps) {
  const navigate = useNavigate();
  const { allTags, isConnected, isLoadingTags } = useTagsPage();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'usageCount'>('usageCount');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const tags = useMemo(() => {
    const dir = sortOrder === 'asc' ? 1 : -1;
    return [...allTags].sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name) * dir;
      }
      return ((a.usageCount || 0) - (b.usageCount || 0)) * dir;
    });
  }, [allTags, sortBy, sortOrder]);

  // Filter tags based on search query
  const filteredTags = tags.filter((tag) => {
    const query = searchQuery.toLowerCase();
    return (
      tag.name.toLowerCase().includes(query) ||
      tag.description?.toLowerCase().includes(query)
    );
  });

  // Toggle sort order
  const toggleSort = (field: 'name' | 'usageCount') => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // Handle tag click - navigate to search with tag filter
  const handleTagClick = (tag: TagEntity) => {
    const resolvedBasePath = normalizeBasePath(basePath);
    navigate({ to: `${resolvedBasePath}/${encodeURIComponent(tag.name)}` });
  };

  // Handle tag edit
  /*
  const handleTagEdit = (tag: TagEntity, event: React.MouseEvent) => {
    event.stopPropagation();
    // TODO: Open tag edit base-dialog
    console.log('Edit tag:', tag);
  };
     */

  // Note: Tags with zero usage are automatically deleted by PersistentRelationalEntity lifecycle management
  // Manual deletion is not needed and could interfere with the lifecycle system

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    navigate({ to: '/' });
  };

  return (
    <Box sx={{ minHeight: embedded ? 'auto' : '100vh', bgcolor: 'background.default' }}>
      {/* Header */}
      <Paper elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Container maxWidth="lg">
          <Box sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={handleBack} size="large">
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

            {/* Search field */}
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

            {/* Sort buttons */}
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

      {/* Main content */}
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {!isConnected || isLoadingTags ? (
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
                      <Badge key={tag.id} badgeContent={tag.usageCount} color="secondary" max={999}>
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
  );
}
