import { memo } from 'react';
import {
  Toolbar,
  Typography,
  IconButton,
  Button,
  Box,
  Chip,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tooltip,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  ViewList as ViewListIcon,
  ViewComfy as ViewComfyIcon,
  FilterList as FilterListIcon,
  Sort as SortIcon,
  MoreVert as MoreVertIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

export interface TreeTableToolbarProps {
  readonly title?: string;
  readonly searchTerm: string;
  readonly onSearchChange: (term: string) => void;
  readonly onSearchClear: () => void;
  readonly selectedCount: number;
  readonly totalCount: number;
  readonly canCreate: boolean;
  readonly canEdit: boolean;
  readonly canDelete: boolean;
  readonly onCreate: () => void;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
  readonly onRefresh: () => void;
  readonly onExpandAll: () => void;
  readonly onCollapseAll: () => void;
  readonly isLoading?: boolean;
  readonly viewMode: 'list' | 'grid';
  readonly onViewModeChange: (mode: 'list' | 'grid') => void;
  readonly sortBy?: string;
  readonly sortDirection?: 'asc' | 'desc';
  readonly onSortChange: (field: string, direction: 'asc' | 'desc') => void;
  readonly filterBy?: string;
  readonly onFilterChange: (filter: string) => void;
  readonly availableFilters: readonly string[];
}

export const TreeTableToolbar = memo(function TreeTableToolbar(props: TreeTableToolbarProps) {
  const hasSelection = props.selectedCount > 0;

  return (
    <Toolbar
      variant="dense"
      sx={{
        px: 2,
        py: 1,
        minHeight: 48,
        bgcolor: 'background.paper',
        borderBottom: '1px solid',
        borderBottomColor: 'divider',
      }}
    >
      {/* Title Section */}
      <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
        {props.title && (
          <Typography variant="h6" component="h2" sx={{ mr: 2 }}>
            {props.title}
          </Typography>
        )}

        {/* Item count */}
        <Chip
          size="small"
          label={hasSelection ? `${props.selectedCount} selected` : `${props.totalCount} items`}
          variant={hasSelection ? 'filled' : 'outlined'}
          color={hasSelection ? 'primary' : 'default'}
        />
      </Box>

      {/* Search Section */}
      <Box sx={{ display: 'flex', alignItems: 'center', mr: 2, minWidth: 200 }}>
        <TextField
          size="small"
          placeholder="Search..."
          value={props.searchTerm}
          onChange={(e) => props.onSearchChange(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: props.searchTerm ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={props.onSearchClear} aria-label="Clear search">
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
          sx={{ minWidth: 200 }}
        />
      </Box>

      {/* Filter Section */}
      {props.availableFilters.length > 0 && (
        <Box sx={{ mr: 2 }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Filter</InputLabel>
            <Select
              value={props.filterBy || ''}
              label="Filter"
              onChange={(e) => props.onFilterChange(e.target.value)}
              startAdornment={<FilterListIcon fontSize="small" />}
            >
              <MenuItem value="">
                <em>All</em>
              </MenuItem>
              {props.availableFilters.map((filter) => (
                <MenuItem key={filter} value={filter}>
                  {filter}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      )}

      {/* Spacer */}
      <Box sx={{ flexGrow: 1 }} />

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {/* Expansion Controls */}
        <Tooltip title="Expand All">
          <IconButton size="small" onClick={props.onExpandAll} aria-label="Expand all">
            <ExpandMoreIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="Collapse All">
          <IconButton size="small" onClick={props.onCollapseAll} aria-label="Collapse all">
            <ExpandLessIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {/* View Mode Toggle */}
        <Tooltip title={props.viewMode === 'list' ? 'Grid View' : 'List View'}>
          <IconButton
            size="small"
            onClick={() => props.onViewModeChange(props.viewMode === 'list' ? 'grid' : 'list')}
            aria-label="Toggle view mode"
          >
            {props.viewMode === 'list' ? (
              <ViewComfyIcon fontSize="small" />
            ) : (
              <ViewListIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>

        {/* Sort Control */}
        <Tooltip title="Sort">
          <IconButton
            size="small"
            onClick={() =>
              props.onSortChange(
                props.sortBy || 'name',
                props.sortDirection === 'asc' ? 'desc' : 'asc'
              )
            }
            aria-label="Sort"
          >
            <SortIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {/* Refresh */}
        <Tooltip title="Refresh">
          <IconButton
            size="small"
            onClick={props.onRefresh}
            disabled={props.isLoading}
            aria-label="Refresh"
          >
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {/* Create Button */}
        <Button
          size="small"
          variant="contained"
          startIcon={<AddIcon />}
          onClick={props.onCreate}
          disabled={!props.canCreate}
          sx={{ ml: 1 }}
        >
          Create
        </Button>

        {/* Selection Actions */}
        {hasSelection && (
          <>
            <Button
              size="small"
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={props.onEdit}
              disabled={!props.canEdit || props.selectedCount !== 1}
              sx={{ ml: 1 }}
            >
              Edit
            </Button>

            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={props.onDelete}
              disabled={!props.canDelete}
              sx={{ ml: 1 }}
            >
              Delete
            </Button>
          </>
        )}

        {/* More Actions */}
        <Tooltip title="More actions">
          <IconButton size="small" aria-label="More actions">
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Toolbar>
  );
});
