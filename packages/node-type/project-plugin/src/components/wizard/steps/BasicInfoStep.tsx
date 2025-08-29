import React, { useState } from 'react';
import {
  Box,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Stack,
  Typography,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Autocomplete
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Add as AddIcon,
  Business as BusinessIcon,
  Public as PublicIcon,
  Lock as LockIcon,
  Group as GroupIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import type { ProjectEntity, ProjectCategory, Milestone, Collaborator } from '~/types/project-types';

interface BasicInfoStepProps {
  data: Partial<ProjectEntity>;
  onComplete: (data: Partial<ProjectEntity>) => void;
}

const categoryOptions: { value: ProjectCategory; label: string; icon: React.ReactNode }[] = [
  { value: 'urban-planning', label: 'Urban Planning', icon: <BusinessIcon /> },
  { value: 'disaster-management', label: 'Disaster Management', icon: <PublicIcon /> },
  { value: 'tourism', label: 'Tourism', icon: <PublicIcon /> },
  { value: 'environment', label: 'Environment', icon: <PublicIcon /> },
  { value: 'infrastructure', label: 'Infrastructure', icon: <BusinessIcon /> },
  { value: 'research', label: 'Research', icon: <PublicIcon /> }
];

export const BasicInfoStep: React.FC<BasicInfoStepProps> = ({ data, onComplete }) => {
  const [formData, setFormData] = useState({
    name: data.name || '',
    description: data.description || '',
    category: data.category || 'research' as ProjectCategory,
    tags: data.tags || [],
    startDate: data.startDate || new Date(),
    endDate: data.endDate || null,
    milestones: data.milestones || [],
    organization: data.organization || {
      name: '',
      department: '',
      contactEmail: ''
    },
    visibility: data.visibility || 'private',
    collaborators: data.collaborators || []
  });

  const [newTag, setNewTag] = useState('');
  const [newMilestone, setNewMilestone] = useState<Partial<Milestone>>({
    name: '',
    description: '',
    date: new Date()
  });
  const [newCollaborator, setNewCollaborator] = useState<Partial<Collaborator>>({
    email: '',
    role: 'viewer'
  });

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleOrganizationChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      organization: {
        ...prev.organization,
        [field]: value
      }
    }));
  };

  const handleAddTag = () => {
    if (newTag.trim()) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const handleRemoveTag = (index: number) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter((_, i) => i !== index)
    }));
  };

  const handleAddMilestone = () => {
    if (newMilestone.name) {
      setFormData(prev => ({
        ...prev,
        milestones: [...prev.milestones, newMilestone as Milestone]
      }));
      setNewMilestone({
        name: '',
        description: '',
        date: new Date()
      });
    }
  };

  const handleRemoveMilestone = (index: number) => {
    setFormData(prev => ({
      ...prev,
      milestones: prev.milestones.filter((_, i) => i !== index)
    }));
  };

  const handleAddCollaborator = () => {
    if (newCollaborator.email) {
      setFormData(prev => ({
        ...prev,
        collaborators: [...prev.collaborators, newCollaborator as Collaborator]
      }));
      setNewCollaborator({
        email: '',
        role: 'viewer'
      });
    }
  };

  const handleRemoveCollaborator = (index: number) => {
    setFormData(prev => ({
      ...prev,
      collaborators: prev.collaborators.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = () => {
    onComplete(formData);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 2 }}>
        <Grid container spacing={3}>
          {/* Basic Information */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Basic Information
            </Typography>
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Project Name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              required
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={formData.category}
                onChange={(e) => handleChange('category', e.target.value)}
                label="Category"
              >
                {categoryOptions.map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {option.icon}
                      {option.label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Tags
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap' }}>
                {formData.tags.map((tag, index) => (
                  <Chip
                    key={index}
                    label={tag}
                    onDelete={() => handleRemoveTag(index)}
                    size="small"
                  />
                ))}
              </Stack>
              <Stack direction="row" spacing={1}>
                <TextField
                  size="small"
                  placeholder="Add tag"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                />
                <IconButton onClick={handleAddTag} size="small">
                  <AddIcon />
                </IconButton>
              </Stack>
            </Box>
          </Grid>
          
          {/* Project Duration */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
              Project Duration
            </Typography>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <DatePicker
              label="Start Date"
              value={formData.startDate}
              onChange={(date) => handleChange('startDate', date)}
              slotProps={{ textField: { fullWidth: true } }}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <DatePicker
              label="End Date (Optional)"
              value={formData.endDate}
              onChange={(date) => handleChange('endDate', date)}
              slotProps={{ textField: { fullWidth: true } }}
            />
          </Grid>
          
          {/* Milestones */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>
              Milestones
            </Typography>
            <List dense>
              {formData.milestones.map((milestone, index) => (
                <ListItem key={index}>
                  <ListItemText
                    primary={milestone.name}
                    secondary={`${milestone.description} - ${new Date(milestone.date).toLocaleDateString()}`}
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      onClick={() => handleRemoveMilestone(index)}
                      size="small"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <TextField
                size="small"
                placeholder="Milestone name"
                value={newMilestone.name}
                onChange={(e) => setNewMilestone(prev => ({ ...prev, name: e.target.value }))}
              />
              <TextField
                size="small"
                placeholder="Description"
                value={newMilestone.description}
                onChange={(e) => setNewMilestone(prev => ({ ...prev, description: e.target.value }))}
              />
              <DatePicker
                label="Date"
                value={newMilestone.date}
                onChange={(date) => setNewMilestone(prev => ({ ...prev, date }))}
                slotProps={{ textField: { size: 'small' } }}
              />
              <IconButton onClick={handleAddMilestone} size="small">
                <AddIcon />
              </IconButton>
            </Stack>
          </Grid>
          
          {/* Organization */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
              Organization
            </Typography>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Organization Name"
              value={formData.organization?.name}
              onChange={(e) => handleOrganizationChange('name', e.target.value)}
            />
          </Grid>
          
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Department"
              value={formData.organization?.department}
              onChange={(e) => handleOrganizationChange('department', e.target.value)}
            />
          </Grid>
          
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Contact Email"
              type="email"
              value={formData.organization?.contactEmail}
              onChange={(e) => handleOrganizationChange('contactEmail', e.target.value)}
            />
          </Grid>
          
          {/* Access Settings */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
              Access Settings
            </Typography>
          </Grid>
          
          <Grid item xs={12}>
            <FormControl>
              <FormLabel>Visibility</FormLabel>
              <RadioGroup
                row
                value={formData.visibility}
                onChange={(e) => handleChange('visibility', e.target.value)}
              >
                <FormControlLabel
                  value="private"
                  control={<Radio />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <LockIcon fontSize="small" />
                      Private
                    </Box>
                  }
                />
                <FormControlLabel
                  value="team"
                  control={<Radio />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <GroupIcon fontSize="small" />
                      Team
                    </Box>
                  }
                />
                <FormControlLabel
                  value="organization"
                  control={<Radio />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <BusinessIcon fontSize="small" />
                      Organization
                    </Box>
                  }
                />
                <FormControlLabel
                  value="public"
                  control={<Radio />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <PublicIcon fontSize="small" />
                      Public
                    </Box>
                  }
                />
              </RadioGroup>
            </FormControl>
          </Grid>
          
          {/* Collaborators */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>
              Collaborators
            </Typography>
            <List dense>
              {formData.collaborators.map((collaborator, index) => (
                <ListItem key={index}>
                  <ListItemText
                    primary={collaborator.email}
                    secondary={collaborator.role}
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      onClick={() => handleRemoveCollaborator(index)}
                      size="small"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <TextField
                size="small"
                placeholder="Email"
                type="email"
                value={newCollaborator.email}
                onChange={(e) => setNewCollaborator(prev => ({ ...prev, email: e.target.value }))}
              />
              <Select
                size="small"
                value={newCollaborator.role}
                onChange={(e) => setNewCollaborator(prev => ({ ...prev, role: e.target.value as any }))}
              >
                <MenuItem value="viewer">Viewer</MenuItem>
                <MenuItem value="editor">Editor</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
              </Select>
              <IconButton onClick={handleAddCollaborator} size="small">
                <AddIcon />
              </IconButton>
            </Stack>
          </Grid>
        </Grid>
      </Box>
    </LocalizationProvider>
  );
};