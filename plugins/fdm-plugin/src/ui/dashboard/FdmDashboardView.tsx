import {
  FDM_AXIS_DIMENSIONS,
  type FdmAxisDimension,
  type FdmAxisMap,
  type FdmDashboardCell,
  type FdmDashboardDimensions,
  type FdmFilters,
  type FdmViewMode,
  summarizeFdmCells,
} from '@hierarchidb/fdm-api';
import MapIcon from '@mui/icons-material/Map';
import RefreshIcon from '@mui/icons-material/Refresh';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import TableChartIcon from '@mui/icons-material/TableChart';
import ViewInArOutlinedIcon from '@mui/icons-material/ViewInArOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { buildFdmMatrixRows } from './fdmDashboardLayout.js';
import type { FdmDashboardViewProps } from './fdmDashboardViewTypes.js';
import { buildFdmLatticePoints } from './fdmThreeLatticeModel.js';
import { useFdmDashboardController } from './useFdmDashboardController.js';

const STATUS_COLORS: Record<FdmDashboardCell['status'], string> = {
  idle: '#78909c',
  queued: '#5c6bc0',
  running: '#0288d1',
  blocked: '#f57c00',
  succeeded: '#2e7d32',
  failed: '#c62828',
};

export function FdmDashboardView(props: FdmDashboardViewProps) {
  const { state, actions } = useFdmDashboardController(props);
  const response = state.response;
  const cells = response?.cells ?? [];
  const selectedCell = cells.find((cell) => cell.id === state.selectedCellId);
  const summary = useMemo(() => summarizeFdmCells(cells), [cells]);

  return (
    <Box sx={{ display: 'grid', gap: 2, minHeight: 560 }}>
      <Stack direction="row" spacing={1.5} alignItems="center" useFlexGap flexWrap="wrap">
        <ViewInArOutlinedIcon color="primary" />
        <Typography variant="h6" component="h2">
          FDM Dashboard
        </Typography>
        {response ? (
          <Chip
            size="small"
            label={response.connectionState}
            color={response.connectionState === 'connected' ? 'success' : 'warning'}
          />
        ) : null}
        {state.loading ? <CircularProgress size={18} aria-label="FDM dashboard loading" /> : null}
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Refresh dashboard">
          <span>
            <Button
              size="small"
              startIcon={<RefreshIcon />}
              onClick={actions.refresh}
              disabled={props.disabled || state.loading}
            >
              Refresh
            </Button>
          </span>
        </Tooltip>
        <Tooltip title="Reconnect and reload authoritative state">
          <span>
            <Button
              size="small"
              startIcon={<RestartAltIcon />}
              onClick={actions.reconnect}
              disabled={props.disabled || state.loading}
            >
              Reconnect
            </Button>
          </span>
        </Tooltip>
      </Stack>

      {state.error ? <Alert severity="error">{state.error}</Alert> : null}
      {!response && !state.loading ? (
        <Alert severity="info">Dashboard data has not loaded.</Alert>
      ) : null}

      {response ? (
        <>
          <SummaryBar
            total={summary.totalCells}
            succeeded={summary.succeeded}
            running={summary.running}
            failed={summary.failed}
            blocked={summary.blocked}
            spaceLabel={response.spaceLabel}
            refreshedAt={response.refreshedAt}
          />
          <DashboardControls
            dimensions={response.dimensions}
            filters={state.filters}
            axisMap={state.axisMap}
            selectedStateDir={response.selectedStateDir}
            stateDirectories={response.stateDirectories}
            onFilterChange={actions.setFilter}
            onAxisChange={actions.setAxis}
          />
          <Paper variant="outlined" sx={{ overflow: 'hidden', borderRadius: 1 }}>
            <Tabs
              value={state.selectedViewMode}
              onChange={(_, value: FdmViewMode) => actions.setViewMode(value)}
              aria-label="FDM dashboard view"
            >
              <Tab
                icon={<ViewInArOutlinedIcon />}
                iconPosition="start"
                value="lattice-3d"
                label="3D lattice"
              />
              <Tab
                icon={<TableChartIcon />}
                iconPosition="start"
                value="matrix-2d"
                label="2D matrix"
              />
              <Tab icon={<MapIcon />} iconPosition="start" value="map" label="Map" />
            </Tabs>
            <Box sx={{ p: 2 }}>
              {state.selectedViewMode === 'lattice-3d' ? (
                <FdmLatticeView
                  cells={cells}
                  dimensions={response.dimensions}
                  filters={state.filters}
                  axisMap={state.axisMap}
                  selectedCellId={state.selectedCellId}
                  onSelectCell={actions.selectCell}
                />
              ) : null}
              {state.selectedViewMode === 'matrix-2d' ? (
                <FdmMatrixView
                  cells={cells}
                  dimensions={response.dimensions}
                  filters={state.filters}
                  axisMap={state.axisMap}
                  onSelectCell={actions.selectCell}
                />
              ) : null}
              {state.selectedViewMode === 'map' ? (
                <FdmMapView
                  cells={cells}
                  locations={response.resultLocations}
                  selectedCellId={state.selectedCellId}
                  onSelectCell={actions.selectCell}
                />
              ) : null}
            </Box>
          </Paper>
          <DashboardDetails
            selectedCell={selectedCell}
            logs={response.logs}
            events={response.runtimeEvents}
            directoryEntries={response.directoryEntries}
            onRunSelected={actions.runSelected}
            onOpenSelectedResult={actions.openSelectedResult}
            disabled={props.disabled || state.loading}
          />
        </>
      ) : null}
    </Box>
  );
}

