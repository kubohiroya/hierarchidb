import {
  FDM_CANONICAL_AXIS_DIMENSIONS,
  type FdmAxisDimension,
  type FdmAxisMap,
  type FdmDashboardCell,
  type FdmDashboardCellDetail,
  type FdmDashboardDimensions,
  type FdmFilters,
  type FdmRulesetGovernanceProjection,
  type FdmViewMode,
  type FdmWorkflowProjection,
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
import type {
  FdmDashboardControllerActions,
  FdmDashboardControllerState,
} from './fdmDashboardViewTypes.js';
import { buildFdmLatticePoints } from './fdmThreeLatticeModel.js';

const STATUS_COLORS: Record<FdmDashboardCell['status'], string> = {
  idle: '#78909c',
  queued: '#5c6bc0',
  running: '#0288d1',
  blocked: '#f57c00',
  succeeded: '#2e7d32',
  failed: '#c62828',
};

export function FdmDashboardPresentation({
  state,
  actions,
  disabled,
}: {
  readonly state: FdmDashboardControllerState;
  readonly actions: FdmDashboardControllerActions;
  readonly disabled?: boolean;
}) {
  const response = state.response;
  const cells = response?.cells ?? [];
  const selectedCell = cells.find((cell) => cell.id === state.selectedCellId);
  const runtimeEvents =
    state.runtimeEvents.length > 0 ? state.runtimeEvents : (response?.runtimeEvents ?? []);
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
              disabled={disabled || state.loading}
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
              disabled={disabled || state.loading}
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
          <ProjectionStatusBar workflow={response.workflow} ruleset={response.ruleset} />
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
            cellDetail={state.cellDetail}
            cellLogLines={state.cellLogLines}
            logs={response.logs}
            events={runtimeEvents}
            directoryEntries={response.directoryEntries}
            onRunSelected={actions.runSelected}
            onOpenSelectedResult={actions.openSelectedResult}
            disabled={disabled || state.loading}
          />
        </>
      ) : null}
    </Box>
  );
}

function ProjectionStatusBar({
  workflow,
  ruleset,
}: {
  readonly workflow?: FdmWorkflowProjection;
  readonly ruleset?: FdmRulesetGovernanceProjection;
}) {
  if (!workflow && !ruleset) return null;
  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
      {workflow ? (
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
            <Typography variant="subtitle2">Workflow</Typography>
            <Chip
              size="small"
              label={workflow.availability}
              color={projectionColor(workflow.availability)}
            />
            {workflow.status ? <Chip size="small" label={workflow.status} /> : null}
            {workflow.nextAction ? (
              <Chip size="small" label={workflow.nextAction} variant="outlined" />
            ) : null}
          </Stack>
          {workflow.message ? (
            <Typography variant="caption" color="text.secondary">
              {workflow.message}
            </Typography>
          ) : null}
          {workflow.operations?.map((operation) => (
            <Typography key={operation.id} variant="caption" component="div">
              {operation.label ?? operation.id}: {operation.status}
              {operation.outcome ? ` / ${operation.outcome}` : ''}
            </Typography>
          ))}
        </Paper>
      ) : null}
      {ruleset ? (
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
            <Typography variant="subtitle2">Ruleset</Typography>
            <Chip
              size="small"
              label={ruleset.availability}
              color={projectionColor(ruleset.availability)}
            />
            {ruleset.rulesetId ? <Chip size="small" label={ruleset.rulesetId} /> : null}
            {ruleset.version ? (
              <Chip size="small" label={ruleset.version} variant="outlined" />
            ) : null}
          </Stack>
          {ruleset.message ? (
            <Typography variant="caption" color="text.secondary">
              {ruleset.message}
            </Typography>
          ) : null}
          {ruleset.acceptedKnownIssues?.map((issue, index) => (
            <Typography
              key={`${issue.issueNumber ?? 'missing'}:${index}`}
              variant="caption"
              component="div"
            >
              accepted known issue: {issue.issueNumber ?? 'unavailable'}
            </Typography>
          ))}
        </Paper>
      ) : null}
    </Box>
  );
}

function projectionColor(availability: 'available' | 'unavailable' | 'stale' | 'unsupported') {
  if (availability === 'available') return 'success';
  if (availability === 'stale') return 'warning';
  return 'default';
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
          label="parameter sets"
          values={dimensions.parameterSets}
          selected={filters.parameterSets}
          onChange={(values) => onFilterChange('parameterSets', values)}
        />
        <DimensionFilter
          label="datasets"
          values={dimensions.datasets}
          selected={filters.datasets}
          onChange={(values) => onFilterChange('datasets', values)}
        />
        <DimensionFilter
          label="timelines"
          values={dimensions.timelines}
          selected={filters.timelines}
          onChange={(values) => onFilterChange('timelines', values)}
        />
        <DimensionFilter
          label="computes"
          values={dimensions.computes}
          selected={filters.computes}
          onChange={(values) => onFilterChange('computes', values)}
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
  readonly label: string;
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
        inputProps={{ 'aria-label': label }}
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
        inputProps={{ 'aria-label': label }}
        value={value}
        onChange={(event) => onChange(event.target.value as FdmAxisDimension)}
      >
        {FDM_CANONICAL_AXIS_DIMENSIONS.map((axis) => (
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
  cellDetail,
  cellLogLines,
  logs,
  events,
  directoryEntries,
  onRunSelected,
  onOpenSelectedResult,
  disabled,
}: {
  readonly selectedCell?: FdmDashboardCell;
  readonly cellDetail?: FdmDashboardCellDetail;
  readonly cellLogLines: readonly string[];
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
  const currentCellDetail =
    selectedCell && cellDetail?.cell.id === selectedCell.id ? cellDetail : undefined;
  const displayedLogs = [...logs, ...(currentCellDetail?.latestLogLines ?? []), ...cellLogLines];
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
            {currentCellDetail?.startedAt ? (
              <Typography variant="caption">Started {currentCellDetail.startedAt}</Typography>
            ) : null}
            {currentCellDetail?.updatedAt ? (
              <Typography variant="caption">Updated {currentCellDetail.updatedAt}</Typography>
            ) : null}
            {currentCellDetail?.logPath ? (
              <Typography variant="caption">Log {currentCellDetail.logPath}</Typography>
            ) : null}
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
        {displayedLogs.slice(-8).map((line, index) => (
          <Typography key={`${line}:${index}`} variant="caption" component="pre" sx={{ m: 0 }}>
            {line}
          </Typography>
        ))}
      </Paper>
    </Box>
  );
}
