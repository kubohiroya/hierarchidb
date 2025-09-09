import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  List,
  ListItem,
  MenuItem,
  Paper,
  Select,
  Slider,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Compare as ChangeIcon,
  Delete as DeleteIcon,
  LocalFireDepartment as HotspotIcon,
  PlayArrow as PlayIcon,
  SkipNext as SkipNextIcon,
  SkipPrevious as SkipPreviousIcon,
  Timeline as MovementIcon,
  TrendingUp as TrendIcon,
} from '@mui/icons-material';
import { AdapterDateFns, DateTimePicker, LocalizationProvider } from '@hierarchidb/ui-date';
import type { ProjectEntity, TemporalAnalysis } from '~/types/project-types';

interface TemporalAnalysisStepProps {
  data: Partial<ProjectEntity>;
  onComplete: (data: Partial<ProjectEntity>) => void;
}

export const TemporalAnalysisStep: React.FC<TemporalAnalysisStepProps> = ({ data, onComplete }) => {
  const [temporalEnabled, setTemporalEnabled] = useState(false);
  const [timeRange, setTimeRange] = useState({
    start: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
    end: new Date(),
    step: {
      value: 1,
      unit: 'day' as const,
    },
  });
  const [animation, setAnimation] = useState({
    enabled: false,
    speed: 5,
    loop: true,
    showTrails: false,
    trailLength: 10,
  });
  const [analyses, setAnalyses] = useState<TemporalAnalysis[]>([]);
  const [timeFields, setTimeFields] = useState<
    Array<{
      layerId: string;
      field: string;
      format?: string;
    }>
  >([]);

  const layers = data.layers?.map((l) => ({ id: l.id, name: l.name })) || [];

  const handleAddAnalysis = (type: 'trend' | 'hotspot' | 'movement' | 'change-detection') => {
    const newAnalysis: TemporalAnalysis = {
      id: crypto.randomUUID(),
      name: `${type} Analysis ${analyses.length + 1}`,
      type,
    };

    switch (type) {
      case 'trend':
        newAnalysis.trend = {
          layer: '',
          valueField: '',
          aggregation: 'mean',
          interval: 'day',
          trendLine: 'linear',
        };
        break;
      case 'hotspot':
        newAnalysis.hotspot = {
          layer: '',
          timeWindow: 7,
          spatialWindow: 1000,
          threshold: 2,
        };
        break;
      case 'movement':
        newAnalysis.movement = {
          layer: '',
          idField: '',
          showPaths: true,
          pathStyle: {
            color: '#ff6600',
            width: 2,
          },
          statistics: true,
        };
        break;
      case 'change-detection':
        newAnalysis.changeDetection = {
          layer: '',
          compareMethod: 'relative',
          threshold: 0.1,
          highlightChanges: true,
        };
        break;
    }

    setAnalyses([...analyses, newAnalysis]);
  };

  const handleDeleteAnalysis = (index: number) => {
    setAnalyses(analyses.filter((_, i) => i !== index));
  };

  const handleAddTimeField = () => {
    if (layers.length > 0 && layers[0]?.id) {
      setTimeFields([
        ...timeFields,
        {
          layerId: layers[0]?.id,
          field: '',
          format: 'ISO8601',
        },
      ]);
    }
  };

  const handleSubmit = () => {
    onComplete({
      temporalAnalyses: analyses,
    });
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            Temporal Analysis Configuration
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Configure time-based analysis and animations for your project.
          </Typography>
        </Box>

        <Paper sx={{ p: 2, mb: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={temporalEnabled}
                onChange={(e) => setTemporalEnabled(e.target.checked)}
              />
            }
            label={<Typography variant="subtitle1">Enable Temporal Analysis</Typography>}
          />
        </Paper>

        {temporalEnabled && (
          <>
            {/* Time Range Configuration */}
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Time Range
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <DateTimePicker
                    label="Start Date"
                    value={timeRange.start}
                    onChange={(date) => date && setTimeRange((prev) => ({ ...prev, start: date }))}
                    slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <DateTimePicker
                    label="End Date"
                    value={timeRange.end}
                    onChange={(date) => date && setTimeRange((prev) => ({ ...prev, end: date }))}
                    slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Step Value"
                    type="number"
                    value={timeRange.step.value}
                    onChange={(e) =>
                      setTimeRange((prev) => ({
                        ...prev,
                        step: { ...prev.step, value: parseInt(e.target.value) },
                      }))
                    }
                  />
                </Grid>
                <Grid item xs={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Step Unit</InputLabel>
                    <Select
                      value={timeRange.step.unit}
                      onChange={(e) =>
                        setTimeRange((prev) => ({
                          ...prev,
                          step: { ...prev.step, unit: e.target.value as any },
                        }))
                      }
                      label="Step Unit"
                    >
                      <MenuItem value="hour">Hour</MenuItem>
                      <MenuItem value="day">Day</MenuItem>
                      <MenuItem value="week">Week</MenuItem>
                      <MenuItem value="month">Month</MenuItem>
                      <MenuItem value="year">Year</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Paper>

            {/* Time Field Mapping */}
            <Paper sx={{ p: 2, mb: 2 }}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ mb: 1 }}
              >
                <Typography variant="subtitle2">Time Field Mapping</Typography>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={handleAddTimeField}
                  disabled={layers.length === 0}
                >
                  Add Mapping
                </Button>
              </Stack>
              {timeFields.length > 0 && (
                <List dense>
                  {timeFields.map((field, index) => (
                    <ListItem key={index}>
                      <Grid container spacing={1} alignItems="center">
                        <Grid item xs={4}>
                          <FormControl fullWidth size="small">
                            <InputLabel>Layer</InputLabel>
                            <Select
                              value={field.layerId}
                              onChange={(e) => {
                                const updated = [...timeFields];
                                if (updated[index]) {
                                  updated[index].layerId = e.target.value;
                                  setTimeFields(updated);
                                }
                              }}
                              label="Layer"
                            >
                              {layers.map((layer) => (
                                <MenuItem key={layer.id} value={layer.id}>
                                  {layer.name}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid item xs={4}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Field Name"
                            value={field.field}
                            onChange={(e) => {
                              const updated = [...timeFields];
                              if (updated[index]) {
                                updated[index].field = e.target.value;
                                setTimeFields(updated);
                              }
                            }}
                          />
                        </Grid>
                        <Grid item xs={3}>
                          <FormControl fullWidth size="small">
                            <InputLabel>Format</InputLabel>
                            <Select value={field.format || 'ISO8601'} label="Format">
                              <MenuItem value="ISO8601">ISO 8601</MenuItem>
                              <MenuItem value="Unix">Unix Timestamp</MenuItem>
                              <MenuItem value="Custom">Custom</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid item xs={1}>
                          <IconButton
                            size="small"
                            onClick={() => setTimeFields(timeFields.filter((_, i) => i !== index))}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Grid>
                      </Grid>
                    </ListItem>
                  ))}
                </List>
              )}
            </Paper>

            {/* Animation Settings */}
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Animation Settings
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={animation.enabled}
                        onChange={(e) =>
                          setAnimation((prev) => ({ ...prev, enabled: e.target.checked }))
                        }
                      />
                    }
                    label="Enable Animation"
                  />
                </Grid>
                {animation.enabled && (
                  <>
                    <Grid item xs={12}>
                      <Typography gutterBottom>Speed: {animation.speed}</Typography>
                      <Slider
                        value={animation.speed}
                        onChange={(_, value) =>
                          setAnimation((prev) => ({ ...prev, speed: value as number }))
                        }
                        min={1}
                        max={10}
                        marks
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={animation.loop}
                            onChange={(e) =>
                              setAnimation((prev) => ({ ...prev, loop: e.target.checked }))
                            }
                          />
                        }
                        label="Loop"
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={animation.showTrails}
                            onChange={(e) =>
                              setAnimation((prev) => ({ ...prev, showTrails: e.target.checked }))
                            }
                          />
                        }
                        label="Show Trails"
                      />
                    </Grid>
                    {animation.showTrails && (
                      <Grid item xs={12}>
                        <Typography gutterBottom>
                          Trail Length: {animation.trailLength} frames
                        </Typography>
                        <Slider
                          value={animation.trailLength}
                          onChange={(_, value) =>
                            setAnimation((prev) => ({ ...prev, trailLength: value as number }))
                          }
                          min={1}
                          max={50}
                        />
                      </Grid>
                    )}
                  </>
                )}
              </Grid>

              {/* Animation Preview Controls */}
              {animation.enabled && (
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', gap: 1 }}>
                  <IconButton size="small">
                    <SkipPreviousIcon />
                  </IconButton>
                  <IconButton>
                    <PlayIcon />
                  </IconButton>
                  <IconButton size="small">
                    <SkipNextIcon />
                  </IconButton>
                </Box>
              )}
            </Paper>

            {/* Temporal Analyses */}
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Temporal Analyses
              </Typography>
              <Grid container spacing={1} sx={{ mb: 2 }}>
                <Grid item xs={6} sm={3}>
                  <Button
                    fullWidth
                    variant="outlined"
                    size="small"
                    startIcon={<TrendIcon />}
                    onClick={() => handleAddAnalysis('trend')}
                  >
                    Trend
                  </Button>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Button
                    fullWidth
                    variant="outlined"
                    size="small"
                    startIcon={<HotspotIcon />}
                    onClick={() => handleAddAnalysis('hotspot')}
                  >
                    Hotspot
                  </Button>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Button
                    fullWidth
                    variant="outlined"
                    size="small"
                    startIcon={<MovementIcon />}
                    onClick={() => handleAddAnalysis('movement')}
                  >
                    Movement
                  </Button>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Button
                    fullWidth
                    variant="outlined"
                    size="small"
                    startIcon={<ChangeIcon />}
                    onClick={() => handleAddAnalysis('change-detection')}
                  >
                    Change
                  </Button>
                </Grid>
              </Grid>

              {analyses.length > 0 && (
                <Stack spacing={1}>
                  {analyses.map((analysis, index) => (
                    <Card key={analysis.id} variant="outlined">
                      <CardContent>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="subtitle2">{analysis.name}</Typography>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Chip label={analysis.type} size="small" variant="outlined" />
                            <IconButton size="small" onClick={() => handleDeleteAnalysis(index)}>
                              <DeleteIcon />
                            </IconButton>
                          </Stack>
                        </Stack>

                        {/* Analysis-specific configuration would go here */}
                        {analysis.type === 'trend' && (
                          <Grid container spacing={1} sx={{ mt: 1 }}>
                            <Grid item xs={6}>
                              <FormControl fullWidth size="small">
                                <InputLabel>Layer</InputLabel>
                                <Select value="" label="Layer">
                                  {layers.map((layer) => (
                                    <MenuItem key={layer.id} value={layer.id}>
                                      {layer.name}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </Grid>
                            <Grid item xs={6}>
                              <FormControl fullWidth size="small">
                                <InputLabel>Aggregation</InputLabel>
                                <Select value="mean" label="Aggregation">
                                  <MenuItem value="sum">Sum</MenuItem>
                                  <MenuItem value="mean">Mean</MenuItem>
                                  <MenuItem value="max">Max</MenuItem>
                                  <MenuItem value="min">Min</MenuItem>
                                  <MenuItem value="count">Count</MenuItem>
                                </Select>
                              </FormControl>
                            </Grid>
                          </Grid>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              )}
            </Paper>

            {/* Timeline Configuration */}
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Timeline Display
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Position</InputLabel>
                    <Select value="bottom" label="Position">
                      <MenuItem value="top">Top</MenuItem>
                      <MenuItem value="bottom">Bottom</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6}>
                  <FormControlLabel control={<Switch defaultChecked />} label="Show Chart" />
                </Grid>
                <Grid item xs={6}>
                  <FormControlLabel control={<Switch defaultChecked />} label="Show Events" />
                </Grid>
              </Grid>
            </Paper>
          </>
        )}

        <Box sx={{ mt: 'auto', pt: 2 }}>
          <Button variant="contained" onClick={handleSubmit} fullWidth>
            Continue
          </Button>
        </Box>
      </Box>
    </LocalizationProvider>
  );
};