function SummaryBar({
  total,
  succeeded,
  running,
  failed,
  blocked,
  spaceLabel,
  refreshedAt,
}: {
  readonly total: number;
  readonly succeeded: number;
  readonly running: number;
  readonly failed: number;
  readonly blocked: number;
  readonly spaceLabel: string;
  readonly refreshedAt: string;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1 }}>
      <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {spaceLabel}
        </Typography>
        <Chip size="small" label={`total ${total}`} />
        <Chip size="small" label={`succeeded ${succeeded}`} color="success" />
        <Chip size="small" label={`running ${running}`} color="info" />
        <Chip size="small" label={`failed ${failed}`} color="error" />
        <Chip size="small" label={`blocked ${blocked}`} color="warning" />
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" color="text.secondary">
          {refreshedAt}
        </Typography>
      </Stack>
    </Paper>
  );
}

function DashboardControls({
  dimensions,
  filters,
  axisMap,
  selectedStateDir,
  stateDirectories,
  onFilterChange,
  onAxisChange,
}: {
  readonly dimensions: FdmDashboardDimensions;
  readonly filters: FdmFilters;
  readonly axisMap: FdmAxisMap;
  readonly selectedStateDir?: string;
  readonly stateDirectories: readonly string[];
  readonly onFilterChange: (dimension: keyof FdmFilters, values: readonly string[]) => void;
  readonly onAxisChange: (slot: keyof FdmAxisMap, dimension: FdmAxisDimension) => void;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1 }}>
      <Stack direction="row" spacing={1.5} alignItems="center" useFlexGap flexWrap="wrap">
        <ReadOnlySelect label="state" value={selectedStateDir ?? ''} values={stateDirectories} />
        <DimensionFilter
          label="profiles"
          values={dimensions.profiles}
          selected={filters.profiles}
          onChange={(values) => onFilterChange('profiles', values)}
        />
        <DimensionFilter
          label="datasets"
          values={dimensions.datasets}
          selected={filters.datasets}
          onChange={(values) => onFilterChange('datasets', values)}
        />
        <AxisSelect
          label="x outer"
          value={axisMap.xOuter}
          onChange={(value) => onAxisChange('xOuter', value)}
        />
        <AxisSelect
          label="x inner"
          value={axisMap.xInner}
          onChange={(value) => onAxisChange('xInner', value)}
        />
        <AxisSelect label="y" value={axisMap.y} onChange={(value) => onAxisChange('y', value)} />
        <AxisSelect label="z" value={axisMap.z} onChange={(value) => onAxisChange('z', value)} />
      </Stack>
    </Paper>
  );
}

