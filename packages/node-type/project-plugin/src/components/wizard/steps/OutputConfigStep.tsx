import React, { useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Slider,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Cloud as CloudIcon,
  Delete as DeleteIcon,
  Description as DocxIcon,
  Download as DownloadIcon,
  Edit as EditIcon,
  ExpandMore as ExpandMoreIcon,
  Html as HtmlIcon,
  PictureAsPdf as PdfIcon,
  Print as PrintIcon,
  QrCode as QrCodeIcon,
  Share as ShareIcon,
  Storage as LocalIcon,
} from '@mui/icons-material';
import type { ExportFormat, ProjectEntity } from '~/types/project-types';

interface OutputConfigStepProps {
  data: Partial<ProjectEntity>;
  onComplete: (data: Partial<ProjectEntity>) => void;
}

type ReportType = 'title' | 'summary' | 'map' | 'chart' | 'table' | 'text';
export const OutputConfigStep: React.FC<OutputConfigStepProps> = ({ data, onComplete }) => {
  const [reportEnabled, setReportEnabled] = useState(false);
  const [reportFormat, setReportFormat] = useState<'pdf' | 'html' | 'docx'>('pdf');
  const [reportSections, setReportSections] = useState<
    Array<{
      type: ReportType;
      content: any;
    }>
  >([]);

  const [tilesEnabled, setTilesEnabled] = useState(false);
  const [tileFormat, setTileFormat] = useState<'pmtiles' | 'mbtiles' | 'xyz'>('pmtiles');
  const [tileZoomRange, setTileZoomRange] = useState<[number, number]>([0, 14]);
  const [tileCompression, setTileCompression] = useState<'none' | 'gzip' | 'brotli'>('gzip');

  const [exportFormats, setExportFormats] = useState<ExportFormat[]>([]);
  const [exportPackaging, setExportPackaging] = useState<'separate' | 'zip' | 'geopackage'>('zip');

  const [sharingEnabled, setSharingEnabled] = useState(false);
  const [sharingPermissions, setSharingPermissions] = useState({
    download: true,
    print: true,
    edit: false,
  });

  const layers = data.layers?.map((l) => ({ id: l.id, name: l.name })) || [];

  const handleAddReportSection = (type: ReportType) => {
    setReportSections([
      ...reportSections,
      {
        type,
        content: type === 'text' ? '' : {},
      },
    ]);
  };

  const handleAddExportFormat = () => {
    setExportFormats([
      ...exportFormats,
      {
        type: 'geojson',
        layers: [],
        includeStyle: true,
        includeMetadata: true,
      },
    ]);
  };

  const handleSubmit = () => {
    const outputConfig = {
      report: {
        enabled: reportEnabled,
        format: reportFormat,
        sections: reportSections,
        template: {
          id: 'default',
          headerFooter: true,
          tableOfContents: true,
        },
      },
      tiles: {
        enabled: tilesEnabled,
        format: tileFormat,
        config: {
          minZoom: tileZoomRange[0],
          maxZoom: tileZoomRange[1],
          layers: layers.map((l) => l.id),
          optimization: {
            simplification: true,
            compression: tileCompression,
            tileSize: 512 as const,
          },
        },
      },
      export: {
        formats: exportFormats,
        packaging: exportPackaging,
      },
      sharing: {
        publicUrl: sharingEnabled,
        embedCode: sharingEnabled,
        qrCode: sharingEnabled,
        permissions: sharingPermissions,
      },
    };

    onComplete({ outputConfig });
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Output Configuration
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Configure how your project data will be exported, shared, and distributed.
        </Typography>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {/* Report Generation */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">Report Generation</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={reportEnabled}
                      onChange={(e) => setReportEnabled(e.target.checked)}
                    />
                  }
                  label="Enable Report Generation"
                />
              </Grid>

              {reportEnabled && (
                <>
                  <Grid item xs={12}>
                    <ToggleButtonGroup
                      value={reportFormat}
                      exclusive
                      onChange={(_, value) => value && setReportFormat(value)}
                      fullWidth
                    >
                      <ToggleButton value="pdf">
                        <Stack alignItems="center" spacing={0.5}>
                          <PdfIcon />
                          <Typography variant="caption">PDF</Typography>
                        </Stack>
                      </ToggleButton>
                      <ToggleButton value="html">
                        <Stack alignItems="center" spacing={0.5}>
                          <HtmlIcon />
                          <Typography variant="caption">HTML</Typography>
                        </Stack>
                      </ToggleButton>
                      <ToggleButton value="docx">
                        <Stack alignItems="center" spacing={0.5}>
                          <DocxIcon />
                          <Typography variant="caption">DOCX</Typography>
                        </Stack>
                      </ToggleButton>
                    </ToggleButtonGroup>
                  </Grid>

                  <Grid item xs={12}>
                    <Typography variant="subtitle2" gutterBottom>
                      Report Sections
                    </Typography>
                    <List dense>
                      {reportSections.map((section, index) => (
                        <ListItem key={index}>
                          <ListItemText primary={section.type} />
                          <ListItemSecondaryAction>
                            <IconButton
                              size="small"
                              onClick={() =>
                                setReportSections(reportSections.filter((_, i) => i !== index))
                              }
                            >
                              <DeleteIcon />
                            </IconButton>
                          </ListItemSecondaryAction>
                        </ListItem>
                      ))}
                    </List>
                    <Stack direction="row" spacing={1}>
                      <Button size="small" onClick={() => handleAddReportSection('title')}>
                        + Title
                      </Button>
                      <Button size="small" onClick={() => handleAddReportSection('summary')}>
                        + Summary
                      </Button>
                      <Button size="small" onClick={() => handleAddReportSection('map')}>
                        + Map
                      </Button>
                      <Button size="small" onClick={() => handleAddReportSection('chart')}>
                        + Chart
                      </Button>
                      <Button size="small" onClick={() => handleAddReportSection('table')}>
                        + Table
                      </Button>
                    </Stack>
                  </Grid>

                  <Grid item xs={12}>
                    <FormControlLabel
                      control={<Checkbox defaultChecked />}
                      label="Include header and footer"
                    />
                    <FormControlLabel
                      control={<Checkbox defaultChecked />}
                      label="Generate table of contents"
                    />
                  </Grid>
                </>
              )}
            </Grid>
          </AccordionDetails>
        </Accordion>

        {/* Map Tile Generation */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">Map Tile Generation</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={tilesEnabled}
                      onChange={(e) => setTilesEnabled(e.target.checked)}
                    />
                  }
                  label="Enable Tile Generation"
                />
              </Grid>

              {tilesEnabled && (
                <>
                  <Grid item xs={12}>
                    <ToggleButtonGroup
                      value={tileFormat}
                      exclusive
                      onChange={(_, value) => value && setTileFormat(value)}
                      fullWidth
                    >
                      <ToggleButton value="pmtiles">PMTiles</ToggleButton>
                      <ToggleButton value="mbtiles">MBTiles</ToggleButton>
                      <ToggleButton value="xyz">XYZ</ToggleButton>
                    </ToggleButtonGroup>
                  </Grid>

                  <Grid item xs={12}>
                    <Typography gutterBottom>
                      Zoom Levels: {tileZoomRange[0]} - {tileZoomRange[1]}
                    </Typography>
                    <Slider
                      value={tileZoomRange}
                      onChange={(_, value) => setTileZoomRange(value as [number, number])}
                      min={0}
                      max={22}
                      marks
                      valueLabelDisplay="auto"
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <Typography variant="subtitle2" gutterBottom>
                      Layers to Include
                    </Typography>
                    {layers.map((layer) => (
                      <FormControlLabel
                        key={layer.id}
                        control={<Checkbox defaultChecked />}
                        label={layer.name}
                      />
                    ))}
                  </Grid>

                  <Grid item xs={12}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Compression</InputLabel>
                      <Select
                        value={tileCompression}
                        onChange={(e) => setTileCompression(e.target.value as any)}
                        label="Compression"
                      >
                        <MenuItem value="none">None</MenuItem>
                        <MenuItem value="gzip">GZIP</MenuItem>
                        <MenuItem value="brotli">Brotli</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12}>
                    <FormControlLabel
                      control={<Switch defaultChecked />}
                      label="Enable simplification"
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <Typography variant="subtitle2" gutterBottom>
                      Hosting
                    </Typography>
                    <ToggleButtonGroup value="local" exclusive fullWidth>
                      <ToggleButton value="local">
                        <Stack alignItems="center" spacing={0.5}>
                          <LocalIcon />
                          <Typography variant="caption">Local</Typography>
                        </Stack>
                      </ToggleButton>
                      <ToggleButton value="cloud">
                        <Stack alignItems="center" spacing={0.5}>
                          <CloudIcon />
                          <Typography variant="caption">Cloud</Typography>
                        </Stack>
                      </ToggleButton>
                      <ToggleButton value="cdn">
                        <Stack alignItems="center" spacing={0.5}>
                          <CloudIcon />
                          <Typography variant="caption">CDN</Typography>
                        </Stack>
                      </ToggleButton>
                    </ToggleButtonGroup>
                  </Grid>
                </>
              )}
            </Grid>
          </AccordionDetails>
        </Accordion>

        {/* Data Export */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">Data Export</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Export Formats
                </Typography>
                {exportFormats.map((format, index) => (
                  <Paper key={index} variant="outlined" sx={{ p: 1, mb: 1 }}>
                    <Grid container spacing={1} alignItems="center">
                      <Grid item xs={4}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Format</InputLabel>
                          <Select value={format.type} label="Format">
                            <MenuItem value="geojson">GeoJSON</MenuItem>
                            <MenuItem value="shapefile">Shapefile</MenuItem>
                            <MenuItem value="kml">KML</MenuItem>
                            <MenuItem value="csv">CSV</MenuItem>
                            <MenuItem value="excel">Excel</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={3}>
                        <FormControlLabel
                          control={<Checkbox defaultChecked size="small" />}
                          label="Style"
                        />
                      </Grid>
                      <Grid item xs={4}>
                        <FormControlLabel
                          control={<Checkbox defaultChecked size="small" />}
                          label="Metadata"
                        />
                      </Grid>
                      <Grid item xs={1}>
                        <IconButton
                          size="small"
                          onClick={() =>
                            setExportFormats(exportFormats.filter((_, i) => i !== index))
                          }
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Grid>
                    </Grid>
                  </Paper>
                ))}
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={handleAddExportFormat}
                  fullWidth
                >
                  Add Export Format
                </Button>
              </Grid>

              <Grid item xs={12}>
                <FormControl fullWidth size="small">
                  <InputLabel>Packaging</InputLabel>
                  <Select
                    value={exportPackaging}
                    onChange={(e) => setExportPackaging(e.target.value as any)}
                    label="Packaging"
                  >
                    <MenuItem value="separate">Separate Files</MenuItem>
                    <MenuItem value="zip">ZIP Archive</MenuItem>
                    <MenuItem value="geopackage">GeoPackage</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>

        {/* Sharing Settings */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">Sharing Settings</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={sharingEnabled}
                      onChange={(e) => setSharingEnabled(e.target.checked)}
                    />
                  }
                  label="Enable Public Sharing"
                />
              </Grid>

              {sharingEnabled && (
                <>
                  <Grid item xs={12}>
                    <Stack direction="row" spacing={2}>
                      <Chip icon={<ShareIcon />} label="Public URL" color="primary" />
                      <Chip icon={<QrCodeIcon />} label="QR Code" color="primary" />
                      <Chip label="Embed Code" color="primary" />
                    </Stack>
                  </Grid>

                  <Grid item xs={12}>
                    <Typography variant="subtitle2" gutterBottom>
                      Permissions
                    </Typography>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={sharingPermissions.download}
                          onChange={(e) =>
                            setSharingPermissions((prev) => ({
                              ...prev,
                              download: e.target.checked,
                            }))
                          }
                        />
                      }
                      label={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <DownloadIcon fontSize="small" />
                          <Typography>Allow Download</Typography>
                        </Stack>
                      }
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={sharingPermissions.print}
                          onChange={(e) =>
                            setSharingPermissions((prev) => ({
                              ...prev,
                              print: e.target.checked,
                            }))
                          }
                        />
                      }
                      label={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <PrintIcon fontSize="small" />
                          <Typography>Allow Print</Typography>
                        </Stack>
                      }
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={sharingPermissions.edit}
                          onChange={(e) =>
                            setSharingPermissions((prev) => ({
                              ...prev,
                              edit: e.target.checked,
                            }))
                          }
                        />
                      }
                      label={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <EditIcon fontSize="small" />
                          <Typography>Allow Edit</Typography>
                        </Stack>
                      }
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <Typography variant="subtitle2" gutterBottom>
                      Branding
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      label="Attribution Text"
                      placeholder="© 2024 Your Organization"
                      sx={{ mb: 1 }}
                    />
                    <Button variant="outlined" size="small" fullWidth>
                      Upload Logo
                    </Button>
                  </Grid>
                </>
              )}
            </Grid>
          </AccordionDetails>
        </Accordion>
      </Box>

      <Box sx={{ mt: 2 }}>
        <Button variant="contained" onClick={handleSubmit} fullWidth>
          Complete Setup
        </Button>
      </Box>
    </Box>
  );
};
