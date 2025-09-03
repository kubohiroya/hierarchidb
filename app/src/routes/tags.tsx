import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  Box,
  Container,
  Typography,
  Chip,
  Card,
  CardContent,
  Grid,
  IconButton,
  Tooltip,
  TextField,
  InputAdornment,
  Paper,
  Stack,
  Button,
  Badge,
  Divider,
} from '@mui/material';
import { ArrowBack, Search, Edit, LocalOffer, Sort, FilterList } from '@mui/icons-material';
import { useWorkerClient } from '../contexts/WorkerProvider';
import type { TagEntity } from '@hierarchidb/common-type';

// Meta function for React Router v7
export function meta() {
  return [
    { title: 'Tags - HierarchiDB' },
    { name: 'description', content: 'Manage and browse tags in HierarchiDB' },
  ];
}

export default function TagsPage() {
  const navigate = useNavigate();
  const { client, isConnected } = useWorkerClient();
  const [tags, setTags] = useState<TagEntity[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'name' | 'usageCount'>('usageCount');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Load tags on mount
  useEffect(() => {
    if (!isConnected || !client) return;

    const loadTags = async () => {
      try {
        setLoading(true);
        // Get all tags from the worker
        const tagAPI = await client.getTagAPI();
        const all = await tagAPI.getAllTags();
        const sorted = [...all].sort((a, b) => {
          const dir = sortOrder === 'asc' ? 1 : -1;
          if (sortBy === 'name') {
            return a.name.localeCompare(b.name) * dir;
          }
          // usageCount default
          return ((a.usageCount || 0) - (b.usageCount || 0)) * dir;
        });
        setTags(sorted);
      } catch (error) {
        console.error('Failed to load tags:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTags();
  }, [client, isConnected, sortBy, sortOrder]);

  // Filter tags based on search query
  const filteredTags = tags.filter((tag) => {
    const query = searchQuery.toLowerCase();
    return (
      tag.name.toLowerCase().includes(query) ||
      (tag.description && tag.description.toLowerCase().includes(query)) ||
      (tag.category && tag.category.toLowerCase().includes(query))
    );
  });

  // Group tags by category
  const tagsByCategory = filteredTags.reduce(
    (acc, tag) => {
      const category = tag.category || 'uncategorized';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(tag);
      return acc;
    },
    {} as Record<string, TagEntity[]>
  );

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
    // Navigate to resources tree with tag filter
    navigate(`/t/r?tag=${encodeURIComponent(tag.name)}`);
  };

  // Handle tag edit
  const handleTagEdit = (tag: TagEntity, event: React.MouseEvent) => {
    event.stopPropagation();
    // TODO: Open tag edit base-dialog
    console.log('Edit tag:', tag);
  };

  // Note: Tags with zero usage are automatically deleted by PersistentRelationalEntity lifecycle management
  // Manual deletion is not needed and could interfere with the lifecycle system

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Header */}
      <Paper elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Container maxWidth="lg">
          <Box sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={() => navigate('/')} size="large">
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
        {loading ? (
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
            {Object.entries(tagsByCategory).map(([category, categoryTags]) => (
              <Box key={category} sx={{ width: '100%' }}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ textTransform: 'capitalize' }}>
                      {category}
                    </Typography>
                    <Divider sx={{ mb: 2 }} />

                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                      {categoryTags.map((tag) => (
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
            ))}
          </Grid>
        )}
      </Container>
    </Box>
  );
}