function ReadOnlySelect({
  label,
  value,
  values,
}: {
  readonly label: string;
  readonly value: string;
  readonly values: readonly string[];
}) {
  return (
    <FormControl size="small" sx={{ minWidth: 150 }}>
      <InputLabel>{label}</InputLabel>
      <Select label={label} value={value} disabled>
        <MenuItem value="">none</MenuItem>
        {values.map((entry) => (
          <MenuItem key={entry} value={entry}>
            {entry}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function DimensionFilter({
  label,
  values,
  selected,
  onChange,
}: {
  readonly label: keyof FdmFilters;
  readonly values: readonly { readonly id: string; readonly label: string }[];
  readonly selected: readonly string[];
  readonly onChange: (values: readonly string[]) => void;
}) {
  return (
    <FormControl size="small" sx={{ minWidth: 160 }}>
      <InputLabel>{label}</InputLabel>
      <Select
        multiple
        label={label}
        value={[...selected]}
        onChange={(event) => {
          const value = event.target.value;
          onChange(typeof value === 'string' ? value.split(',') : value);
        }}
        renderValue={(items) => (items.length === 0 ? 'all' : items.join(', '))}
      >
        {values.map((entry) => (
          <MenuItem key={entry.id} value={entry.id}>
            {entry.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function AxisSelect({
  label,
  value,
  onChange,
}: {
  readonly label: string;
  readonly value: FdmAxisDimension;
  readonly onChange: (value: FdmAxisDimension) => void;
}) {
  return (
    <FormControl size="small" sx={{ minWidth: 120 }}>
      <InputLabel>{label}</InputLabel>
      <Select
        label={label}
        value={value}
        onChange={(event) => onChange(event.target.value as FdmAxisDimension)}
      >
        {FDM_AXIS_DIMENSIONS.map((axis) => (
          <MenuItem key={axis} value={axis}>
            {axis}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function FdmMatrixView({
  cells,
  dimensions,
  filters,
  axisMap,
  onSelectCell,
}: {
  readonly cells: readonly FdmDashboardCell[];
  readonly dimensions: FdmDashboardDimensions;
  readonly filters: FdmFilters;
  readonly axisMap: FdmAxisMap;
  readonly onSelectCell: (cellId: string) => void;
}) {
  const rows = useMemo(
    () => buildFdmMatrixRows(cells, dimensions, filters, axisMap),
    [axisMap, cells, dimensions, filters]
  );
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Box
        role="grid"
        aria-label="FDM 2D matrix"
        sx={{
          display: 'grid',
          gridTemplateColumns: `160px repeat(${rows[0]?.columns.length ?? 1}, 112px)`,
        }}
      >
        <Box />
        {rows[0]?.columns.map((column) => (
          <Typography key={column.columnKey} variant="caption" sx={{ p: 0.75, fontWeight: 600 }}>
            {column.columnLabel}
          </Typography>
        ))}
        {rows.map((row) => (
          <Box key={row.rowKey} sx={{ display: 'contents' }}>
            <Typography variant="caption" sx={{ p: 0.75, fontWeight: 600 }}>
              {row.rowLabel}
            </Typography>
            {row.columns.map((column) => (
              <button
                key={`${row.rowKey}:${column.columnKey}`}
                type="button"
                role="gridcell"
                disabled={!column.cell}
                onClick={() => column.cell && onSelectCell(column.cell.id)}
                style={{
                  minHeight: 44,
                  border: '1px solid rgba(0,0,0,0.12)',
                  background: column.cell ? STATUS_COLORS[column.cell.status] : 'transparent',
                  color: column.cell ? '#fff' : 'inherit',
                  cursor: column.cell ? 'pointer' : 'default',
                }}
              >
                {column.cell?.status ?? ''}
              </button>
            ))}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function FdmLatticeView({
  cells,
  dimensions,
  filters,
  axisMap,
  selectedCellId,
  onSelectCell,
}: {
  readonly cells: readonly FdmDashboardCell[];
  readonly dimensions: FdmDashboardDimensions;
  readonly filters: FdmFilters;
  readonly axisMap: FdmAxisMap;
  readonly selectedCellId?: string;
  readonly onSelectCell: (cellId: string) => void;
}) {
  const sceneHostRef = useRef<HTMLDivElement | null>(null);
  const points = useMemo(
    () => buildFdmLatticePoints({ cells, dimensions, filters, axisMap, selectedCellId }),
    [axisMap, cells, dimensions, filters, selectedCellId]
  );
  const maxX = Math.max(1, ...points.map((point) => point.position.x));
  const maxY = Math.max(1, ...points.map((point) => point.position.y));
  const maxZ = Math.max(1, ...points.map((point) => point.position.z));

  useEffect(() => {
    const host = sceneHostRef.current;
    if (!host) return;
    host.replaceChildren();
    if (points.length === 0) return;
    if (typeof window.WebGLRenderingContext === 'undefined') return;

    let renderer: THREE.WebGLRenderer | null = null;
    let frameId: number | null = null;
    try {
      const width = host.clientWidth || 720;
      const height = host.clientHeight || 360;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
      const group = new THREE.Group();
      const spacing = 1.8;
      const center = new THREE.Vector3(
        maxX * spacing * 0.5,
        maxY * spacing * 0.5,
        maxZ * spacing * 0.5
      );

      for (const point of points) {
        const geometry = new THREE.SphereGeometry(point.isSelected ? 0.18 : 0.13, 18, 12);
        const material = new THREE.MeshBasicMaterial({ color: STATUS_COLORS[point.cell.status] });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(
          point.position.x * spacing - center.x,
          point.position.y * spacing - center.y,
          point.position.z * spacing - center.z
        );
        group.add(mesh);
      }

      const box = new THREE.Box3().setFromObject(group);
      const size = box.getSize(new THREE.Vector3());
      const largestAxis = Math.max(size.x, size.y, size.z, 1);
      camera.position.set(largestAxis * 0.9, largestAxis * 0.7, largestAxis * 1.8);
      camera.lookAt(0, 0, 0);
      scene.add(group);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      renderer.domElement.setAttribute('aria-hidden', 'true');
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.display = 'block';
      host.appendChild(renderer.domElement);

      const render = () => {
        group.rotation.y += 0.003;
        renderer?.render(scene, camera);
        frameId = window.requestAnimationFrame(render);
      };
      render();
    } catch {
      host.replaceChildren();
    }

    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      renderer?.dispose();
      host.replaceChildren();
    };
  }, [maxX, maxY, maxZ, points]);

  return (
    <Box
      role="img"
      aria-label="FDM 3D lattice"
      sx={{
        position: 'relative',
        height: 360,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #f8fafc 0%, #eef2f7 100%)',
      }}
    >
      <Box
        ref={sceneHostRef}
        sx={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
        }}
      />
      {points.map((point) => {
        const left = `${10 + (point.position.x / maxX) * 78}%`;
        const top = `${12 + (point.position.y / maxY) * 70 - point.position.z * 4}%`;
        const size = point.isSelected ? 24 : 18;
        return (
          <Tooltip
            key={point.cell.id}
            title={`${point.cell.id}: ${point.cell.status} (${point.position.x}, ${point.position.y}, ${point.position.z})`}
          >
            <button
              type="button"
              aria-label={`FDM 3D cell ${point.cell.id} ${point.cell.status}`}
              onClick={() => onSelectCell(point.cell.id)}
              style={{
                position: 'absolute',
                left,
                top,
                width: size,
                height: size,
                borderRadius: '50%',
                border: point.isSelected ? '3px solid #111827' : '1px solid rgba(0,0,0,0.25)',
                background: STATUS_COLORS[point.cell.status],
                transform: `translate(-50%, -50%) perspective(480px) translateZ(${point.position.z * 14}px)`,
                cursor: 'pointer',
              }}
            />
          </Tooltip>
        );
      })}
      <Typography
        variant="caption"
        sx={{ position: 'absolute', left: 12, bottom: 8, color: 'text.secondary' }}
      >
        {axisMap.xOuter} / {axisMap.xInner} x {axisMap.y} x {axisMap.z}
      </Typography>
    </Box>
  );
}

function FdmMapView({
  cells,
  locations,
  selectedCellId,
  onSelectCell,
}: {
  readonly cells: readonly FdmDashboardCell[];
  readonly locations: readonly {
    readonly cellId: string;
    readonly label: string;
    readonly longitude: number;
    readonly latitude: number;
    readonly status: FdmDashboardCell['status'];
  }[];
  readonly selectedCellId?: string;
  readonly onSelectCell: (cellId: string) => void;
}) {
  const cellIds = new Set(cells.map((cell) => cell.id));
  const visibleLocations = locations.filter((location) => cellIds.has(location.cellId));
  return (
    <Box
      role="img"
      aria-label="FDM result map"
      sx={{
        position: 'relative',
        height: 320,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        overflow: 'hidden',
        background:
          'linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }}
    >
      {visibleLocations.map((location) => {
        const left = `${((location.longitude + 180) / 360) * 100}%`;
        const top = `${((90 - location.latitude) / 180) * 100}%`;
        return (
          <Tooltip key={location.cellId} title={location.label}>
            <button
              type="button"
              aria-label={`FDM map result ${location.label}`}
              onClick={() => onSelectCell(location.cellId)}
              style={{
                position: 'absolute',
                left,
                top,
                width: selectedCellId === location.cellId ? 22 : 16,
                height: selectedCellId === location.cellId ? 22 : 16,
                borderRadius: '50%',
                border: '2px solid white',
                background: STATUS_COLORS[location.status],
                transform: 'translate(-50%, -50%)',
                boxShadow: '0 1px 6px rgba(0,0,0,0.35)',
                cursor: 'pointer',
              }}
            />
          </Tooltip>
        );
      })}
    </Box>
  );
}

function DashboardDetails({
  selectedCell,
  logs,
  events,
  directoryEntries,
  onRunSelected,
  onOpenSelectedResult,
  disabled,
}: {
  readonly selectedCell?: FdmDashboardCell;
  readonly logs: readonly string[];
  readonly events: readonly {
    readonly id: string;
    readonly message: string;
    readonly status: FdmDashboardCell['status'];
    readonly occurredAt: string;
  }[];
  readonly directoryEntries: readonly {
    readonly id: string;
    readonly label: string;
    readonly logicalPath: readonly string[];
  }[];
  readonly onRunSelected: () => void;
  readonly onOpenSelectedResult: () => void;
  readonly disabled?: boolean;
}) {
  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' } }}>
      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1, minHeight: 180 }}>
        <Typography variant="subtitle2">Cell detail</Typography>
        {selectedCell ? (
          <Stack spacing={0.75} sx={{ mt: 1 }}>
            <Typography variant="body2">{selectedCell.id}</Typography>
            <Chip
              size="small"
              label={selectedCell.status}
              sx={{ bgcolor: STATUS_COLORS[selectedCell.status], color: '#fff' }}
            />
            <Typography variant="caption">{selectedCell.message ?? 'No message'}</Typography>
            <Stack direction="row" spacing={1}>
              <Button size="small" onClick={onRunSelected} disabled={disabled}>
                Run
              </Button>
              <Button
                size="small"
                onClick={onOpenSelectedResult}
                disabled={disabled || !selectedCell.resultRef}
              >
                Result
              </Button>
            </Stack>
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Select a cell.
          </Typography>
        )}
      </Paper>
      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1, minHeight: 180, overflow: 'auto' }}>
        <Typography variant="subtitle2">Runtime feed</Typography>
        {events.map((event) => (
          <Typography key={event.id} variant="caption" component="div">
            {event.occurredAt} {event.status}: {event.message}
          </Typography>
        ))}
      </Paper>
      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1, minHeight: 180, overflow: 'auto' }}>
        <Typography variant="subtitle2">Directory / logs</Typography>
        {directoryEntries.map((entry) => (
          <Typography key={entry.id} variant="caption" component="div">
            {entry.logicalPath.join('/')} / {entry.label}
          </Typography>
        ))}
        {logs.slice(-8).map((line, index) => (
          <Typography key={`${line}:${index}`} variant="caption" component="pre" sx={{ m: 0 }}>
            {line}
          </Typography>
        ))}
      </Paper>
    </Box>
  );
}
