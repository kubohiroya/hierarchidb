import React, { useEffect, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Cached as CachedIcon,
  CheckCircle as CheckIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Error as ErrorIcon,
  Link as LinkIcon,
  Memory as MemoryIcon,
  Merge as MergeIcon,
  MoreVert as MoreIcon,
  PlayArrow as PlayIcon,
  Speed as SpeedIcon,
  Timeline as TimelineIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import type { NodeId } from '@hierarchidb/common-type';
import type { ResolverEntity } from '~/types';

interface MappingStatistics {
  totalSourceProperties: number;
  totalTargetProperties: number;
  mappedProperties: number;
  unmappedProperties: string[];
  coverage: number;
  conflicts: string[];
}

interface ResolverPanelProps {
  nodeId: NodeId;
  entity?: ResolverEntity;
  onEdit?: () => void;
  onDelete?: () => void;
  onTest?: () => void;
  onCompile?: () => void;
  onViewChain?: () => void;
}

export const ResolverPanel: React.FC<ResolverPanelProps> = ({
                                                              nodeId: _nodeId,
                                                              entity,
                                                              onEdit,
                                                              onDelete,
                                                              onTest,
                                                              onCompile,
                                                              onViewChain,
                                                            }) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [compilationStatus, setCompilationStatus] = useState<'idle' | 'compiling' | 'compiled' | 'error'>('idle');
  const [statistics, setStatistics] = useState<MappingStatistics | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Mock statistics calculation
  useEffect(() => {
    if (entity) {
      const totalMappings = entity.mappingRules.length;
      // const _totalValidations = entity.validationRules.length;
      // const _totalTransformations = entity.dataTransformations.length;

      setStatistics({
        totalSourceProperties: 0, // Would be calculated from actual schema
        totalTargetProperties: 0, // Would be calculated from actual schema
        mappedProperties: totalMappings,
        unmappedProperties: [],
        coverage: totalMappings > 0 ? 100 : 0,
        conflicts: [],
      } as any);

      // Check if compiled version exists (mock)
      if (totalMappings > 5) {
        setCompilationStatus('compiled');
      }
    }
  }, [entity]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleCompile = async () => {
    setIsProcessing(true);
    setCompilationStatus('compiling');

    // Simulate compilation
    setTimeout(() => {
      setCompilationStatus('compiled');
      setIsProcessing(false);
      if (onCompile) onCompile();
    }, 2000);
  };

  const getStatusIcon = () => {
    if (!entity) return null;

    const hasErrors = entity.mappingRules.length === 0;
    const hasWarnings = entity.validationRules.length === 0;

    if (hasErrors) {
      return <ErrorIcon color="error" />;
    } else if (hasWarnings) {
      return <WarningIcon color="warning" />;
    } else {
      return <CheckIcon color="success" />;
    }
  };

  const getCompilationBadge = () => {
    switch (compilationStatus) {
      case 'compiled':
        return (
          <Tooltip title="Compiled and optimized">
            <Badge badgeContent="✓" color="success">
              <SpeedIcon color="primary" />
            </Badge>
          </Tooltip>
        );
      case 'compiling':
        return <CircularProgress size={20} />;
      case 'error':
        return (
          <Tooltip title="Compilation failed">
            <Badge badgeContent="!" color="error">
              <SpeedIcon color="disabled" />
            </Badge>
          </Tooltip>
        );
      default:
        return (
          <Tooltip title="Not compiled">
            <SpeedIcon color="disabled" />
          </Tooltip>
        );
    }
  };

  if (!entity) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          No Resolver configuration found for this node.
        </Typography>
        <Button
          variant="contained"
          sx={{ mt: 2 }}
          onClick={onEdit}
        >
          Create Configuration
        </Button>
      </Paper>
    );
  }

  return (
    <Box>
      {/* Header Card */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                {getStatusIcon()}
                <Typography variant="h6">
                  {entity.name}
                </Typography>
                {getCompilationBadge()}
              </Box>
              {entity.description && (
                <Typography variant="body2" color="text.secondary">
                  {entity.description}
                </Typography>
              )}
            </Box>
            <IconButton onClick={handleMenuOpen}>
              <MoreIcon />
            </IconButton>
          </Box>

          <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              label={`${entity.mappingRules.length} Mappings`}
              size="small"
              color="primary"
              variant="outlined"
            />
            <Chip
              label={`${entity.validationRules.length} Validations`}
              size="small"
              color="secondary"
              variant="outlined"
            />
            <Chip
              label={entity.duplicateResolution.strategy}
              size="small"
              icon={<MergeIcon />}
              variant="outlined"
            />
            {compilationStatus === 'compiled' && (
              <Chip
                label="Optimized"
                size="small"
                color="success"
                icon={<SpeedIcon />}
              />
            )}
          </Box>
        </CardContent>

        <CardActions>
          <Button
            size="small"
            startIcon={<EditIcon />}
            onClick={onEdit}
          >
            Edit
          </Button>
          <Button
            size="small"
            startIcon={<PlayIcon />}
            onClick={onTest}
          >
            Test
          </Button>
          {compilationStatus !== 'compiled' && (
            <Button
              size="small"
              startIcon={<SpeedIcon />}
              onClick={handleCompile}
              disabled={isProcessing}
            >
              Compile
            </Button>
          )}
          {onViewChain && (
            <Button
              size="small"
              startIcon={<LinkIcon />}
              onClick={onViewChain}
            >
              View Chain
            </Button>
          )}
        </CardActions>

        {isProcessing && <LinearProgress />}
      </Card>

      {/* Statistics Grid */}
      {statistics && (
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={6} sm={3}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="primary">
                {statistics.mappedProperties}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Mapped Properties
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="secondary">
                {entity.validationRules.length}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Validation Rules
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="success.main">
                {statistics.coverage.toFixed(0)}%
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Coverage
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color={compilationStatus === 'compiled' ? 'success.main' : 'text.disabled'}>
                {compilationStatus === 'compiled' ? '10x' : '--'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Speed Boost
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Mapping Rules List */}
      <Paper sx={{ mb: 2 }}>
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Property Mappings
          </Typography>
        </Box>
        <Divider />
        <List dense>
          {entity.mappingRules.slice(0, 5).map((rule) => (
            <ListItem key={rule.id}>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                      {rule.sourceProperty}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      →
                    </Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                      {rule.targetProperty}
                    </Typography>
                  </Box>
                }
                secondary={rule.transformFunction && (
                  <Chip
                    label={rule.transformFunction}
                    size="small"
                    variant="outlined"
                    sx={{ mt: 0.5 }}
                  />
                )}
              />
            </ListItem>
          ))}
          {entity.mappingRules.length > 5 && (
            <ListItem>
              <ListItemText
                secondary={`... and ${entity.mappingRules.length - 5} more mappings`}
              />
            </ListItem>
          )}
          {entity.mappingRules.length === 0 && (
            <ListItem>
              <ListItemText
                primary={
                  <Typography variant="body2" color="text.secondary">
                    No mapping rules defined
                  </Typography>
                }
              />
            </ListItem>
          )}
        </List>
      </Paper>

      {/* Performance Metrics (if compiled) */}
      {compilationStatus === 'compiled' && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 2 }}>
            Performance Metrics
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TimelineIcon color="primary" />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Avg. Execution Time
                  </Typography>
                  <Typography variant="body1">
                    12.5ms → 1.2ms
                  </Typography>
                </Box>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <MemoryIcon color="primary" />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Memory Usage
                  </Typography>
                  <Typography variant="body1">
                    2.4MB → 0.8MB
                  </Typography>
                </Box>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CachedIcon color="primary" />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Cache Hit Rate
                  </Typography>
                  <Typography variant="body1">
                    89%
                  </Typography>
                </Box>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SpeedIcon color="success" />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Optimization Level
                  </Typography>
                  <Typography variant="body1">
                    Aggressive
                  </Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => {
          handleMenuClose();
          onEdit?.();
        }}>
          <EditIcon sx={{ mr: 1 }} fontSize="small" />
          Edit Configuration
        </MenuItem>
        <MenuItem onClick={() => {
          handleMenuClose();
          onTest?.();
        }}>
          <PlayIcon sx={{ mr: 1 }} fontSize="small" />
          Run Test
        </MenuItem>
        <MenuItem onClick={() => {
          handleMenuClose();
          handleCompile();
        }}>
          <SpeedIcon sx={{ mr: 1 }} fontSize="small" />
          Compile & Optimize
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => {
          handleMenuClose();
          onViewChain?.();
        }}>
          <LinkIcon sx={{ mr: 1 }} fontSize="small" />
          View in Chain
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => {
          handleMenuClose();
          onDelete?.();
        }}>
          <DeleteIcon sx={{ mr: 1 }} fontSize="small" color="error" />
          Delete
        </MenuItem>
      </Menu>
    </Box>
  );
};